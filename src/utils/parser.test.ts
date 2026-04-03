import { describe, it, expect } from 'vitest'
import {
  classifyLine,
  extractTags,
  extractTagNames,
  escapeHtml,
  getIndentLevel,
  TAG_COLOR_PRESETS,
} from './parser'

// ----------------------------------------------------------------
// classifyLine
// ----------------------------------------------------------------
describe('classifyLine', () => {
  describe('blank lines', () => {
    it('returns blank for empty string', () => {
      expect(classifyLine('')).toBe('blank')
    })
    it('returns blank for zero-width space', () => {
      expect(classifyLine('\u200B')).toBe('blank')
    })
    it('returns blank-done for top-level text with @done', () => {
      expect(classifyLine('some text @done')).toBe('blank-done')
    })
  })

  describe('project lines', () => {
    it('classifies line ending with colon as project', () => {
      expect(classifyLine('工作:')).toBe('project')
    })
    it('classifies project with trailing spaces', () => {
      expect(classifyLine('Work:  ')).toBe('project')
    })
    it('classifies project with @done as project-done', () => {
      expect(classifyLine('Old Project: @done')).toBe('project-done')
    })
    it('does not classify indented colon-line as project', () => {
      expect(classifyLine('\t- Some task: with colon')).toBe('task')
    })
  })

  describe('task lines', () => {
    it('classifies tab-indented dash as task', () => {
      expect(classifyLine('\t- Buy groceries')).toBe('task')
    })
    it('classifies 4-space-indented dash as task', () => {
      expect(classifyLine('    - Buy groceries')).toBe('task')
    })
    it('classifies task with @done as task-done', () => {
      expect(classifyLine('\t- Buy groceries @done')).toBe('task-done')
    })
    it('does not classify line without space after dash as task', () => {
      expect(classifyLine('\t-No space')).toBe('note')
    })
    it('classifies task with @done in middle as task-done', () => {
      expect(classifyLine('\t- Do thing @done more text')).toBe('task-done')
    })
  })

  describe('note lines', () => {
    it('classifies tab-indented non-task as note', () => {
      expect(classifyLine('\tJust a note')).toBe('note')
    })
    it('classifies space-indented non-task as note', () => {
      expect(classifyLine('  A note with spaces')).toBe('note')
    })
    it('classifies note with @done as note-done', () => {
      expect(classifyLine('\tSome note @done')).toBe('note-done')
    })
    it('handles multi-level indented note', () => {
      expect(classifyLine('\t\tDeep note')).toBe('note')
    })
  })

  describe('@done detection', () => {
    it('detects @done at end of line', () => {
      expect(classifyLine('\t- Task @done')).toBe('task-done')
    })
    it('detects @done in the middle', () => {
      expect(classifyLine('\t- Task @done extra')).toBe('task-done')
    })
    it('does not match @doneness (partial)', () => {
      expect(classifyLine('\t- Task @doneness')).toBe('task')
    })
    it('detects @done at start with leading whitespace', () => {
      expect(classifyLine('\t- @done task')).toBe('task-done')
    })
  })
})

// ----------------------------------------------------------------
// extractTags
// ----------------------------------------------------------------
describe('extractTags', () => {
  it('returns empty array for text without tags', () => {
    expect(extractTags('No tags here')).toEqual([])
  })
  it('extracts a single tag', () => {
    expect(extractTags('Task @work')).toEqual(['@work'])
  })
  it('extracts multiple tags', () => {
    expect(extractTags('Task @work @today')).toEqual(['@today', '@work'])
  })
  it('returns tags sorted alphabetically', () => {
    expect(extractTags('Task @zzz @aaa @mmm')).toEqual(['@aaa', '@mmm', '@zzz'])
  })
  it('excludes @done', () => {
    expect(extractTags('\t- Task @work @done')).toEqual(['@work'])
  })
  it('deduplicates repeated tags', () => {
    expect(extractTags('Task @work and more @work')).toEqual(['@work'])
  })
  it('extracts tags with underscores and hyphens', () => {
    expect(extractTags('Task @my_tag @some-tag')).toEqual(['@my_tag', '@some-tag'])
  })
  it('extracts Chinese character tags', () => {
    expect(extractTags('任务 @工作')).toEqual(['@工作'])
  })
  it('does not match @done at word boundary', () => {
    expect(extractTags('Task @doneness')).toEqual(['@doneness'])
  })
  it('handles tags at the start of text', () => {
    expect(extractTags('@work task')).toEqual(['@work'])
  })
})

// ----------------------------------------------------------------
// extractTagNames
// ----------------------------------------------------------------
describe('extractTagNames', () => {
  it('returns empty array for no tags', () => {
    expect(extractTagNames('No tags')).toEqual([])
  })
  it('returns names without @ prefix', () => {
    expect(extractTagNames('Task @work @today')).toEqual(['work', 'today'])
  })
  it('excludes done from tag names', () => {
    expect(extractTagNames('\t- Task @work @done')).toEqual(['work'])
  })
  it('preserves order (unlike extractTags which sorts)', () => {
    expect(extractTagNames('Task @zzz @aaa')).toEqual(['zzz', 'aaa'])
  })
  it('includes duplicates (used for data-ptags attribute)', () => {
    expect(extractTagNames('Task @work @work')).toEqual(['work', 'work'])
  })
})

// ----------------------------------------------------------------
// escapeHtml
// ----------------------------------------------------------------
describe('escapeHtml', () => {
  it('escapes ampersand', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b')
  })
  it('escapes less-than', () => {
    expect(escapeHtml('a < b')).toBe('a &lt; b')
  })
  it('escapes greater-than', () => {
    expect(escapeHtml('a > b')).toBe('a &gt; b')
  })
  it('escapes all three in one string', () => {
    expect(escapeHtml('<p>a & b</p>')).toBe('&lt;p&gt;a &amp; b&lt;/p&gt;')
  })
  it('returns plain text unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world')
  })
  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('')
  })
})

// ----------------------------------------------------------------
// getIndentLevel
// ----------------------------------------------------------------
describe('getIndentLevel', () => {
  it('returns 0 for no indentation', () => {
    expect(getIndentLevel('Project:')).toBe(0)
  })
  it('returns 1 for single tab', () => {
    expect(getIndentLevel('\t- Task')).toBe(1)
  })
  it('returns 2 for double tab', () => {
    expect(getIndentLevel('\t\t- SubTask')).toBe(2)
  })
  it('returns 1 for 4 spaces', () => {
    expect(getIndentLevel('    - Task')).toBe(1)
  })
  it('returns 2 for 8 spaces', () => {
    expect(getIndentLevel('        - Task')).toBe(2)
  })
  it('stops counting at non-indent characters', () => {
    expect(getIndentLevel('\t  text')).toBe(1) // tab counts, then spaces don't add a full level
  })
  it('returns 0 for empty string', () => {
    expect(getIndentLevel('')).toBe(0)
  })
  it('returns 3 for three tabs', () => {
    expect(getIndentLevel('\t\t\tDeep')).toBe(3)
  })
})

// ----------------------------------------------------------------
// TAG_COLOR_PRESETS
// ----------------------------------------------------------------
describe('TAG_COLOR_PRESETS', () => {
  it('exports 8 preset colors', () => {
    expect(TAG_COLOR_PRESETS).toHaveLength(8)
  })
  it('all presets are valid hex colors', () => {
    for (const color of TAG_COLOR_PRESETS) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})
