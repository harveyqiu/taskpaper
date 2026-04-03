import { useCallback, useEffect, useRef, useState } from 'react'
import {
  classifyLine,
  escapeHtml,
  extractDate,
  extractTagNames,
  extractTags,
  getIndentLevel,
  TAG_COLOR_PRESETS,
} from '../utils/parser'
import {
  DEFAULT_CONTENT,
  loadFromStorage,
  loadTagColors,
  saveContent,
  saveFilter,
  saveTagColors,
} from '../utils/storage'
import { Editor } from './Editor'
import { TagColorPicker } from './TagColorPicker'
import { Toolbar } from './Toolbar'

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------
interface SearchMatch {
  textNode: Text
  start: number
  end: number
}

interface TagColorPickerState {
  tagName: string
  anchorRect: DOMRect
}

interface DateTask {
  text: string
  date: string   // ISO YYYY-MM-DD
  lineIndex: number
}

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------
export function TaskPaperApp() {
  // React state — drives toolbar re-renders only
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagColors, setTagColors] = useState<Record<string, string>>({})
  const [matchTotal, setMatchTotal] = useState(0)
  const [matchCurrent, setMatchCurrent] = useState(0) // 1-based, 0 = none
  const [tagColorPicker, setTagColorPicker] = useState<TagColorPickerState | null>(null)
  const [showDateView, setShowDateView] = useState(false)
  const [dateTasks, setDateTasks] = useState<DateTask[]>([])

  // DOM refs
  const editorRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Mutable imperative state (never causes re-renders)
  const imp = useRef({
    filter: 'all',
    searchQuery: '',
    tagColors: {} as Record<string, string>,
    matches: [] as SearchMatch[],
    matchIndex: -1,
    saveTimer: null as ReturnType<typeof setTimeout> | null,
    hlTimer: null as number | null,
    hasBareNodes: false,
    scrollingToMatch: false,
    isComposing: false,
    showDateView: false,
  })

  // ----------------------------------------------------------------
  // Imperative helper: get editor element (only call client-side)
  // ----------------------------------------------------------------
  const editor = useCallback(() => editorRef.current!, [])
  const overlay = useCallback(() => overlayRef.current!, [])

  // ----------------------------------------------------------------
  // Structure helpers
  // ----------------------------------------------------------------
  const getTextNode = useCallback((div: Element): Text | null => {
    for (let c = div.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3) return c as Text
    }
    return null
  }, [])

  const getLineDivFromNode = useCallback(
    (node: Node | null): HTMLElement | null => {
      if (!node) return null
      const ed = editor()
      let n: Element | null = node.nodeType === 3 ? (node as Text).parentElement : (node as Element)
      while (n && n.parentElement !== ed) n = n.parentElement
      return n && n.parentElement === ed ? (n as HTMLElement) : null
    },
    [editor],
  )

  // ----------------------------------------------------------------
  // Tag color styles injected into <style id="tag-color-styles">
  // ----------------------------------------------------------------
  const applyTagColorStyles = useCallback((colors: Record<string, string>) => {
    const styleEl = document.getElementById('tag-color-styles')
    if (!styleEl) return
    const notDone =
      ':not(.line-task-done):not(.line-note-done):not(.line-project-done):not(.line-blank-done)'
    const rules = Object.entries(colors).map(
      ([tag, color]) =>
        `.editor-pane > div[data-ptags~="${tag}"]${notDone} { color: ${color} !important; }`,
    )
    styleEl.textContent = rules.join('\n')
  }, [])

  // ----------------------------------------------------------------
  // Structure normalisation (wrap bare text / <br> nodes in <div>)
  // ----------------------------------------------------------------
  const normalizeEditorStructure = useCallback(() => {
    const ed = editor()
    if (imp.current.hasBareNodes) {
      imp.current.hasBareNodes = false
      for (const node of Array.from(ed.childNodes)) {
        if (node.nodeType === 3 || (node as Element).nodeName === 'BR') {
          const div = document.createElement('div')
          ed.insertBefore(div, node)
          div.appendChild(node)
        }
      }
    }
    for (const div of ed.children) {
      if (div.textContent === '' && !div.querySelector('br')) {
        div.innerHTML = '<br>'
      }
    }
  }, [editor])

  // ----------------------------------------------------------------
  // DOM sync: update className + data attrs on each line div
  // ----------------------------------------------------------------
  const syncEditorClasses = useCallback(() => {
    normalizeEditorStructure()
    for (const div of editor().children) {
      const type = classifyLine(div.textContent ?? '')
      const cls = 'line-' + type
      if (div.className.replace(' line-hidden', '') !== cls) {
        const hidden = div.classList.contains('line-hidden')
        div.className = cls + (hidden ? ' line-hidden' : '')
      }
      const ptags = extractTagNames(div.textContent ?? '')
      if (ptags.length > 0) {
        ;(div as HTMLElement).dataset.ptags = ptags.join(' ')
      } else {
        delete (div as HTMLElement).dataset.ptags
      }
    }
    updateIndentGuides()
  }, [editor, normalizeEditorStructure])

  // ----------------------------------------------------------------
  // Indent guides: measure tab width + update CSS vars
  // ----------------------------------------------------------------
  const updateIndentGuides = useCallback(() => {
    const ed = editor()
    let maxLevel = 0
    for (const div of ed.children) {
      const level = getIndentLevel(div.textContent ?? '')
      ;(div as HTMLElement).dataset.indent = String(level)
      if (level > maxLevel) maxLevel = level
    }
    const tabPx = parseFloat(ed.style.getPropertyValue('--tab-px')) || 28
    ed.style.setProperty('--max-indent-px', maxLevel * tabPx + 'px')
  }, [editor])

  const updateTabWidth = useCallback(() => {
    const ed = editor()
    const style = getComputedStyle(ed)
    const probe = document.createElement('span')
    probe.style.cssText =
      `position:absolute;visibility:hidden;white-space:pre;` +
      `font-family:${style.fontFamily};font-size:${style.fontSize};tab-size:4;`
    probe.textContent = '\t'
    document.body.appendChild(probe)
    const w = probe.getBoundingClientRect().width
    document.body.removeChild(probe)
    ed.style.setProperty('--tab-px', w + 'px')
    updateIndentGuides()
  }, [editor, updateIndentGuides])

  // ----------------------------------------------------------------
  // Load content into editor DOM (called on init and after import)
  // ----------------------------------------------------------------
  const loadContentIntoEditor = useCallback(
    (text: string) => {
      const lines = text.split('\n')
      while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
      editor().innerHTML = lines
        .map((line) => {
          const cls = 'line-' + classifyLine(line)
          const content = escapeHtml(line)
          const ptags = extractTagNames(line)
          const ptagAttr = ptags.length > 0 ? ` data-ptags="${ptags.join(' ')}"` : ''
          return `<div class="${cls}"${ptagAttr}>${content || '<br>'}</div>`
        })
        .join('')
    },
    [editor],
  )

  // ----------------------------------------------------------------
  // Filter: add/remove line-hidden class
  // ----------------------------------------------------------------
  const applyFilter = useCallback(
    (f: string) => {
      for (const div of editor().children) {
        const baseClass = div.className.replace(' line-hidden', '').trim()
        let hide = false
        const isProject = baseClass === 'line-project' || baseClass === 'line-project-done'
        if (isProject) {
          hide = false
        } else if (f === 'all') {
          hide = false
        } else if (f === 'undone') {
          hide = baseClass.endsWith('-done')
        } else if (f === 'done') {
          hide = !baseClass.endsWith('-done')
        } else {
          // @tag filter
          const text = div.textContent ?? ''
          const tagRe = new RegExp(
            '(?:^|\\s)' + f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:\\s|$)',
          )
          hide = !tagRe.test(text)
        }
        if (hide) div.classList.add('line-hidden')
        else div.classList.remove('line-hidden')
      }
    },
    [editor],
  )

  // ----------------------------------------------------------------
  // Search highlight overlay
  // ----------------------------------------------------------------
  const renderHighlights = useCallback(() => {
    const ed = editor()
    const ov = overlay()
    ov.innerHTML = ''
    const query = imp.current.searchQuery.trim()
    if (!query) {
      imp.current.matches = []
      imp.current.matchIndex = -1
      setMatchTotal(0)
      setMatchCurrent(0)
      return
    }

    const lowerQuery = query.toLowerCase()
    const queryLen = query.length
    const newMatches: SearchMatch[] = []

    for (const div of ed.children) {
      if (div.classList.contains('line-hidden')) continue
      const textNode = getTextNode(div)
      if (!textNode) continue
      const lowerText = textNode.textContent?.toLowerCase() ?? ''
      let idx = 0
      while ((idx = lowerText.indexOf(lowerQuery, idx)) !== -1) {
        newMatches.push({ textNode, start: idx, end: idx + queryLen })
        idx += queryLen
      }
    }

    imp.current.matches = newMatches

    if (newMatches.length === 0) {
      imp.current.matchIndex = -1
    } else if (imp.current.matchIndex < 0 || imp.current.matchIndex >= newMatches.length) {
      imp.current.matchIndex = 0
    }

    if (imp.current.matchIndex >= 0) scrollToMatch()

    const editorRect = ed.getBoundingClientRect()
    const scrollTop = ed.scrollTop
    const scrollLeft = ed.scrollLeft
    const range = document.createRange()
    const frag = document.createDocumentFragment()

    for (let i = 0; i < newMatches.length; i++) {
      const m = newMatches[i]
      try {
        range.setStart(m.textNode, m.start)
        range.setEnd(m.textNode, m.end)
        const rects = range.getClientRects()
        for (const r of rects) {
          const el = document.createElement('div')
          el.className = i === imp.current.matchIndex ? 'hl-rect hl-current' : 'hl-rect'
          el.style.top = r.top - editorRect.top + scrollTop + 'px'
          el.style.left = r.left - editorRect.left + scrollLeft + 'px'
          el.style.width = r.width + 'px'
          el.style.height = r.height + 'px'
          frag.appendChild(el)
        }
      } catch {
        // skip invalid range
      }
    }

    ov.appendChild(frag)
    const total = newMatches.length
    setMatchTotal(total)
    setMatchCurrent(total === 0 ? 0 : imp.current.matchIndex + 1)
  }, [editor, overlay, getTextNode])

  const scrollToMatch = useCallback(() => {
    const m = imp.current.matches[imp.current.matchIndex]
    if (!m) return
    const ed = editor()
    try {
      const range = document.createRange()
      range.setStart(m.textNode, m.start)
      range.setEnd(m.textNode, m.end)
      const rect = range.getBoundingClientRect()
      const editorRect = ed.getBoundingClientRect()
      const topRel = rect.top - editorRect.top + ed.scrollTop
      const bottomRel = rect.bottom - editorRect.top + ed.scrollTop
      const margin = 60
      if (topRel - margin < ed.scrollTop) {
        imp.current.scrollingToMatch = true
        ed.scrollTop = Math.max(0, topRel - margin)
      } else if (bottomRel + margin > ed.scrollTop + ed.clientHeight) {
        imp.current.scrollingToMatch = true
        ed.scrollTop = bottomRel + margin - ed.clientHeight
      }
    } catch {
      // ignore
    }
  }, [editor])

  const scheduleHighlights = useCallback(() => {
    if (imp.current.hlTimer !== null) cancelAnimationFrame(imp.current.hlTimer)
    imp.current.hlTimer = requestAnimationFrame(renderHighlights)
  }, [renderHighlights])

  const navigateMatch = useCallback(
    (dir: number) => {
      if (!imp.current.matches.length) return
      if (imp.current.matchIndex < 0) {
        imp.current.matchIndex = dir > 0 ? 0 : imp.current.matches.length - 1
      } else {
        imp.current.matchIndex =
          (imp.current.matchIndex + dir + imp.current.matches.length) %
          imp.current.matches.length
      }
      renderHighlights()
    },
    [renderHighlights],
  )

  // ----------------------------------------------------------------
  // Auto-save with debounce
  // ----------------------------------------------------------------
  const scheduleAutoSave = useCallback(() => {
    if (imp.current.saveTimer !== null) clearTimeout(imp.current.saveTimer)
    imp.current.saveTimer = setTimeout(() => {
      const text = Array.from(editor().children)
        .map((d) => d.textContent ?? '')
        .join('\n')
      saveContent(text)
      const newTags = extractTags(text)
      setTags((prev) => {
        if (JSON.stringify(newTags) !== JSON.stringify(prev)) return newTags
        return prev
      })
      if (imp.current.showDateView) {
        const today = new Date().toISOString().split('T')[0]
        const tasks: DateTask[] = []
        Array.from(editor().children).forEach((div, i) => {
          const date = extractDate(div.textContent ?? '', today)
          if (date !== null) tasks.push({ text: (div.textContent ?? '').trim(), date, lineIndex: i })
        })
        setDateTasks(tasks)
      }
    }, 500)
  }, [editor])

  // ----------------------------------------------------------------
  // Cmd+D: toggle @done on current line
  // ----------------------------------------------------------------
  const toggleDoneOnCurrentLine = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return
    const range = sel.getRangeAt(0)
    const lineDiv = getLineDivFromNode(range.startContainer)
    if (!lineDiv) return

    const text = lineDiv.textContent ?? ''
    if (!text || text === '\u200B') return

    const hasDone = /(?:^|\s)@done(?:\s|$)/.test(text)
    const newText = hasDone ? text.replace(/\s*@done/, '') : text.trimEnd() + ' @done'

    const textNode = getTextNode(lineDiv)
    const cursorOffset =
      textNode && range.startContainer === textNode
        ? range.startOffset
        : Math.min(range.startOffset, newText.length)

    const replaceRange = document.createRange()
    if (textNode) {
      replaceRange.setStart(textNode, 0)
      replaceRange.setEnd(textNode, textNode.length)
    } else {
      replaceRange.selectNodeContents(lineDiv)
    }
    sel.removeAllRanges()
    sel.addRange(replaceRange)
    document.execCommand('insertText', false, newText || '\u200B')

    const newTextNode = getTextNode(lineDiv)
    if (newTextNode) {
      const clampedOffset = Math.min(cursorOffset, newTextNode.length)
      const newRange = document.createRange()
      newRange.setStart(newTextNode, clampedOffset)
      newRange.collapse(true)
      sel.removeAllRanges()
      sel.addRange(newRange)
    }

    syncEditorClasses()
    applyFilter(imp.current.filter)
    scheduleAutoSave()
    if (imp.current.searchQuery) scheduleHighlights()
  }, [
    getLineDivFromNode,
    getTextNode,
    syncEditorClasses,
    applyFilter,
    scheduleAutoSave,
    scheduleHighlights,
  ])

  // ----------------------------------------------------------------
  // Import / Export
  // ----------------------------------------------------------------
  const exportFile = useCallback(() => {
    const text = Array.from(editor().children)
      .map((d) => d.textContent ?? '')
      .join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'tasks.taskpaper'
    a.click()
    URL.revokeObjectURL(url)
  }, [editor])

  const importFile = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = (e.target?.result as string) ?? ''
        loadContentIntoEditor(text)
        saveContent(text)
        const newTags = extractTags(text)
        setTags(newTags)
        applyFilter(imp.current.filter)
        updateIndentGuides()
        if (imp.current.searchQuery) scheduleHighlights()
      }
      reader.readAsText(file, 'UTF-8')
    },
    [loadContentIntoEditor, applyFilter, updateIndentGuides, scheduleHighlights],
  )

  // ----------------------------------------------------------------
  // Tag color management
  // ----------------------------------------------------------------
  const handleTagColorChange = useCallback(
    (tagName: string, color: string | null) => {
      setTagColors((prev) => {
        const next = { ...prev }
        if (color) next[tagName] = color
        else delete next[tagName]
        imp.current.tagColors = next
        saveTagColors(next)
        applyTagColorStyles(next)
        return next
      })
      setTagColorPicker(null)
    },
    [applyTagColorStyles],
  )

  const handleTagColorPickerOpen = useCallback((tagName: string, anchorRect: DOMRect) => {
    setTagColorPicker({ tagName, anchorRect })
  }, [])

  // ----------------------------------------------------------------
  // Filter change (from toolbar)
  // ----------------------------------------------------------------
  const handleFilterChange = useCallback(
    (f: string) => {
      imp.current.filter = f
      setFilter(f)
      saveFilter(f)
      applyFilter(f)
    },
    [applyFilter],
  )

  // ----------------------------------------------------------------
  // Date view
  // ----------------------------------------------------------------
  const handleDateViewToggle = useCallback(() => {
    const next = !imp.current.showDateView
    imp.current.showDateView = next
    setShowDateView(next)
    if (next) {
      const today = new Date().toISOString().split('T')[0]
      const tasks: DateTask[] = []
      Array.from(editor().children).forEach((div, i) => {
        const date = extractDate(div.textContent ?? '', today)
        if (date !== null) tasks.push({ text: (div.textContent ?? '').trim(), date, lineIndex: i })
      })
      setDateTasks(tasks)
    }
  }, [editor])

  const scrollToLine = useCallback(
    (lineIndex: number) => {
      const div = editor().children[lineIndex] as HTMLElement | undefined
      if (!div) return
      div.scrollIntoView({ block: 'center', behavior: 'smooth' })
      editor().focus()
      const sel = window.getSelection()
      if (sel) {
        const range = document.createRange()
        range.selectNodeContents(div)
        range.collapse(false)
        sel.removeAllRanges()
        sel.addRange(range)
      }
    },
    [editor],
  )

  // ----------------------------------------------------------------
  // Search change (from toolbar)
  // ----------------------------------------------------------------
  const handleSearchChange = useCallback(
    (q: string) => {
      imp.current.searchQuery = q
      setSearchQuery(q)
      scheduleHighlights()
    },
    [scheduleHighlights],
  )

  const handleSearchClear = useCallback(() => {
    imp.current.searchQuery = ''
    setSearchQuery('')
    renderHighlights()
    editor().focus()
  }, [renderHighlights, editor])

  const handleSearchNavigate = useCallback(
    (dir: number) => {
      navigateMatch(dir)
    },
    [navigateMatch],
  )

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        handleSearchClear()
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        navigateMatch(e.shiftKey ? -1 : 1)
      }
    },
    [handleSearchClear, navigateMatch],
  )

  // ----------------------------------------------------------------
  // Init effect: load data, attach imperative event listeners
  // ----------------------------------------------------------------
  useEffect(() => {
    const ed = editorRef.current
    const ov = overlayRef.current
    if (!ed || !ov) return

    // MutationObserver for bare-node detection
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const n of m.addedNodes) {
          if (n.nodeType === 3 || (n as Element).nodeName === 'BR') {
            imp.current.hasBareNodes = true
            return
          }
        }
      }
    })
    observer.observe(ed, { childList: true })

    // Load from storage
    const stored = loadFromStorage()
    imp.current.filter = stored.filter
    imp.current.tagColors = stored.tagColors
    setFilter(stored.filter)
    setTagColors(stored.tagColors)

    loadContentIntoEditor(stored.content)
    applyTagColorStyles(stored.tagColors)
    updateTabWidth()
    updateIndentGuides()

    const newTags = extractTags(stored.content)
    setTags(newTags)
    applyFilter(stored.filter)

    ed.focus()
    // Cursor to end
    const sel = window.getSelection()
    if (sel && ed.lastChild) {
      const r = document.createRange()
      r.selectNodeContents(ed.lastChild)
      r.collapse(false)
      sel.removeAllRanges()
      sel.addRange(r)
    }

    // ---- Editor event listeners ----
    const onCompositionStart = () => {
      imp.current.isComposing = true
    }
    const onCompositionEnd = () => {
      imp.current.isComposing = false
      syncEditorClasses()
      applyFilter(imp.current.filter)
      scheduleAutoSave()
      if (imp.current.searchQuery) scheduleHighlights()
    }
    const onInput = () => {
      if (imp.current.isComposing) return
      syncEditorClasses()
      applyFilter(imp.current.filter)
      scheduleAutoSave()
      if (imp.current.searchQuery) scheduleHighlights()
    }
    const onPaste = (e: ClipboardEvent) => {
      e.preventDefault()
      const text = e.clipboardData?.getData('text/plain') ?? ''
      if (text) document.execCommand('insertText', false, text)
    }
    const onScroll = () => {
      if (imp.current.scrollingToMatch) {
        imp.current.scrollingToMatch = false
        return
      }
      if (imp.current.searchQuery) scheduleHighlights()
    }

    // Tab / Shift+Tab
    const onKeyDownTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      e.preventDefault()
      const sel = window.getSelection()
      if (!sel || !sel.rangeCount) return
      const range = sel.getRangeAt(0)

      const getLineDiv = (node: Node) => {
        let n: Element | null = node.nodeType === 3 ? (node as Text).parentElement : (node as Element)
        while (n && n.parentElement !== ed) n = n.parentElement
        return n && n.parentElement === ed ? n : null
      }
      const getTextNodeLocal = (div: Element): Text | null => {
        for (let c = div.firstChild; c; c = c.nextSibling)
          if (c.nodeType === 3) return c as Text
        return null
      }

      const startDiv = getLineDiv(range.startContainer)
      const endDiv = getLineDiv(range.endContainer)
      if (!startDiv) return
      const isMultiLine = !range.collapsed && startDiv !== endDiv

      if (!isMultiLine) {
        if (!e.shiftKey) {
          document.execCommand('insertText', false, '\t')
          syncEditorClasses()
          scheduleAutoSave()
          return
        }
        const textNode = getTextNodeLocal(startDiv)
        if (!textNode) return
        const text = textNode.textContent ?? ''
        let removed = 0
        if (text.startsWith('\t')) removed = 1
        else if (text.startsWith('    ')) removed = 4
        else return

        const offset = range.startContainer === textNode ? range.startOffset : 0
        const delRange = document.createRange()
        delRange.setStart(textNode, 0)
        delRange.setEnd(textNode, removed)
        sel.removeAllRanges()
        sel.addRange(delRange)
        document.execCommand('delete', false)

        const newTn = getTextNodeLocal(startDiv)
        if (newTn) {
          const pos = Math.max(0, offset - removed)
          const r = document.createRange()
          r.setStart(newTn, Math.min(pos, newTn.length))
          r.collapse(true)
          sel.removeAllRanges()
          sel.addRange(r)
        }
        syncEditorClasses()
        scheduleAutoSave()
        return
      }

      // Multi-line
      const children = Array.from(ed.children)
      const startIdx = children.indexOf(startDiv)
      const endIdx = children.indexOf(endDiv!)
      if (startIdx < 0 || endIdx < 0) return

      const affected = children.slice(startIdx, endIdx + 1)
      for (const div of affected) {
        const text = div.textContent ?? ''
        let newText: string
        if (!e.shiftKey) {
          newText = '\t' + text
        } else {
          if (text.startsWith('\t')) newText = text.slice(1)
          else if (text.startsWith('    ')) newText = text.slice(4)
          else newText = text
        }
        if (newText !== text) {
          div.textContent = newText || ''
          if (!newText) div.innerHTML = '<br>'
        }
      }

      const firstTn = getTextNodeLocal(affected[0]) || affected[0]
      const lastDiv = affected[affected.length - 1]
      const lastTn = getTextNodeLocal(lastDiv)
      const newSel = document.createRange()
      newSel.setStart(firstTn, 0)
      if (lastTn) newSel.setEnd(lastTn, lastTn.length)
      else newSel.selectNodeContents(lastDiv)
      sel.removeAllRanges()
      sel.addRange(newSel)
      syncEditorClasses()
      scheduleAutoSave()
    }

    // Cmd+] / Cmd+[
    const onKeyDownIndent = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key !== ']' && e.key !== '[') return
      e.preventDefault()

      const sel = window.getSelection()
      if (!sel || !sel.rangeCount) return
      const range = sel.getRangeAt(0)

      const getLineDiv = (node: Node) => {
        let n: Element | null = node.nodeType === 3 ? (node as Text).parentElement : (node as Element)
        while (n && n.parentElement !== ed) n = n.parentElement
        return n && n.parentElement === ed ? n : null
      }
      const getTextNodeLocal = (div: Element): Text | null => {
        for (let c = div.firstChild; c; c = c.nextSibling)
          if (c.nodeType === 3) return c as Text
        return null
      }

      const startDiv = getLineDiv(range.startContainer)
      const endDiv = getLineDiv(range.endContainer)
      if (!startDiv) return

      const isIndent = e.key === ']'
      const isMultiLine = !range.collapsed && startDiv !== endDiv

      if (!isMultiLine) {
        const textNode = getTextNodeLocal(startDiv)
        const text = startDiv.textContent ?? ''
        const offset = range.startContainer === textNode ? range.startOffset : 0
        if (isIndent) {
          startDiv.textContent = '\t' + text
          const tn = getTextNodeLocal(startDiv)
          if (tn) {
            const r = document.createRange()
            r.setStart(tn, offset + 1)
            r.collapse(true)
            sel.removeAllRanges()
            sel.addRange(r)
          }
        } else {
          let removed = 0
          if (text.startsWith('\t')) removed = 1
          else if (text.startsWith('    ')) removed = 4
          else return
          const newText = text.slice(removed)
          startDiv.textContent = newText || ''
          if (!newText) startDiv.innerHTML = '<br>'
          const tn = getTextNodeLocal(startDiv)
          if (tn) {
            const pos = Math.max(0, offset - removed)
            const r = document.createRange()
            r.setStart(tn, Math.min(pos, tn.length))
            r.collapse(true)
            sel.removeAllRanges()
            sel.addRange(r)
          }
        }
        syncEditorClasses()
        scheduleAutoSave()
        return
      }

      const children = Array.from(ed.children)
      const startIdx = children.indexOf(startDiv)
      const endIdx = children.indexOf(endDiv!)
      if (startIdx < 0 || endIdx < 0) return

      const affected = children.slice(startIdx, endIdx + 1)
      for (const div of affected) {
        const text = div.textContent ?? ''
        let newText: string
        if (isIndent) {
          newText = '\t' + text
        } else {
          if (text.startsWith('\t')) newText = text.slice(1)
          else if (text.startsWith('    ')) newText = text.slice(4)
          else newText = text
        }
        if (newText !== text) {
          div.textContent = newText || ''
          if (!newText) div.innerHTML = '<br>'
        }
      }

      const firstTn = getTextNodeLocal(affected[0]) || affected[0]
      const lastDiv = affected[affected.length - 1]
      const lastTn = getTextNodeLocal(lastDiv)
      const newSel = document.createRange()
      newSel.setStart(firstTn, 0)
      if (lastTn) newSel.setEnd(lastTn, lastTn.length)
      else newSel.selectNodeContents(lastDiv)
      sel.removeAllRanges()
      sel.addRange(newSel)
      syncEditorClasses()
      scheduleAutoSave()
    }

    ed.addEventListener('compositionstart', onCompositionStart)
    ed.addEventListener('compositionend', onCompositionEnd)
    ed.addEventListener('input', onInput)
    ed.addEventListener('paste', onPaste as EventListener)
    ed.addEventListener('keydown', onKeyDownTab)
    ed.addEventListener('keydown', onKeyDownIndent)
    ed.addEventListener('scroll', onScroll)

    // Global: Cmd+F, Cmd+D
    const onDocKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === 'f') {
        e.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
        return
      }
      if (mod && e.key === 'd') {
        e.preventDefault()
        toggleDoneOnCurrentLine()
        return
      }
    }
    document.addEventListener('keydown', onDocKeyDown)

    // Window resize
    const onResize = () => {
      if (imp.current.searchQuery) scheduleHighlights()
      updateTabWidth()
    }
    window.addEventListener('resize', onResize)

    return () => {
      observer.disconnect()
      ed.removeEventListener('compositionstart', onCompositionStart)
      ed.removeEventListener('compositionend', onCompositionEnd)
      ed.removeEventListener('input', onInput)
      ed.removeEventListener('paste', onPaste as EventListener)
      ed.removeEventListener('keydown', onKeyDownTab)
      ed.removeEventListener('keydown', onKeyDownIndent)
      ed.removeEventListener('scroll', onScroll)
      document.removeEventListener('keydown', onDocKeyDown)
      window.removeEventListener('resize', onResize)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally runs once

  // ----------------------------------------------------------------
  // Keep tag colors in sync with imperative style injection
  // ----------------------------------------------------------------
  useEffect(() => {
    imp.current.tagColors = tagColors
    applyTagColorStyles(tagColors)
  }, [tagColors, applyTagColorStyles])

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------
  const today = new Date().toISOString().split('T')[0]
  const overdueTasks = dateTasks.filter((t) => t.date < today)
  const todayTasks = dateTasks.filter((t) => t.date === today)
  const futureTasks = dateTasks.filter((t) => t.date > today)

  return (
    <div
      id="app"
      className="flex flex-col"
      style={{ height: '100vh', background: 'var(--bg)', color: 'var(--fg)' }}
    >
      <Toolbar
        filter={filter}
        searchQuery={searchQuery}
        tags={tags}
        tagColors={tagColors}
        matchTotal={matchTotal}
        matchCurrent={matchCurrent}
        searchInputRef={searchInputRef}
        fileInputRef={fileInputRef}
        onFilterChange={handleFilterChange}
        onSearchChange={handleSearchChange}
        onSearchClear={handleSearchClear}
        onSearchNavigate={handleSearchNavigate}
        onSearchKeyDown={handleSearchKeyDown}
        onExport={exportFile}
        onImport={importFile}
        onTagColorPickerOpen={handleTagColorPickerOpen}
        TAG_COLOR_PRESETS={TAG_COLOR_PRESETS}
        showDateView={showDateView}
        onDateViewToggle={handleDateViewToggle}
      />
      <div className="flex flex-1 overflow-hidden">
        <Editor editorRef={editorRef} overlayRef={overlayRef} />
        {showDateView && (
          <div
            id="date-view"
            style={{
              width: 260,
              flexShrink: 0,
              borderLeft: '1px solid var(--border)',
              background: 'var(--bg)',
              overflowY: 'auto',
              fontFamily: 'var(--font-ui)',
              fontSize: 13,
              color: 'var(--fg)',
            }}
          >
            <div
              style={{
                padding: '8px 12px',
                borderBottom: '1px solid var(--border)',
                fontWeight: 600,
                color: 'var(--fg-muted)',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              日期视图
            </div>
            {dateTasks.length === 0 && (
              <div style={{ padding: '16px 12px', color: 'var(--fg-muted)' }}>
                无带日期的任务。
                <br />
                <span style={{ fontSize: 12 }}>
                  使用 @today 或 @date(YYYY-MM-DD) 标记任务日期。
                </span>
              </div>
            )}
            {overdueTasks.length > 0 && (
              <DateGroup
                label="过期"
                labelColor="#e03535"
                tasks={overdueTasks}
                onTaskClick={scrollToLine}
              />
            )}
            {todayTasks.length > 0 && (
              <DateGroup
                label={`今天 · ${today}`}
                labelColor="#22c55e"
                tasks={todayTasks}
                onTaskClick={scrollToLine}
              />
            )}
            {futureTasks.length > 0 && (
              <DateGroup
                label="未来"
                labelColor="#3b82f6"
                tasks={futureTasks}
                onTaskClick={scrollToLine}
              />
            )}
          </div>
        )}
      </div>
      {tagColorPicker && (
        <TagColorPicker
          tagName={tagColorPicker.tagName}
          anchorRect={tagColorPicker.anchorRect}
          currentColor={tagColors[tagColorPicker.tagName] ?? ''}
          presets={TAG_COLOR_PRESETS}
          onColorChange={handleTagColorChange}
          onClose={() => setTagColorPicker(null)}
        />
      )}
    </div>
  )
}

// ----------------------------------------------------------------
// DateGroup: a section in the date view panel
// ----------------------------------------------------------------
function DateGroup({
  label,
  labelColor,
  tasks,
  onTaskClick,
}: {
  label: string
  labelColor: string
  tasks: { text: string; date: string; lineIndex: number }[]
  onTaskClick: (lineIndex: number) => void
}) {
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div
        style={{
          padding: '6px 12px 4px',
          fontSize: 11,
          fontWeight: 600,
          color: labelColor,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </div>
      {tasks.map((t) => (
        <button
          key={t.lineIndex}
          onClick={() => onTaskClick(t.lineIndex)}
          title={`跳转到: ${t.text}`}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            padding: '4px 12px 4px 20px',
            background: 'none',
            border: 'none',
            color: 'var(--fg)',
            fontSize: 12,
            fontFamily: 'var(--font-editor)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: 1.5,
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--border)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'none'
          }}
        >
          {t.text}
        </button>
      ))}
    </div>
  )
}
