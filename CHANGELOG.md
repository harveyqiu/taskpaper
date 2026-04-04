# Changelog

All notable changes to TaskPaper Lite are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added
- **合并导入**：导入 `.taskpaper` 文件时，将内容追加到现有内容末尾，而非替换 (2026-04-04)
- **自定义行高**：工具栏新增行高调节控件（− / + 按钮），范围 1.0–3.0，默认 1.7，设置持久化到 localStorage (2026-04-04)
- `@today` tag: marks a task as due today; lines with `@today` get a green left-accent bar and default green color (2026-04-03)
- `@date(YYYY-MM-DD)` tag: marks a task with a specific date; lines with `@date(...)` get a blue left-accent bar (2026-04-03)
- **日期视图** panel: click "📅 日期" in the toolbar to open a sidebar showing all dated tasks grouped into 过期 / 今天 / 未来 sections, sorted by date; click any task to jump to it in the editor (2026-04-03)
- Date view auto-refreshes when content changes while the panel is open (2026-04-03)

---

## [0.3.0] - React Rewrite

### Added
- Full rewrite in **React 19 + Vite 6 + TanStack Router + Tailwind CSS v4**
- Unit and component tests via **Vitest** (parser, storage, Toolbar, TagColorPicker)
- End-to-end tests via **Playwright** (30 tests covering load, typing, Cmd+D, filters, search, indent, import/export, persistence)
- `TagColorPicker` component — right-click any tag button to assign a custom color from presets
- Custom tag colors persisted to `localStorage` and injected as dynamic CSS rules

---

## [0.2.0] - Tag Filtering & Colors

### Added
- Tag filter buttons auto-discovered from document content; click to show only lines with that tag
- Support for quoted tag syntax `@"tagname"` (e.g. `@"p0"`)
- `@p0` (and `@"p0"`) lines highlighted in red when not done; done lines remain muted gray
- Right-click tag button → color picker to set a custom color per tag (persisted to `localStorage`)

### Fixed
- Correct red highlighting for `@p0` in plain (non-quoted) tag format

---

## [0.1.0] - Initial Release

### Added
- **TaskPaper format** support: projects (lines ending with `:`), tasks (`\t- `), notes (indented lines), tags (`@tagname`)
- `@done` toggle on the current line via `Cmd+D` / `Ctrl+D`; works on any line type
- **Filter bar**: All / Active / Done views
- **Full-text search** with highlighted match overlays; navigate matches with `Enter` / `Shift+Enter`; `Esc` clears search and refocuses editor
- `Cmd+F` / `Ctrl+F` to focus search
- **Tab / Shift+Tab** to indent / unindent (single line or multi-line selection)
- `Cmd+]` / `Ctrl+]` and `Cmd+[` / `Ctrl+[` shortcuts for indent / unindent
- **Indent guide lines** rendered per indentation level actually in use
- Text color muted from indent level 3+ for visual hierarchy
- **Export** document to `.taskpaper` file; **import** from `.taskpaper` / `.txt` file
- Content, filter state, and tag colors persisted to `localStorage`
- Dark mode support via `prefers-color-scheme: dark`
