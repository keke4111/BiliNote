import { FC, useMemo, useState } from 'react'
import { useTaskStore } from '@/store/taskStore'
import { clear_task_cache } from '@/services/note'
import {
  filterTasksBySearch,
  filterTasksByView,
  filterTrashItemsBySearch,
  sortTasks,
  createTrashItems,
} from '@/features/notes/utils'
import type { ActiveHistoryView, SortMode } from '@/features/notes/types'
import { CategoryManager } from './history/CategoryManager'
import { HistorySearchSort } from './history/HistorySearchSort'
import { HistoryViewTabs } from './history/HistoryViewTabs'
import { TaskHistoryCard } from './history/TaskHistoryCard'
import { TrashHistoryCard } from './history/TrashHistoryCard'

interface NoteHistoryProps {
  onSelect: (taskId: string) => void
  selectedId: string | null
}

const NoteHistory: FC<NoteHistoryProps> = ({ onSelect, selectedId }) => {
  const tasks = useTaskStore(state => state.tasks)
  const categories = useTaskStore(state => state.categories)
  const deletedVersions = useTaskStore(state => state.deletedVersions)
  const removeTask = useTaskStore(state => state.removeTask)
  const restoreTask = useTaskStore(state => state.restoreTask)
  const restoreMarkdownVersion = useTaskStore(state => state.restoreMarkdownVersion)
  const permanentlyRemoveTask = useTaskStore(state => state.permanentlyRemoveTask)
  const permanentlyRemoveMarkdownVersion = useTaskStore(
    state => state.permanentlyRemoveMarkdownVersion
  )
  const createCategory = useTaskStore(state => state.createCategory)
  const renameCategory = useTaskStore(state => state.renameCategory)
  const deleteCategory = useTaskStore(state => state.deleteCategory)
  const moveTaskToCategory = useTaskStore(state => state.moveTaskToCategory)

  const baseURL = String(import.meta.env.VITE_API_BASE_URL || 'api').replace(/\/$/, '')
  const [search, setSearch] = useState('')
  const [activeView, setActiveView] = useState<ActiveHistoryView>('all')
  const [sortMode, setSortMode] = useState<SortMode>('latest')
  const isTrashView = activeView === 'trash'
  const activeCount = useMemo(() => tasks.filter(task => !task.isDeleted).length, [tasks])
  const uncategorizedCount = useMemo(
    () => tasks.filter(task => !task.isDeleted && !task.categoryId).length,
    [tasks]
  )
  const trashCount = useMemo(
    () => tasks.filter(task => task.isDeleted).length + deletedVersions.length,
    [deletedVersions.length, tasks]
  )
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    tasks.forEach(task => {
      if (!task.isDeleted && task.categoryId) {
        counts.set(task.categoryId, (counts.get(task.categoryId) || 0) + 1)
      }
    })
    return counts
  }, [tasks])
  const trashItems = useMemo(
    () => createTrashItems(tasks, deletedVersions),
    [deletedVersions, tasks]
  )

  const filteredTasks = useMemo(() => {
    const visibleTasks = filterTasksByView(tasks, activeView)
    return sortTasks(filterTasksBySearch(visibleTasks, search), sortMode)
  }, [activeView, search, sortMode, tasks])

  const filteredTrashItems = useMemo(() => {
    return filterTrashItemsBySearch(trashItems, search)
  }, [search, trashItems])

  const handleSelectView = (view: ActiveHistoryView) => {
    setActiveView(view)
    if (view === 'all' || view === 'uncategorized') {
      setSortMode('latest')
    } else if (view !== 'trash') {
      setSortMode('title-asc')
    }
  }

  const handleCreateCategory = () => {
    const name = window.prompt('请输入分类名称')
    if (!name) return

    const newCategoryId = createCategory(name)
    if (newCategoryId) {
      handleSelectView(newCategoryId)
    }
  }

  const handleRenameCategory = (categoryId: string, currentName: string) => {
    const name = window.prompt('请输入新的分类名称', currentName)
    if (!name || name.trim() === currentName) return
    renameCategory(categoryId, name)
  }

  const handleDeleteCategory = (categoryId: string, categoryName: string) => {
    const affectedCount = tasks.filter(
      task => !task.isDeleted && task.categoryId === categoryId
    ).length
    const confirmed = window.confirm(
      `删除分类「${categoryName}」会将其中 ${affectedCount} 篇笔记移入回收站，确认继续？`
    )
    if (!confirmed) return

    deleteCategory(categoryId)
    if (activeView === categoryId) {
      handleSelectView('all')
    }
  }

  const handleRestoreTask = (taskId: string) => {
    restoreTask(taskId)
    onSelect(taskId)
  }

  const handleRestoreVersion = (taskId: string, versionId: string) => {
    const restored = restoreMarkdownVersion(taskId, versionId)
    if (restored) onSelect(taskId)
    return restored
  }

  const handleClearCache = async (taskId: string) => {
    await clear_task_cache(taskId)
  }

  const emptyText = isTrashView ? '回收站为空' : '暂无记录'
  const listIsEmpty = isTrashView ? filteredTrashItems.length === 0 : filteredTasks.length === 0

  return (
    <>
      <div className="mb-2 flex flex-col gap-2">
        <HistoryViewTabs
          activeView={activeView}
          activeCount={activeCount}
          uncategorizedCount={uncategorizedCount}
          trashCount={trashCount}
          onSelectView={handleSelectView}
        />

        <CategoryManager
          activeView={activeView}
          categories={categories}
          categoryCounts={categoryCounts}
          onSelectView={handleSelectView}
          onCreateCategory={handleCreateCategory}
          onRenameCategory={handleRenameCategory}
          onDeleteCategory={handleDeleteCategory}
        />

        <HistorySearchSort
          search={search}
          sortMode={sortMode}
          showSort={!isTrashView}
          onSearchChange={setSearch}
          onSortModeChange={setSortMode}
        />
      </div>

      {listIsEmpty ? (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 py-6 text-center">
          <p className="text-sm text-neutral-500">{emptyText}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 overflow-hidden">
          {isTrashView
            ? filteredTrashItems.map(item => (
                <TrashHistoryCard
                  key={
                    item.kind === 'task'
                      ? `task-${item.task.id}`
                      : `version-${item.deletedVersion.taskId}-${item.deletedVersion.version.ver_id}`
                  }
                  item={item}
                  baseURL={baseURL}
                  onRestoreTask={handleRestoreTask}
                  onRestoreVersion={handleRestoreVersion}
                  onPermanentlyRemoveTask={permanentlyRemoveTask}
                  onPermanentlyRemoveVersion={permanentlyRemoveMarkdownVersion}
                />
              ))
            : filteredTasks.map(task => (
                <TaskHistoryCard
                  key={task.id}
                  task={task}
                  selected={selectedId === task.id}
                  baseURL={baseURL}
                  categories={categories}
                  onSelect={onSelect}
                  onMoveToCategory={moveTaskToCategory}
                  onClearCache={handleClearCache}
                  onRemove={removeTask}
                />
              ))}
        </div>
      )}
    </>
  )
}

export default NoteHistory
