import { Folder, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button.tsx'
import type { ActiveHistoryView } from '@/features/notes/types'

interface HistoryViewTabsProps {
  activeView: ActiveHistoryView
  activeCount: number
  uncategorizedCount: number
  trashCount: number
  onSelectView: (view: ActiveHistoryView) => void
}

export function HistoryViewTabs({
  activeView,
  activeCount,
  uncategorizedCount,
  trashCount,
  onSelectView,
}: HistoryViewTabsProps) {
  const renderButton = (
    view: ActiveHistoryView,
    label: string,
    count: number,
    icon: 'folder' | 'open' = 'folder'
  ) => {
    const Icon = icon === 'open' ? FolderOpen : Folder
    const active = activeView === view

    return (
      <Button
        type="button"
        size="sm"
        variant={active ? 'default' : 'outline'}
        onClick={() => onSelectView(view)}
        className="min-w-0 justify-start gap-1"
      >
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{label}</span>
        <span className="shrink-0 text-xs opacity-70">{count}</span>
      </Button>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {renderButton('all', '全部', activeCount, 'open')}
      {renderButton('uncategorized', '未分类', uncategorizedCount)}
      {renderButton('trash', '回收站', trashCount)}
    </div>
  )
}
