import { useEffect, useRef, useState } from 'react'

interface TagColorPickerProps {
  tagName: string
  anchorRect: DOMRect
  currentColor: string
  presets: string[]
  onColorChange: (tagName: string, color: string | null) => void
  onClose: () => void
}

export function TagColorPicker({
  tagName,
  anchorRect,
  currentColor,
  presets,
  onColorChange,
  onClose,
}: TagColorPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null)
  const [left, setLeft] = useState(anchorRect.left)
  const top = anchorRect.bottom + 4

  // Clamp to viewport after mount
  useEffect(() => {
    if (!pickerRef.current) return
    const pr = pickerRef.current.getBoundingClientRect()
    if (pr.right > window.innerWidth - 8) {
      setLeft(window.innerWidth - pr.width - 8)
    }
    // Close on outside click
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    setTimeout(() => document.addEventListener('click', handler, { once: true }), 0)
    return () => document.removeEventListener('click', handler)
  }, [onClose])

  return (
    <div
      ref={pickerRef}
      className="tag-color-picker"
      style={{ top, left }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="tcp-title">@{tagName} 颜色</div>

      <div className="tcp-swatches">
        {presets.map((color) => (
          <div
            key={color}
            className={`tcp-swatch${currentColor === color ? ' selected' : ''}`}
            style={{ background: color }}
            title={color}
            onClick={() => onColorChange(tagName, color)}
          />
        ))}
      </div>

      <div className="tcp-row">
        <input
          type="color"
          defaultValue={currentColor || '#e03535'}
          title="自定义颜色"
          onChange={(e) => onColorChange(tagName, e.target.value)}
        />
        <span>自定义颜色</span>
      </div>

      <button
        className="tcp-clear"
        onClick={() => onColorChange(tagName, null)}
      >
        清除颜色
      </button>
    </div>
  )
}
