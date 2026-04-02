# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TaskPaper Lite is a single-file browser-based task manager supporting the TaskPaper format. The entire application lives in `index.html` — HTML, CSS, and JavaScript combined. There is no build process, no package manager, and no external dependencies.

**To run:** Open `index.html` in any modern web browser.

## Architecture

The application is structured within a single `index.html` file:

- **Lines 9–258**: CSS with custom properties for light/dark theming. Dark mode uses `@media (prefers-color-scheme: dark)`. Indent guides are rendered via CSS background gradients.
- **Lines 261–289**: HTML — a toolbar (search, filter buttons, import/export) and a `contenteditable` editor div with a highlight overlay sibling.
- **Lines 290–865**: JavaScript, organized as follows:

| Section | Lines | Purpose |
|---|---|---|
| State | 316–323 | Single `state` object: filter, searchQuery, tags, timers |
| DOM refs | 328–332 | Cached element references |
| Parser | 365–392 | Classifies each line as project/task/note/blank, tracks `@done` |
| DOM sync | 421–440 | Updates CSS classes on existing divs without touching content |
| Storage | 445–487 | localStorage load/save with 500ms debounce |
| Filtering | 492–528 | Hides/shows lines by status or @tag |
| Search | 533–585 | Highlight overlay using `Range` rectangles, updates on scroll/resize |
| Line actions | 590–633 | Cmd+D toggles `@done` on tasks |
| Event handlers | 640–786 | Input, paste normalization, keyboard shortcuts, IME guard |
| Import/Export | 814–838 | `.taskpaper` file download/upload |
| Init | 840–864 | DOMContentLoaded setup |

**Data flow:** User edits contenteditable → input event → parser re-classifies lines → DOM sync updates CSS classes → localStorage save debounce fires. Filtering and search run as separate passes over the classified lines.

## TaskPaper Format

- **Projects**: Lines ending with `:` — displayed in bold
- **Tasks**: Lines starting with `-` — toggle `@done` with Cmd+D
- **Notes**: Any other non-blank line under a project
- **Tags**: `@tagname` anywhere in a line; extracted into filter buttons

## Keyboard Shortcuts

- `Cmd+F`: Focus search
- `Cmd+D`: Toggle `@done` on selected task
- `Tab` / `Shift+Tab`: Indent / unindent
- `Cmd+]` / `Cmd+[`: Indent / unindent current line(s)
- `Esc`: Clear search

## Key Implementation Notes

- The editor is a `contenteditable` div. The parser wraps bare text nodes in `<div>` elements (structure normalization) before applying classes.
- IME composition (e.g., Chinese input) is guarded with `isComposing` to prevent double-processing.
- Search highlights are absolutely-positioned `<span>` elements rendered via `getBoundingClientRect` on `Range` objects, repositioned on scroll and resize.
- `@tag` names are auto-discovered from content and rendered as filter buttons dynamically.
- Default content on first load is in Chinese (see init section).
