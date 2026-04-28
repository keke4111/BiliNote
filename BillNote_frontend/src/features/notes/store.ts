import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { delete_task, generateNote } from '@/services/note.ts'
import { v4 as uuidv4 } from 'uuid'
import toast from 'react-hot-toast'
import type {
  Category,
  DeletedMarkdownVersion,
  MarkdownVersion,
  NotesBackupSnapshot,
  Task,
} from './types'
import { createVersionFromString, sortVersionsByNewest } from './utils'
import { selectCurrentTask } from './selectors'

export interface PersistedTaskStoreState {
  tasks: Task[]
  categories: Category[]
  deletedVersions: DeletedMarkdownVersion[]
  currentTaskId: string | null
}

export const NOTES_BACKUP_SCHEMA_VERSION = 1

export interface TaskStore {
  tasks: Task[]
  categories: Category[]
  deletedVersions: DeletedMarkdownVersion[]
  currentTaskId: string | null
  addPendingTask: (taskId: string, platform: string, formData: any) => void
  updateTaskContent: (id: string, data: Partial<Omit<Task, 'id' | 'createdAt'>>) => void
  createCategory: (name: string) => string | null
  renameCategory: (id: string, name: string) => void
  deleteCategory: (id: string) => void
  moveTaskToCategory: (taskId: string, categoryId?: string) => void
  saveEditedMarkdownVersion: (
    taskId: string,
    sourceVersionId: string,
    content: string
  ) => { versionId: string } | null
  deleteMarkdownVersion: (taskId: string, versionId: string) => boolean
  restoreMarkdownVersion: (taskId: string, versionId: string) => boolean
  permanentlyRemoveMarkdownVersion: (taskId: string, versionId: string) => void
  removeTask: (id: string) => void
  restoreTask: (id: string) => void
  permanentlyRemoveTask: (id: string) => void
  clearTasks: () => void
  setCurrentTask: (taskId: string | null) => void
  getCurrentTask: () => Task | null
  retryTask: (id: string, payload?: any) => void
  importBackupSnapshot: (snapshot: NotesBackupSnapshot) => {
    addedTasks: number
    mergedVersions: number
    addedCategories: number
    addedDeletedVersions: number
  }
}

export const getPersistedTaskStoreState = (
  state: Partial<PersistedTaskStoreState>
): PersistedTaskStoreState => ({
  tasks: Array.isArray(state.tasks) ? state.tasks : [],
  categories: Array.isArray(state.categories) ? state.categories : [],
  deletedVersions: Array.isArray(state.deletedVersions) ? state.deletedVersions : [],
  currentTaskId: state.currentTaskId ?? null,
})

const normalizePersistedState = (persistedState: unknown) => {
  const state = getPersistedTaskStoreState((persistedState || {}) as Partial<TaskStore>)
  return {
    ...state,
    tasks: state.tasks.map(task => ({
      ...task,
      isDeleted: task.isDeleted ?? false,
    })),
  }
}

export const buildNotesBackupSnapshot = (
  state: Partial<PersistedTaskStoreState>
): NotesBackupSnapshot => {
  const persistedState = getPersistedTaskStoreState(state)
  return {
    ...persistedState,
    tasks: persistedState.tasks.map(task => {
      const { message: _message, progress: _progress, ...rest } = task
      return rest
    }),
    schemaVersion: NOTES_BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
  }
}

const getTaskVersions = (task: Task): MarkdownVersion[] =>
  Array.isArray(task.markdown)
    ? [...task.markdown]
    : task.markdown
      ? [createVersionFromString(task, task.markdown)]
      : []

