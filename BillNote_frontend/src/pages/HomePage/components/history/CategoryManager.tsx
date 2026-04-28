import { Folder, FolderPlus, Pencil, Trash } from 'lucide-react'
import { Button } from '@/components/ui/button.tsx'
import type { ActiveHistoryView, Category } from '@/features/notes/types'

interface CategoryManagerProps {
  activeView: ActiveHistoryView
  categories: Category[]
  categoryCounts: Map<string, number>
  onSelectView: (view: ActiveHistoryView) => void
  onCreateCategory: () => void
  onRenameCategory: (categoryId: string, currentName: string) => void
  onDeleteCategory: (categoryId: string, categoryName: string) => void
}

export function CategoryManager({
  activeView,
  categories,
  categoryCounts,
  onSelectView,
  onCreateCategory,
  onRenameCategory,
  onDeleteCategory,
}: CategoryManagerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map(category => {
        const active = activeView === category.id

        return (
          <div key={category.id} className="flex min-w-0 items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant={active ? 'default' : 'outline'}
              onClick={() => onSelectView(category.id)}
              className="min-w-0 justify-start gap-1"
            >
              <Folder className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{category.name}</span>
              <span className="shrink-0 text-xs opacity-70">
                {categoryCounts.get(category.id) || 0}
              </span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onRenameCategory(category.id, category.name)}
              className="h-8 w-8 shrink-0 px-0"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onDeleteCategory(category.id, category.name)}
              className="h-8 w-8 shrink-0 px-0"
            >
              <Trash className="text-destructive h-3.5 w-3.5" />
            </Button>
          </div>
        )
      })}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onCreateCategory}
        className="gap-1"
      >
        <FolderPlus className="h-3.5 w-3.5" />
        新建分类
      </Button>
    </div>
  )
}
