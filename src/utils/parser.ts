// Pure TypeScript port of the parser logic from index.html

export type LineType =
  | 'blank'
  | 'blank-done'
  | 'project'
  | 'project-done'
  | 'task'
  | 'task-done'
  | 'note'
  | 'note-done'

export const TAG_COLOR_PRESETS: string[] = [
  '#e03535',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#3b82f6',
  '#a855f7',
  '#ec4899',
  '#64748b',
]

export function classifyLine(text: string): LineType {
  if (text === '' || text === '\u200B') return 'blank'
  const isDone = /(?:^|\s)@done(?:\s|$)/.test(text)
  // Project: no leading whitespace, ends with ':' (optionally followed by @done)
  if (/^[^\t \n].*:(\s*@done)?\s*$/.test(text)) {
    return isDone ? 'project-done' : 'project'
  }
  // Task: leading tab/4-spaces then '- '
  if (/^(\t|    )- /.test(text)) {
    return isDone ? 'task-done' : 'task'
  }
  // Note: any other leading whitespace
  if (/^[\t ]/.test(text)) {
    return isDone ? 'note-done' : 'note'
  }
  // Top-level text (not a project)
  return isDone ? 'blank-done' : 'blank'
}

export function extractTags(text: string): string[] {
  const tags = new Set<string>()
  const re = /(?:^|[\s])(@(?!done\b)[a-zA-Z0-9_\u4e00-\u9fa5-]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    tags.add(m[1])
  }
  return Array.from(tags).sort()
}

export function extractTagNames(text: string): string[] {
  const names: string[] = []
  const re = /(?:^|[\s])@((?!done\b)[a-zA-Z0-9_\u4e00-\u9fa5-]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    names.push(m[1])
  }
  return names
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Extract the date associated with a line.
 * Returns an ISO date string (YYYY-MM-DD) if the line contains @today or
 * @date(YYYY-MM-DD), otherwise null.
 * @param text   Line text
 * @param today  Today's ISO date string, e.g. "2026-04-03"
 */
export function extractDate(text: string, today: string): string | null {
  if (/(?:^|\s)@today(?:\s|$)/.test(text)) return today
  const m = /(?:^|\s)@date\((\d{4}-\d{2}-\d{2})\)/.exec(text)
  return m ? m[1] : null
}

export function getIndentLevel(text: string): number {
  let level = 0
  let i = 0
  while (i < text.length) {
    if (text[i] === '\t') {
      level++
      i++
    } else if (text.slice(i, i + 4) === '    ') {
      level++
      i += 4
    } else {
      break
    }
  }
  return level
}
