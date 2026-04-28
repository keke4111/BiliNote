import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.tsx'
import type { SortMode } from '@/features/notes/types'

interface HistorySearchSortProps {
  search: string
  sortMode: SortMode
  showSort: boolean
  onSearchChange: (value: string) => void
  onSortModeChange: (value: SortMode) => void
}

export function HistorySearchSort({
  search,
  sortMode,
  showSort,
  onSearchChange,
  onSortModeChange,
}: HistorySearchSortProps) {
  return (
    <>
      <input
        type="text"
        placeholder="搜索笔记标题..."
        className="focus:border-primary w-full rounded border border-neutral-300 px-3 py-1 text-sm outline-none"
        value={search}
        onChange={event => onSearchChange(event.target.value)}
      />

      {showSort && (
        <Select value={sortMode} onValueChange={value => onSortModeChange(value as SortMode)}>
          <SelectTrigger size="sm" className="w-full">
            <SelectValue placeholder="排序方式" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="latest">最新优先</SelectItem>
            <SelectItem value="oldest">最旧优先</SelectItem>
            <SelectItem value="title-asc">标题 A-Z</SelectItem>
            <SelectItem value="title-desc">标题 Z-A</SelectItem>
          </SelectContent>
        </Select>
      )}
    </>
  )
}
