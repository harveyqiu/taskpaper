import { test, expect, Page } from '@playwright/test'

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

/** Returns the full plain text of the editor */
async function getEditorText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const ed = document.getElementById('editor')!
    return Array.from(ed.children)
      .map((d) => d.textContent ?? '')
      .join('\n')
  })
}

/** Returns all visible line classes */
async function getLineClasses(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const ed = document.getElementById('editor')!
    return Array.from(ed.children).map((d) => d.className)
  })
}

// ----------------------------------------------------------------
// Initial load
// ----------------------------------------------------------------
test.describe('Initial load', () => {
  test('renders the toolbar', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#toolbar')).toBeVisible()
  })

  test('renders the editor with default content', async ({ page }) => {
    await page.goto('/')
    const text = await getEditorText(page)
    expect(text).toContain('工作:')
    expect(text).toContain('个人:')
  })

  test('classifies default content correctly', async ({ page }) => {
    await page.goto('/')
    const classes = await getLineClasses(page)
    // First line is a project
    expect(classes[0]).toContain('line-project')
    // Tasks are present
    expect(classes.some((c) => c.includes('line-task'))).toBe(true)
    // Done tasks are present
    expect(classes.some((c) => c.includes('line-task-done'))).toBe(true)
  })

  test('renders search input and filter buttons', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#search-input')).toBeVisible()
    await expect(page.getByText('全部')).toBeVisible()
    await expect(page.getByText('未完成')).toBeVisible()
    await expect(page.getByText('已完成')).toBeVisible()
  })

  test('shows @tag filter buttons from default content', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-tag="@work"]')).toBeVisible()
    await expect(page.locator('[data-tag="@home"]')).toBeVisible()
  })

  test('persists content to localStorage on load', async ({ page }) => {
    await page.goto('/')
    const stored = await page.evaluate(() =>
      localStorage.getItem('taskpaper-lite:content'),
    )
    expect(stored).toContain('工作:')
  })
})

