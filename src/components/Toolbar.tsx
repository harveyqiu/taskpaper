import { RefObject } from 'react'

interface ToolbarProps {
  filter: string
  searchQuery: string
  tags: string[]
  tagColors: Record<string, string>
  matchTotal: number
  matchCurrent: number
  searchInputRef: RefObject<HTMLInputElement | null>
  fileInputRef: RefObject<HTMLInputElement | null>
  onFilterChange: (filter: string) => void
  onSearchChange: (query: string) => void
  onSearchClear: () => void
  onSearchNavigate: (dir: number) => void
  onSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onExport: () => void
  onImport: (file: File) => void
  onTagColorPickerOpen: (tagName: string, anchorRect: DOMRect) => void
  TAG_COLOR_PRESETS: string[]
}

export function Toolbar({
  filter,
  searchQuery,
  tags,
  tagColors,
  matchTotal,
  matchCurrent,
  searchInputRef,
  fileInputRef,
  onFilterChange,
  onSearchChange,
  onSearchClear,
  onSearchNavigate,
  onSearchKeyDown,
  onExport,
  onImport,
  onTagColorPickerOpen,
}: ToolbarProps) {
  const hasMatches = matchTotal > 0

  const matchText = searchQuery.trim()
    ? matchTotal === 0
      ? '无匹配'
      : `${matchCurrent}/${matchTotal}`
    : ''

  return (
    <div
      id="toolbar"
      className="flex items-center gap-2 flex-shrink-0 overflow-x-auto overflow-y-hidden"
      style={{
        height: 'var(--toolbar-h)',
        background: 'var(--bg-toolbar)',
        borderBottom: '1px solid var(--border)',
        fontFamily: 'var(--font-ui)',
        padding: '0 14px',
      }}
    >
      {/* Search */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <input
          ref={searchInputRef}
          id="search-input"
          type="text"
          placeholder="搜索… (Cmd+F)"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={onSearchKeyDown}
          style={{
            width: 200,
            height: 28,
            padding: '0 8px',
            border: '1px solid var(--border)',
            borderRadius: 5,
            background: 'var(--bg-input)',
            color: 'var(--fg)',
            fontFamily: 'var(--font-ui)',
            fontSize: 13,
            outline: 'none',
            transition: 'border-color 0.15s',
          }}
          onFocus={(e) =>
            ((e.target as HTMLInputElement).style.borderColor = 'var(--accent)')
          }
          onBlur={(e) =>
            ((e.target as HTMLInputElement).style.borderColor = 'var(--border)')
          }
        />
        <span
          id="match-count"
          style={{
            fontSize: 11,
            color: 'var(--fg-muted)',
            whiteSpace: 'nowrap',
            minWidth: 48,
          }}
        >
          {matchText}
        </span>
        <button
          id="search-prev"
          className="search-nav-btn"
          title="上一个 (Shift+Enter)"
          disabled={!hasMatches}
          onClick={() => onSearchNavigate(-1)}
        >
          ↑
        </button>
        <button
          id="search-next"
          className="search-nav-btn"
          title="下一个 (Enter)"
          disabled={!hasMatches}
          onClick={() => onSearchNavigate(1)}
        >
          ↓
        </button>
        <button
          id="search-clear"
          title="清空搜索 (Esc)"
          onClick={onSearchClear}
          style={{
            width: 22,
            height: 22,
            border: 'none',
            background: 'none',
            color: 'var(--fg-muted)',
            fontSize: 13,
            cursor: 'pointer',
            borderRadius: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            lineHeight: 1,
          }}
          onMouseEnter={(e) => {
            const t = e.target as HTMLButtonElement
            t.style.color = 'var(--fg)'
            t.style.background = 'var(--border)'
          }}
          onMouseLeave={(e) => {
            const t = e.target as HTMLButtonElement
            t.style.color = 'var(--fg-muted)'
            t.style.background = 'none'
          }}
        >
          ✕
        </button>
      </div>

      {/* Separator */}
      <div
        style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }}
      />

      {/* Filter buttons */}
      <div className="flex items-center gap-1 flex-nowrap" id="filter-bar">
        {(['all', 'undone', 'done'] as const).map((f) => (
          <button
            key={f}
            className={`filter-btn${filter === f ? ' active' : ''}`}
            data-filter={f}
            onClick={() => onFilterChange(f)}
          >
            {f === 'all' ? '全部' : f === 'undone' ? '未完成' : '已完成'}
          </button>
        ))}

        {tags.map((tag) => {
          const tagName = tag.replace(/^@/, '')
          const color = tagColors[tagName]
          return (
            <button
              key={tag}
              className={`filter-btn${filter === tag ? ' active' : ''}`}
              data-filter={tag}
              data-tag={tag}
              title="右键设置颜色"
              onClick={() => onFilterChange(tag)}
              onContextMenu={(e) => {
                e.preventDefault()
                const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
                onTagColorPickerOpen(tagName, rect)
              }}
            >
              {color && (
                <span
                  className="tag-color-dot"
                  style={{ background: color }}
                />
              )}
              {tag}
            </button>
          )
        })}
      </div>

      {/* Separator */}
      <div
        style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }}
      />

      {/* Export / Import */}
      <button
        id="btn-export"
        className="filter-btn"
        title="导出 .taskpaper 文件"
        onClick={onExport}
      >
        导出
      </button>
      <button
        id="btn-import"
        className="filter-btn"
        title="导入 .taskpaper 文件"
        onClick={() => fileInputRef.current?.click()}
      >
        导入
      </button>
      <input
        ref={fileInputRef}
        id="file-input"
        type="file"
        accept=".taskpaper,.txt"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onImport(file)
          ;(e.target as HTMLInputElement).value = ''
        }}
      />
    </div>
  )
}
