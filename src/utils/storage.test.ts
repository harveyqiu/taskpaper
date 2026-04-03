import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  loadFromStorage,
  saveContent,
  saveFilter,
  saveTagColors,
  loadTagColors,
  DEFAULT_CONTENT,
} from './storage'

// ----------------------------------------------------------------
// localStorage mock
// ----------------------------------------------------------------
let store: Record<string, string> = {}

const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value }),
  removeItem: vi.fn((key: string) => { delete store[key] }),
  clear: vi.fn(() => { store = {} }),
}

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

beforeEach(() => {
  store = {}
  vi.clearAllMocks()
  // Restore the implementations that read from / write to `store`
  localStorageMock.getItem.mockImplementation((key: string) => store[key] ?? null)
  localStorageMock.setItem.mockImplementation((key: string, value: string) => { store[key] = value })
  localStorageMock.clear.mockImplementation(() => { store = {} })
})

// ----------------------------------------------------------------
// DEFAULT_CONTENT
// ----------------------------------------------------------------
describe('DEFAULT_CONTENT', () => {
  it('contains the two default Chinese projects', () => {
    expect(DEFAULT_CONTENT).toContain('工作:')
    expect(DEFAULT_CONTENT).toContain('个人:')
  })
  it('contains @work and @home tags', () => {
    expect(DEFAULT_CONTENT).toContain('@work')
    expect(DEFAULT_CONTENT).toContain('@home')
  })
  it('contains @done on some tasks', () => {
    expect(DEFAULT_CONTENT).toContain('@done')
  })
})

// ----------------------------------------------------------------
// loadFromStorage
// ----------------------------------------------------------------
describe('loadFromStorage', () => {
  it('returns DEFAULT_CONTENT when localStorage is empty', () => {
    expect(loadFromStorage().content).toBe(DEFAULT_CONTENT)
  })

  it('returns filter "all" when localStorage is empty', () => {
    expect(loadFromStorage().filter).toBe('all')
  })

  it('returns stored content when available', () => {
    store['taskpaper-lite:content'] = 'My tasks:\n\t- Item one'
    expect(loadFromStorage().content).toBe('My tasks:\n\t- Item one')
  })

  it('returns stored filter when available', () => {
    store['taskpaper-lite:filter'] = 'undone'
    expect(loadFromStorage().filter).toBe('undone')
  })

  it('returns stored tag colors', () => {
    store['taskpaper-lite:tag-colors'] = JSON.stringify({ work: '#ff0000' })
    expect(loadFromStorage().tagColors).toEqual({ work: '#ff0000' })
  })

  it('returns default tag colors when JSON is malformed', () => {
    store['taskpaper-lite:tag-colors'] = 'not-json{{{'
    expect(loadFromStorage().tagColors).toEqual({ p0: '#e03535' })
  })
})

// ----------------------------------------------------------------
// saveContent
// ----------------------------------------------------------------
describe('saveContent', () => {
  it('writes content to localStorage', () => {
    saveContent('Project:\n\t- Task')
    expect(store['taskpaper-lite:content']).toBe('Project:\n\t- Task')
  })

  it('round-trips through loadFromStorage', () => {
    const text = 'My Project:\n\t- A task @work'
    saveContent(text)
    expect(loadFromStorage().content).toBe(text)
  })
})

// ----------------------------------------------------------------
// saveFilter
// ----------------------------------------------------------------
describe('saveFilter', () => {
  it('writes filter to localStorage', () => {
    saveFilter('done')
    expect(store['taskpaper-lite:filter']).toBe('done')
  })

  it('round-trips all supported filter values', () => {
    for (const f of ['all', 'undone', 'done', '@work']) {
      store = {}
      saveFilter(f)
      expect(loadFromStorage().filter).toBe(f)
    }
  })
})

// ----------------------------------------------------------------
// saveTagColors / loadTagColors
// ----------------------------------------------------------------
describe('saveTagColors / loadTagColors', () => {
  it('saves and loads tag colors correctly', () => {
    const colors = { work: '#3b82f6', home: '#22c55e' }
    saveTagColors(colors)
    expect(loadTagColors()).toEqual(colors)
  })

  it('returns default colors when nothing is stored', () => {
    expect(loadTagColors()).toEqual({ p0: '#e03535' })
  })

  it('returns default colors when JSON is invalid', () => {
    store['taskpaper-lite:tag-colors'] = '{invalid json'
    expect(loadTagColors()).toEqual({ p0: '#e03535' })
  })

  it('handles empty color map', () => {
    saveTagColors({})
    expect(loadTagColors()).toEqual({})
  })
})