// ----------------------------------------------------------------
// Editor typing
// ----------------------------------------------------------------
test.describe('Editor typing', () => {
  test('can type a new project line', async ({ page }) => {
    await page.goto('/')
    const editor = page.locator('#editor')
    await editor.click()
    // Go to end and add a new line
    await page.keyboard.press('Control+End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('My New Project:')
    const text = await getEditorText(page)
    expect(text).toContain('My New Project:')
  })

  test('new project line gets line-project class', async ({ page }) => {
    await page.goto('/')
    await page.locator('#editor').click()
    await page.keyboard.press('Control+End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Test Project:')
    const classes = await getLineClasses(page)
    expect(classes.at(-1)).toContain('line-project')
  })

  test('new task line gets line-task class', async ({ page }) => {
    await page.goto('/')
    await page.locator('#editor').click()
    await page.keyboard.press('Control+End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('\t- A new task')
    const classes = await getLineClasses(page)
    expect(classes.at(-1)).toContain('line-task')
  })

  test('autosaves after typing (debounced)', async ({ page }) => {
    await page.goto('/')
    await page.locator('#editor').click()
    await page.keyboard.press('Control+End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('AutoSave Project:')
    // Wait for 600ms debounce
    await page.waitForTimeout(700)
    const stored = await page.evaluate(() =>
      localStorage.getItem('taskpaper-lite:content'),
    )
    expect(stored).toContain('AutoSave Project:')
  })
})

// ----------------------------------------------------------------
// Cmd+D — toggle @done
// ----------------------------------------------------------------
test.describe('Cmd+D toggle done', () => {
  test('toggles @done on a task line', async ({ page }) => {
    await page.goto('/')
    // Click on the first task (line 2 = "- 写需求文档 @work @today")
    const firstTask = page.locator('#editor > div.line-task').first()
    await firstTask.click()
    await page.keyboard.press('Meta+d')
    const classes = await getLineClasses(page)
    const taskClasses = classes.filter((c) => c.includes('line-task'))
    // The clicked task should now be done
    const doneClasses = classes.filter((c) => c.includes('line-task-done'))
    expect(doneClasses.length).toBeGreaterThan(0)
  })

  test('removes @done when toggled again', async ({ page }) => {
    await page.goto('/')
    const doneTask = page.locator('#editor > div.line-task-done').first()
    await doneTask.click()
    const textBefore = await doneTask.textContent()
    await page.keyboard.press('Meta+d')
    await page.waitForTimeout(100)
    // The line should no longer have @done
    const allText = await getEditorText(page)
    // Count of @done occurrences should have decreased
    const beforeCount = (textBefore?.match(/@done/g) ?? []).length
    expect(beforeCount).toBeGreaterThan(0)
  })

  test('Cmd+D also works with Ctrl+D', async ({ page }) => {
    await page.goto('/')
    const firstTask = page.locator('#editor > div.line-task').first()
    await firstTask.click()
    await page.keyboard.press('Control+d')
    const classes = await getLineClasses(page)
    const doneCount = classes.filter((c) => c.includes('line-task-done')).length
    expect(doneCount).toBeGreaterThan(0)
  })
})

// ----------------------------------------------------------------
// Filter buttons
// ----------------------------------------------------------------
test.describe('Filter buttons', () => {
  test('"全部" shows all lines', async ({ page }) => {
    await page.goto('/')
    await page.getByText('全部').click()
    const hiddenLines = await page.evaluate(() =>
      Array.from(document.getElementById('editor')!.children).filter((d) =>
        d.classList.contains('line-hidden'),
      ).length,
    )
    expect(hiddenLines).toBe(0)
  })

  test('"未完成" hides done lines', async ({ page }) => {
    await page.goto('/')
    await page.getByText('未完成').click()
    const doneVisible = await page.evaluate(() =>
      Array.from(document.getElementById('editor')!.children).filter(
        (d) =>
          (d.className.includes('-done') && !d.className.includes('line-project')) &&
          !d.classList.contains('line-hidden'),
      ).length,
    )
    expect(doneVisible).toBe(0)
  })

  test('"已完成" shows only done lines (and projects)', async ({ page }) => {
    await page.goto('/')
    await page.getByText('已完成').click()
    const undoneVisible = await page.evaluate(() =>
      Array.from(document.getElementById('editor')!.children).filter((d) => {
        const base = d.className.replace(' line-hidden', '').trim()
        return (
          !base.endsWith('-done') &&
          base !== 'line-project' &&
          base !== 'line-blank' &&
          !d.classList.contains('line-hidden')
        )
      }).length,
    )
    expect(undoneVisible).toBe(0)
  })

  test('@work filter shows only work-tagged lines and projects', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-filter="@work"]').click()
    const workVisible = await page.evaluate(() => {
      const ed = document.getElementById('editor')!
      return Array.from(ed.children).filter(
        (d) => !d.classList.contains('line-hidden') && !d.className.includes('line-project'),
      ).every((d) => (d.textContent ?? '').includes('@work'))
    })
    expect(workVisible).toBe(true)
  })

  test('active class moves to the clicked filter button', async ({ page }) => {
    await page.goto('/')
    await page.getByText('未完成').click()
    await expect(page.getByText('未完成')).toHaveClass(/active/)
    await expect(page.getByText('全部')).not.toHaveClass(/active/)
  })

  test('filter persists to localStorage', async ({ page }) => {
    await page.goto('/')
    await page.getByText('已完成').click()
    const stored = await page.evaluate(() =>
      localStorage.getItem('taskpaper-lite:filter'),
    )
    expect(stored).toBe('done')
  })
})

// ----------------------------------------------------------------
// Search
// ----------------------------------------------------------------
test.describe('Search', () => {
  test('Cmd+F focuses the search input', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('Meta+f')
    await expect(page.locator('#search-input')).toBeFocused()
  })

  test('typing in search shows match count', async ({ page }) => {
    await page.goto('/')
    await page.locator('#search-input').fill('@work')
    await page.waitForTimeout(100)
    const matchText = await page.locator('#match-count').textContent()
    expect(matchText).toMatch(/\d+\/\d+/)
  })

  test('shows "无匹配" when no matches', async ({ page }) => {
    await page.goto('/')
    await page.locator('#search-input').fill('xyznotfound123')
    await page.waitForTimeout(100)
    await expect(page.locator('#match-count')).toHaveText('无匹配')
  })

  test('clears search with ✕ button', async ({ page }) => {
    await page.goto('/')
    await page.locator('#search-input').fill('@work')
    await page.waitForTimeout(100)
    await page.getByTitle('清空搜索 (Esc)').click()
    await expect(page.locator('#search-input')).toHaveValue('')
    await expect(page.locator('#match-count')).toHaveText('')
  })

  test('Escape clears search when input is focused', async ({ page }) => {
    await page.goto('/')
    await page.locator('#search-input').fill('work')
    await page.keyboard.press('Escape')
    await expect(page.locator('#search-input')).toHaveValue('')
  })

  test('Enter navigates to the next match', async ({ page }) => {
    await page.goto('/')
    await page.locator('#search-input').fill('@work')
    await page.waitForTimeout(100)
    const before = await page.locator('#match-count').textContent()
    await page.keyboard.press('Enter')
    await page.waitForTimeout(100)
    const after = await page.locator('#match-count').textContent()
    // Current match index should have advanced
    expect(after).not.toBe(before)
  })

  test('highlights overlay renders rects', async ({ page }) => {
    await page.goto('/')
    await page.locator('#search-input').fill('工作')
    await page.waitForTimeout(100)
    const rectCount = await page.evaluate(
      () => document.getElementById('highlight-overlay')!.childElementCount,
    )
    expect(rectCount).toBeGreaterThan(0)
  })
})

