import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TagColorPicker } from './TagColorPicker'
import { TAG_COLOR_PRESETS } from '../utils/parser'

const anchorRect = new DOMRect(100, 50, 80, 26)

function makeProps(overrides: Partial<Parameters<typeof TagColorPicker>[0]> = {}) {
  return {
    tagName: 'work',
    anchorRect,
    currentColor: '',
    presets: TAG_COLOR_PRESETS,
    onColorChange: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ----------------------------------------------------------------
// Rendering
// ----------------------------------------------------------------
describe('TagColorPicker rendering', () => {
  it('renders the tag name in the title', () => {
    render(<TagColorPicker {...makeProps()} />)
    expect(screen.getByText('@work 颜色')).toBeInTheDocument()
  })

  it('renders 8 color swatches', () => {
    render(<TagColorPicker {...makeProps()} />)
    expect(document.querySelectorAll('.tcp-swatch')).toHaveLength(8)
  })

  it('renders the custom color input', () => {
    render(<TagColorPicker {...makeProps()} />)
    expect(screen.getByTitle('自定义颜色')).toBeInTheDocument()
  })

  it('renders the clear button', () => {
    render(<TagColorPicker {...makeProps()} />)
    expect(screen.getByText('清除颜色')).toBeInTheDocument()
  })

  it('marks the current color swatch as selected', () => {
    render(<TagColorPicker {...makeProps({ currentColor: '#e03535' })} />)
    const selected = document.querySelector('.tcp-swatch.selected') as HTMLElement
    expect(selected).toBeTruthy()
    expect(selected.style.background).toBe('rgb(224, 53, 53)')
  })

  it('marks no swatch as selected when currentColor is empty', () => {
    render(<TagColorPicker {...makeProps({ currentColor: '' })} />)
    expect(document.querySelector('.tcp-swatch.selected')).toBeNull()
  })

  it('positions itself below the anchor rect', () => {
    render(<TagColorPicker {...makeProps()} />)
    const picker = document.querySelector('.tag-color-picker') as HTMLElement
    expect(picker.style.top).toBe(`${anchorRect.bottom + 4}px`)
  })
})

// ----------------------------------------------------------------
// Interactions
// ----------------------------------------------------------------
describe('TagColorPicker interactions', () => {
  it('calls onColorChange with the clicked preset color', async () => {
    const onColorChange = vi.fn()
    render(<TagColorPicker {...makeProps({ onColorChange })} />)
    const firstSwatch = document.querySelectorAll('.tcp-swatch')[0] as HTMLElement
    await userEvent.click(firstSwatch)
    expect(onColorChange).toHaveBeenCalledWith('work', TAG_COLOR_PRESETS[0])
  })

  it('calls onColorChange(tagName, null) when clear button is clicked', async () => {
    const onColorChange = vi.fn()
    render(<TagColorPicker {...makeProps({ onColorChange })} />)
    await userEvent.click(screen.getByText('清除颜色'))
    expect(onColorChange).toHaveBeenCalledWith('work', null)
  })

  it('uses the correct tagName in the title for different tags', () => {
    render(<TagColorPicker {...makeProps({ tagName: 'home' })} />)
    expect(screen.getByText('@home 颜色')).toBeInTheDocument()
  })
})
