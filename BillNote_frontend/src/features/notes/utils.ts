import { v4 as uuidv4 } from 'uuid'
import type {
  ActiveHistoryView,
  DeletedMarkdownVersion,
  MarkdownVersion,
  SortMode,
  Task,
  TrashItem,
} from './types'

export const UNCATEGORIZED_VALUE = '__uncategorized__'

export const getTaskTitle = (task?: Task) => task?.audioMeta?.title || '未命名笔记'

export const getTrashItemTitle = (item: TrashItem) => {
  if (item.kind === 'task') return getTaskTitle(item.task)
  return item.task ? getTaskTitle(item.task) : '原笔记已删除'
}

export const createVersionFromString = (task: Task, content: string): MarkdownVersion => ({
  ver_id: `${task.id}-${uuidv4()}`,
  content,
  style: task.formData.style || '',
  model_name: task.formData.model_name || '',
  created_at: task.createdAt || new Date().toISOString(),
})

export const getLatestVersion = <T extends { created_at?: string }>(versions: T[]) => {
  return [...versions].sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  )[0]
}

export const sortVersionsByNewest = (versions: MarkdownVersion[]) => {
  return [...versions].sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  )
}

export const sortTasks = (tasks: Task[], sortMode: SortMode) => {
  return [...tasks].sort((a, b) => {
    if (sortMode === 'title-asc') {
      return getTaskTitle(a).localeCompare(getTaskTitle(b), 'zh-Hans-CN')
    }

    if (sortMode === 'title-desc') {
      return getTaskTitle(b).localeCompare(getTaskTitle(a), 'zh-Hans-CN')
    }

    const aTime = new Date(a.createdAt || 0).getTime()
    const bTime = new Date(b.createdAt || 0).getTime()
    return sortMode === 'oldest' ? aTime - bTime : bTime - aTime
  })
}

export const filterTasksByView = (tasks: Task[], activeView: ActiveHistoryView) => {
  const activeTasks = tasks.filter(task => !task.isDeleted)
  if (activeView === 'all') return activeTasks
  if (activeView === 'uncategorized') return activeTasks.filter(task => !task.categoryId)
  if (activeView === 'trash') return []
  return activeTasks.filter(task => task.categoryId === activeView)
}

export const filterTasksBySearch = (tasks: Task[], search: string) => {
  const keyword = search.trim().toLowerCase()
  if (!keyword) return tasks
  return tasks.filter(task => getTaskTitle(task).toLowerCase().includes(keyword))
}

export const createTrashItems = (
  tasks: Task[],
  deletedVersions: DeletedMarkdownVersion[]
): TrashItem[] => {
  const deletedTaskItems: TrashItem[] = tasks
    .filter(task => task.isDeleted)
    .map(task => ({
      kind: 'task',
      task,
      deletedAt: task.deletedAt || task.createdAt || '',
    }))

  const deletedVersionItems: TrashItem[] = deletedVersions.map(deletedVersion => ({
    kind: 'version',
    deletedVersion,
    task: tasks.find(task => task.id === deletedVersion.taskId),
    deletedAt: deletedVersion.deletedAt,
  }))

  return [...deletedTaskItems, ...deletedVersionItems].sort(
    (a, b) => new Date(b.deletedAt || 0).getTime() - new Date(a.deletedAt || 0).getTime()
  )
}

export const filterTrashItemsBySearch = (items: TrashItem[], search: string) => {
  const keyword = search.trim().toLowerCase()
  if (!keyword) return items

  return items.filter(item => {
    if (getTrashItemTitle(item).toLowerCase().includes(keyword)) return true
    if (item.kind === 'version') {
      return item.deletedVersion.version.ver_id.toLowerCase().includes(keyword)
    }
    return false
  })
}

export const formatHistoryDate = (value?: string) => {
  if (!value) return ''
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
