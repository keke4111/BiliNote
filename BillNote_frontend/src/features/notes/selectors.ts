import type { Category, DeletedMarkdownVersion, Task } from './types'
import { createTrashItems } from './utils'

export interface NotesStateLike {
  tasks: Task[]
  categories: Category[]
  deletedVersions: DeletedMarkdownVersion[]
  currentTaskId: string | null
}

export const selectCurrentTask = (state: NotesStateLike) => {
  return state.tasks.find(task => task.id === state.currentTaskId) || null
}

export const selectActiveTasks = (state: NotesStateLike) => {
  return state.tasks.filter(task => !task.isDeleted)
}

export const selectDeletedTasks = (state: NotesStateLike) => {
  return state.tasks.filter(task => task.isDeleted)
}

export const selectTrashItems = (state: NotesStateLike) => {
  return createTrashItems(state.tasks, state.deletedVersions)
}

export const selectActiveTaskCount = (state: NotesStateLike) => {
  return selectActiveTasks(state).length
}

export const selectUncategorizedTaskCount = (state: NotesStateLike) => {
  return state.tasks.filter(task => !task.isDeleted && !task.categoryId).length
}

export const selectTrashCount = (state: NotesStateLike) => {
  return selectDeletedTasks(state).length + state.deletedVersions.length
}

export const selectCategoryCounts = (state: NotesStateLike) => {
  const counts = new Map<string, number>()
  state.tasks.forEach(task => {
    if (!task.isDeleted && task.categoryId) {
      counts.set(task.categoryId, (counts.get(task.categoryId) || 0) + 1)
    }
  })
  return counts
}