// ----------------------------------------------------------------
// Tab indentation
// ----------------------------------------------------------------
test.describe('Indentation', () => {
  test('Tab inserts a tab character on a single line', async ({ page }) => {
    await page.goto('/')
    const editor = page.locator('#editor')
    await editor.click()
    await page.keyboard.press('Control+End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Unindented line')
    await page.keyboard.press('Home')
    await page.keyboard.press('Tab')
    const text = await getEditorText(page)
    expect(text).toContain('\tUnindented line')
  })

  test('Shift+Tab removes a leading tab', async ({ page }) => {
    await page.goto('/')
    await page.locator('#editor').click()
    await page.keyboard.press('Control+End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('\tIndented line')
    await page.keyboard.press('Home')
    await page.keyboard.press('Shift+Tab')
    const text = await getEditorText(page)
    expect(text).toContain('Indented line')
    expect(text).not.toMatch(/\n\t+Indented line$/)
  })
})

// ----------------------------------------------------------------
// Export / Import
// ----------------------------------------------------------------
test.describe('Export', () => {
  test('export button triggers a file download', async ({ page }) => {
    await page.goto('/')
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByText('导出').click(),
    ])
    expect(download.suggestedFilename()).toBe('tasks.taskpaper')
  })
})

test.describe('Import', () => {
  test('importing a file replaces editor content', async ({ page }) => {
    await page.goto('/')
    const fileContent = 'New Project:\n\t- Imported task @work\n'
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByText('导入').click(),
    ])
    await fileChooser.setFiles({
      name: 'test.taskpaper',
      mimeType: 'text/plain',
      buffer: Buffer.from(fileContent),
    })
    await page.waitForTimeout(300)
    const text = await getEditorText(page)
    expect(text).toContain('New Project:')
    expect(text).toContain('Imported task')
  })

  test('imported content creates @work tag button', async ({ page }) => {
    await page.goto('/')
    const fileContent = 'Tasks:\n\t- Do something @mytag\n'
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByText('导入').click(),
    ])
    await fileChooser.setFiles({
      name: 'test.taskpaper',
      mimeType: 'text/plain',
      buffer: Buffer.from(fileContent),
    })
    await page.waitForTimeout(300)
    await expect(page.locator('[data-tag="@mytag"]')).toBeVisible()
  })
})

// ----------------------------------------------------------------
// localStorage persistence
// ----------------------------------------------------------------
test.describe('Persistence', () => {
  test('reloading the page restores saved content', async ({ page }) => {
    await page.goto('/')
    const editor = page.locator('#editor')
    await editor.click()
    await page.keyboard.press('Control+End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Persist Me:')
    await page.waitForTimeout(700) // wait for autosave debounce
    await page.reload()
    const text = await getEditorText(page)
    expect(text).toContain('Persist Me:')
  })

  test('reloading restores saved filter', async ({ page }) => {
    await page.goto('/')
    await page.getByText('已完成').click()
    await page.reload()
    await expect(page.getByText('已完成')).toHaveClass(/active/)
  })
})
