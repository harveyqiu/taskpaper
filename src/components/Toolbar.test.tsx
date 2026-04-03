import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { Toolbar } from './Toolbar'
import { TAG_COLOR_PRESETS } from '../utils/parser'

// ----------------------------------------------------------------
// Default props factory
// ----------------------------------------------------------------
function makeProps(overrides: Partial<Parameters<typeof Toolbar>[0]> = {}) {
  return {
    filter: 'all',
    searchQuery: '',
    tags: [],
    tagColors: {},
    matchTotal: 0,
    matchCurrent: 0,
    searchInputRef: createRef(),
    fileInputRef: createRef(),
    onFilterChange: vi.fn(),
    onSearchChange: vi.fn(),
    onSearchClear: vi.fn(),
    onSearchNavigate: vi.fn(),
    onSearchKeyDown: vi.fn(),
    onExport: vi.fn(),
    onImport: vi.fn(),
    onTagColorPickerOpen: vi.fn(),
    TAG_COLOR_PRESETS,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ----------------------------------------------------------------
// Rendering
// ----------------------------------------------------------------
describe('Toolbar rendering', () => {
  it('renders the search input', () => {
    render(<Toolbar {...makeProps()} />)
    expect(screen.getByPlaceholderText('搜索… (Cmd+F)')).toBeInTheDocument()
  })

  it('renders the three base filter buttons', () => {
    render(<Toolbar {...makeProps()} />)
    expect(screen.getByText('全部')).toBeInTheDocument()
    expect(screen.getByText('未完成')).toBeInTheDocument()
    expect(screen.getByText('已完成')).toBeInTheDocument()
  })

  it('renders export and import buttons', () => {
    render(<Toolbar {...makeProps()} />)
    expect(screen.getByText('导出')).toBeInTheDocument()
    expect(screen.getByText('导入')).toBeInTheDocument()
  })

  it('renders nav buttons disabled when no matches', () => {
    render(<Toolbar {...makeProps({ matchTotal: 0 })} />)
    expect(screen.getByTitle('上一个 (Shift+Enter)')).toBeDisabled()
    expect(screen.getByTitle('下一个 (Enter)')).toBeDisabled()
  })

  it('renders nav buttons enabled when there are matches', () => {
    render(<Toolbar {...makeProps({ matchTotal: 3, matchCurrent: 1, searchQuery: 'foo' })} />)
    expect(screen.getByTitle('上一个 (Shift+Enter)')).toBeEnabled()
    expect(screen.getByTitle('下一个 (Enter)')).toBeEnabled()
  })
})

// ----------------------------------------------------------------
// Active filter state
// ----------------------------------------------------------------
describe('active filter button', () => {
  it('marks "全部" as active when filter is "all"', () => {
    render(<Toolbar {...makeProps({ filter: 'all' })} />)
    expect(screen.getByText('全部').className).toContain('active')
    expect(screen.getByText('未完成').className).not.toContain('active')
  })

  it('marks "未完成" as active when filter is "undone"', () => {
    render(<Toolbar {...makeProps({ filter: 'undone' })} />)
    expect(screen.getByText('未完成').className).toContain('active')
    expect(screen.getByText('全部').className).not.toContain('active')
  })

  it('marks "已完成" as active when filter is "done"', () => {
    render(<Toolbar {...makeProps({ filter: 'done' })} />)
    expect(screen.getByText('已完成').className).toContain('active')
  })

  it('marks a tag button as active when filter matches', () => {
    render(<Toolbar {...makeProps({ filter: '@work', tags: ['@work', '@home'] })} />)
    expect(screen.getByText('@work').className).toContain('active')
    expect(screen.getByText('@home').className).not.toContain('active')
  })
})

// ----------------------------------------------------------------
// Dynamic tag buttons
// ----------------------------------------------------------------
describe('tag buttons', () => {
  it('renders no tag buttons when tags is empty', () => {
    render(<Toolbar {...makeProps({ tags: [] })} />)
    expect(screen.queryByText('@work')).not.toBeInTheDocument()
  })

  it('renders a button for each tag', () => {
    render(<Toolbar {...makeProps({ tags: ['@work', '@home', '@today'] })} />)
    expect(screen.getByText('@work')).toBeInTheDocument()
    expect(screen.getByText('@home')).toBeInTheDocument()
    expect(screen.getByText('@today')).toBeInTheDocument()
  })

  it('renders a color dot when tag has a color', () => {
    render(
      <Toolbar
        {...makeProps({ tags: ['@work'], tagColors: { work: '#3b82f6' } })}
      />,
    )
    const dot = document.querySelector('.tag-color-dot') as HTMLElement
    expect(dot).toBeTruthy()
    expect(dot.style.background).toBe('rgb(59, 130, 246)')
  })

  it('does not render a color dot when tag has no color', () => {
    render(<Toolbar {...makeProps({ tags: ['@work'], tagColors: {} })} />)
    expect(document.querySelector('.tag-color-dot')).toBeNull()
  })
})

// ----------------------------------------------------------------
// Match count display
// ----------------------------------------------------------------
describe('match count display', () => {
  it('shows nothing when searchQuery is empty', () => {
    render(<Toolbar {...makeProps({ searchQuery: '', matchTotal: 0 })} />)
    expect(document.getElementById('match-count')).toHaveTextContent('')
  })

  it('shows "无匹配" when query has no matches', () => {
    render(<Toolbar {...makeProps({ searchQuery: 'xyz', matchTotal: 0 })} />)
    expect(document.getElementById('match-count')).toHaveTextContent('无匹配')
  })

  it('shows "current/total" when there are matches', () => {
    render(
      <Toolbar {...makeProps({ searchQuery: 'task', matchTotal: 5, matchCurrent: 2 })} />,
    )
    expect(document.getElementById('match-count')).toHaveTextContent('2/5')
  })
})

// ----------------------------------------------------------------
// Interactions
// ----------------------------------------------------------------
describe('Toolbar interactions', () => {
  it('calls onFilterChange with "all" when 全部 is clicked', async () => {
    const onFilterChange = vi.fn()
    render(<Toolbar {...makeProps({ onFilterChange })} />)
    await userEvent.click(screen.getByText('全部'))
    expect(onFilterChange).toHaveBeenCalledWith('all')
  })

  it('calls onFilterChange with "undone" when 未完成 is clicked', async () => {
    const onFilterChange = vi.fn()
    render(<Toolbar {...makeProps({ onFilterChange })} />)
    await userEvent.click(screen.getByText('未完成'))
    expect(onFilterChange).toHaveBeenCalledWith('undone')
  })

  it('calls onFilterChange with "done" when 已完成 is clicked', async () => {
    const onFilterChange = vi.fn()
    render(<Toolbar {...makeProps({ onFilterChange })} />)
    await userEvent.click(screen.getByText('已完成'))
    expect(onFilterChange).toHaveBeenCalledWith('done')
  })

  it('calls onFilterChange with tag value when tag button is clicked', async () => {
    const onFilterChange = vi.fn()
    render(<Toolbar {...makeProps({ tags: ['@work'], onFilterChange })} />)
    await userEvent.click(screen.getByText('@work'))
    expect(onFilterChange).toHaveBeenCalledWith('@work')
  })

  it('calls onSearchChange once per keystroke', async () => {
    const onSearchChange = vi.fn()
    render(<Toolbar {...makeProps({ onSearchChange })} />)
    await userEvent.type(screen.getByPlaceholderText('搜索… (Cmd+F)'), 'hello')
    // Controlled input — onChange fires once per character
    expect(onSearchChange).toHaveBeenCalledTimes(5)
    expect(onSearchChange).toHaveBeenNthCalledWith(1, 'h')
    expect(onSearchChange).toHaveBeenNthCalledWith(5, 'o')
  })

  it('calls onSearchClear when ✕ is clicked', async () => {
    const onSearchClear = vi.fn()
    render(<Toolbar {...makeProps({ onSearchClear })} />)
    await userEvent.click(screen.getByTitle('清空搜索 (Esc)'))
    expect(onSearchClear).toHaveBeenCalledOnce()
  })

  it('calls onSearchNavigate(-1) when ↑ is clicked', async () => {
    const onSearchNavigate = vi.fn()
    render(
      <Toolbar
        {...makeProps({ onSearchNavigate, matchTotal: 3, searchQuery: 'x' })}
      />,
    )
    await userEvent.click(screen.getByTitle('上一个 (Shift+Enter)'))
    expect(onSearchNavigate).toHaveBeenCalledWith(-1)
  })

  it('calls onSearchNavigate(1) when ↓ is clicked', async () => {
    const onSearchNavigate = vi.fn()
    render(
      <Toolbar
        {...makeProps({ onSearchNavigate, matchTotal: 3, searchQuery: 'x' })}
      />,
    )
    await userEvent.click(screen.getByTitle('下一个 (Enter)'))
    expect(onSearchNavigate).toHaveBeenCalledWith(1)
  })

  it('calls onExport when 导出 is clicked', async () => {
    const onExport = vi.fn()
    render(<Toolbar {...makeProps({ onExport })} />)
    await userEvent.click(screen.getByText('导出'))
    expect(onExport).toHaveBeenCalledOnce()
  })

  it('calls onTagColorPickerOpen on right-click of tag button', () => {
    const onTagColorPickerOpen = vi.fn()
    render(
      <Toolbar {...makeProps({ tags: ['@work'], onTagColorPickerOpen })} />,
    )
    fireEvent.contextMenu(screen.getByText('@work'))
    expect(onTagColorPickerOpen).toHaveBeenCalledWith(
      'work',
      // jsdom returns a DOMRect-shaped object (all zeros in unit tests)
      expect.objectContaining({ bottom: expect.any(Number), top: expect.any(Number) }),
    )
  })
})