export const useTaskStore = create<TaskStore>()(
  persist(
    (set, get) => ({
      tasks: [],
      categories: [],
      deletedVersions: [],
      currentTaskId: null,

      addPendingTask: (taskId: string, platform: string, formData: any) =>
        set(state => ({
          tasks: [
            {
              formData,
              id: taskId,
              status: 'PENDING',
              markdown: '',
              platform,
              transcript: {
                full_text: '',
                language: '',
                raw: null,
                segments: [],
              },
              createdAt: new Date().toISOString(),
              audioMeta: {
                cover_url: '',
                duration: 0,
                file_path: '',
                platform: '',
                raw_info: null,
                title: '',
                video_id: '',
              },
            },
            ...state.tasks,
          ],
          currentTaskId: taskId,
        })),

      updateTaskContent: (id, data) =>
        set(state => ({
          tasks: state.tasks.map(task => {
            if (task.id !== id) return task
            if (task.status === 'SUCCESS' && data.status === 'SUCCESS') return task

            if (typeof data.markdown === 'string') {
              const newVersion: MarkdownVersion = {
                ver_id: `${task.id}-${uuidv4()}`,
                content: data.markdown,
                style: task.formData.style || '',
                model_name: task.formData.model_name || '',
                created_at: new Date().toISOString(),
              }

              const previousVersions = Array.isArray(task.markdown)
                ? task.markdown
                : task.markdown
                  ? [createVersionFromString(task, task.markdown)]
                  : []

              return {
                ...task,
                ...data,
                markdown: [newVersion, ...previousVersions],
              }
            }

            return { ...task, ...data }
          }),
        })),

      getCurrentTask: () => selectCurrentTask(get()),

      retryTask: async (id: string, payload?: any) => {
        if (!id) {
          toast.error('任务不存在')
          return
        }

        const task = get().tasks.find(task => task.id === id)
        if (!task) return

        const newFormData = payload || task.formData
        await generateNote({
          ...newFormData,
          task_id: id,
        })

        set(state => ({
          tasks: state.tasks.map(task =>
            task.id === id
              ? {
                  ...task,
                  formData: newFormData,
                  status: 'PENDING',
                }
              : task
          ),
        }))
      },

      importBackupSnapshot: snapshot => {
        const incomingState = normalizePersistedState(snapshot)
        const localState = getPersistedTaskStoreState(get())

        const nextCategories = [...localState.categories]
        const categoryNameMap = new Map(
          nextCategories.map(category => [category.name.trim().toLowerCase(), category])
        )
        const categoryIdMap = new Map<string, string>()
        let addedCategories = 0

        incomingState.categories.forEach(category => {
          const key = category.name.trim().toLowerCase()
          const existingByName = categoryNameMap.get(key)
          if (existingByName) {
            categoryIdMap.set(category.id, existingByName.id)
            return
          }

          const categoryIdInUse = nextCategories.some(item => item.id === category.id)
          const nextCategory = {
            ...category,
            id: categoryIdInUse ? uuidv4() : category.id,
          }
          nextCategories.push(nextCategory)
          categoryNameMap.set(key, nextCategory)
          categoryIdMap.set(category.id, nextCategory.id)
          addedCategories += 1
        })

        const nextTasks = [...localState.tasks]
        const taskIndexMap = new Map(nextTasks.map((task, index) => [task.id, index]))
        let addedTasks = 0
        let mergedVersions = 0

        incomingState.tasks.forEach(importedTask => {
          const normalizedImportedTask: Task = {
            ...importedTask,
            categoryId: importedTask.categoryId
              ? categoryIdMap.get(importedTask.categoryId) || importedTask.categoryId
              : undefined,
            isDeleted: importedTask.isDeleted ?? false,
          }

          const existingIndex = taskIndexMap.get(importedTask.id)
          if (existingIndex === undefined) {
            nextTasks.push(normalizedImportedTask)
            taskIndexMap.set(importedTask.id, nextTasks.length - 1)
            addedTasks += 1
            return
          }

          const existingTask = nextTasks[existingIndex]
          const localVersions = getTaskVersions(existingTask)
          const importedVersions = getTaskVersions(normalizedImportedTask)
          if (!importedVersions.length) return

          if (!localVersions.length) {
            nextTasks[existingIndex] = {
              ...existingTask,
              markdown: sortVersionsByNewest(importedVersions),
            }
            mergedVersions += importedVersions.length
            return
          }

          const existingVersionIds = new Set(localVersions.map(version => version.ver_id))
          const missingVersions = importedVersions.filter(
            version => !existingVersionIds.has(version.ver_id)
          )
          if (!missingVersions.length) return

          nextTasks[existingIndex] = {
            ...existingTask,
            markdown: sortVersionsByNewest([...localVersions, ...missingVersions]),
          }
          mergedVersions += missingVersions.length
        })

        const activeVersionKeys = new Set(
          nextTasks.flatMap(task =>
            getTaskVersions(task).map(version => `${task.id}:${version.ver_id}`)
          )
        )
        const deletedVersionKeys = new Set(
          localState.deletedVersions.map(item => `${item.taskId}:${item.version.ver_id}`)
        )
        const nextDeletedVersions = [...localState.deletedVersions]
        let addedDeletedVersions = 0

        incomingState.deletedVersions.forEach(item => {
          const key = `${item.taskId}:${item.version.ver_id}`
          if (deletedVersionKeys.has(key) || activeVersionKeys.has(key)) return
          nextDeletedVersions.push(item)
          deletedVersionKeys.add(key)
          addedDeletedVersions += 1
        })

        const currentTaskId =
          localState.currentTaskId ||
          (incomingState.currentTaskId &&
          nextTasks.some(task => task.id === incomingState.currentTaskId)
            ? incomingState.currentTaskId
            : null)

        set({
          tasks: nextTasks,
          categories: nextCategories,
          deletedVersions: nextDeletedVersions,
          currentTaskId,
        })

        return {
          addedTasks,
          mergedVersions,
          addedCategories,
          addedDeletedVersions,
        }
      },

      createCategory: name => {
        const trimmedName = name.trim()
        if (!trimmedName) return null

        const duplicate = get().categories.some(
          category => category.name.trim().toLowerCase() === trimmedName.toLowerCase()
        )
        if (duplicate) {
          toast.error('分类已存在')
          return null
        }

        const id = uuidv4()
        set(state => ({
          categories: [
            ...state.categories,
            {
              id,
              name: trimmedName,
              createdAt: new Date().toISOString(),
            },
          ],
        }))
        return id
      },

      renameCategory: (id, name) => {
        const trimmedName = name.trim()
        if (!trimmedName) return

        const duplicate = get().categories.some(
          category =>
            category.id !== id && category.name.trim().toLowerCase() === trimmedName.toLowerCase()
        )
        if (duplicate) {
          toast.error('分类已存在')
          return
        }

        set(state => ({
          categories: state.categories.map(category =>
            category.id === id ? { ...category, name: trimmedName } : category
          ),
        }))
      },

      deleteCategory: id => {
        const now = new Date().toISOString()
        const affectedCurrentTask = get().tasks.some(
          task => task.id === get().currentTaskId && task.categoryId === id
        )

        set(state => ({
          categories: state.categories.filter(category => category.id !== id),
          tasks: state.tasks.map(task =>
            task.categoryId === id
              ? {
                  ...task,
                  categoryId: undefined,
                  isDeleted: true,
                  deletedAt: task.deletedAt || now,
                }
              : task
          ),
          currentTaskId: affectedCurrentTask ? null : state.currentTaskId,
        }))
      },

      moveTaskToCategory: (taskId, categoryId) => {
        const validCategoryId = categoryId
          ? get().categories.some(category => category.id === categoryId)
            ? categoryId
            : undefined
          : undefined

        set(state => ({
          tasks: state.tasks.map(task =>
            task.id === taskId ? { ...task, categoryId: validCategoryId } : task
          ),
        }))
      },

      saveEditedMarkdownVersion: (taskId, sourceVersionId, content) => {
        const task = get().tasks.find(task => task.id === taskId)
        if (!task) return null

        const versions = Array.isArray(task.markdown)
          ? [...task.markdown]
          : task.markdown
            ? [createVersionFromString(task, task.markdown)]
            : []

        if (!versions.length) return null

        const sourceVersion =
          versions.find(version => version.ver_id === sourceVersionId) || versions[0]
        if (!sourceVersion) return null

        const now = new Date().toISOString()
        let versionId = sourceVersion.ver_id
        let nextVersions: MarkdownVersion[]

        if (sourceVersion.edited_manually) {
          nextVersions = versions.map(version =>
            version.ver_id === sourceVersion.ver_id
              ? {
                  ...version,
                  content,
                  created_at: now,
                  source_ver_id:
                    version.source_ver_id || sourceVersion.source_ver_id || sourceVersion.ver_id,
                  edited_manually: true,
                }
              : version
          )
        } else {
          versionId = `${task.id}-${uuidv4()}`
          const editedVersion: MarkdownVersion = {
            ...sourceVersion,
            ver_id: versionId,
            content,
            created_at: now,
            source_ver_id: sourceVersion.ver_id,
            edited_manually: true,
          }
          nextVersions = [editedVersion, ...versions]
        }

        set(state => ({
          tasks: state.tasks.map(task =>
            task.id === taskId
              ? {
                  ...task,
                  markdown: sortVersionsByNewest(nextVersions),
                }
              : task
          ),
        }))

        return { versionId }
      },

      deleteMarkdownVersion: (taskId, versionId) => {
        const task = get().tasks.find(task => task.id === taskId)
        if (!task || !Array.isArray(task.markdown)) return false

        if (task.markdown.length <= 1) {
          toast.error('至少保留一个版本')
          return false
        }

        const deletedVersion = task.markdown.find(version => version.ver_id === versionId)
        if (!deletedVersion) return false

        const nextMarkdown = task.markdown.filter(version => version.ver_id !== versionId)

        set(state => ({
          tasks: state.tasks.map(task =>
            task.id === taskId ? { ...task, markdown: nextMarkdown } : task
          ),
          deletedVersions: [
            {
              taskId,
              version: deletedVersion,
              deletedAt: new Date().toISOString(),
            },
            ...state.deletedVersions.filter(
              deleted => !(deleted.taskId === taskId && deleted.version.ver_id === versionId)
            ),
          ],
        }))
        toast.success('版本已移入回收站')
        return true
      },

      restoreMarkdownVersion: (taskId, versionId) => {
        const task = get().tasks.find(task => task.id === taskId)
        if (!task) {
          toast.error('原笔记不存在，无法恢复版本')
          return false
        }
        if (task.isDeleted) {
          toast.error('请先恢复原笔记')
          return false
        }

        const deletedVersion = get().deletedVersions.find(
          deleted => deleted.taskId === taskId && deleted.version.ver_id === versionId
        )
        if (!deletedVersion) return false

        set(state => ({
          tasks: state.tasks.map(task => {
            if (task.id !== taskId) return task

            const currentVersions = Array.isArray(task.markdown)
              ? task.markdown.filter(version => version.ver_id !== versionId)
              : task.markdown
                ? [createVersionFromString(task, task.markdown)]
                : []

            return {
              ...task,
              markdown: sortVersionsByNewest([...currentVersions, deletedVersion.version]),
            }
          }),
          deletedVersions: state.deletedVersions.filter(
            deleted => !(deleted.taskId === taskId && deleted.version.ver_id === versionId)
          ),
          currentTaskId: taskId,
        }))
        toast.success('版本已恢复')
        return true
      },

      permanentlyRemoveMarkdownVersion: (taskId, versionId) => {
        set(state => ({
          deletedVersions: state.deletedVersions.filter(
            deleted => !(deleted.taskId === taskId && deleted.version.ver_id === versionId)
          ),
        }))
        toast.success('版本已永久删除')
      },

      removeTask: id => {
        set(state => ({
          tasks: state.tasks.map(task =>
            task.id === id
              ? { ...task, isDeleted: true, deletedAt: new Date().toISOString() }
              : task
          ),
          currentTaskId: state.currentTaskId === id ? null : state.currentTaskId,
        }))
      },

      restoreTask: id =>
        set(state => ({
          tasks: state.tasks.map(task =>
            task.id === id
              ? {
                  ...task,
                  categoryId:
                    task.categoryId &&
                    state.categories.some(category => category.id === task.categoryId)
                      ? task.categoryId
                      : undefined,
                  isDeleted: false,
                  deletedAt: undefined,
                }
              : task
          ),
          currentTaskId: id,
        })),

      permanentlyRemoveTask: async id => {
        const task = get().tasks.find(task => task.id === id)
        set(state => ({
          tasks: state.tasks.filter(task => task.id !== id),
          currentTaskId: state.currentTaskId === id ? null : state.currentTaskId,
        }))

        if (task) {
          await delete_task({
            video_id: task.audioMeta.video_id,
            platform: task.platform,
          })
        }
      },

      clearTasks: () => set({ tasks: [], deletedVersions: [], currentTaskId: null }),

      setCurrentTask: taskId => set({ currentTaskId: taskId }),
    }),
    {
      name: 'task-storage',
      version: 2,
      migrate: persistedState => normalizePersistedState(persistedState),
      partialize: state => getPersistedTaskStoreState(state),
    }
  )
)
