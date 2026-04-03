const STORAGE_CONTENT = 'taskpaper-lite:content'
const STORAGE_FILTER = 'taskpaper-lite:filter'
const STORAGE_TAG_COLORS = 'taskpaper-lite:tag-colors'

export const DEFAULT_CONTENT = `工作:
\t- 写需求文档 @work @today
\t- 发会议邮件 @work @done
\t- 整理项目文档 @work
\t备注：本周重点推进需求评审

个人:
\t- 买菜 @home @today
\t- 读书 30 分钟 @home
\t- 健身 @home @done

`

export interface StorageData {
  content: string
  filter: string
  tagColors: Record<string, string>
}

const isClient = typeof window !== 'undefined'

export function loadFromStorage(): StorageData {
  if (!isClient) {
    return { content: DEFAULT_CONTENT, filter: 'all', tagColors: { p0: '#e03535' } }
  }
  const content = localStorage.getItem(STORAGE_CONTENT) ?? DEFAULT_CONTENT
  const filter = localStorage.getItem(STORAGE_FILTER) ?? 'all'
  const tagColors = loadTagColors()
  return { content, filter, tagColors }
}

export function saveContent(text: string): void {
  if (!isClient) return
  localStorage.setItem(STORAGE_CONTENT, text)
}

export function saveFilter(filter: string): void {
  if (!isClient) return
  localStorage.setItem(STORAGE_FILTER, filter)
}

export function loadTagColors(): Record<string, string> {
  if (!isClient) return { p0: '#e03535' }
  try {
    const stored = localStorage.getItem(STORAGE_TAG_COLORS)
    return stored ? JSON.parse(stored) : { p0: '#e03535' }
  } catch {
    return { p0: '#e03535' }
  }
}

export function saveTagColors(colors: Record<string, string>): void {
  if (!isClient) return
  localStorage.setItem(STORAGE_TAG_COLORS, JSON.stringify(colors))
}
