import { HardDrive, Trash } from 'lucide-react'
import { cn } from '@/lib/utils.ts'
import { Button } from '@/components/ui/button.tsx'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.tsx'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip.tsx'
import LazyImage from '@/components/LazyImage.tsx'
import type { Category, Task } from '@/features/notes/types'
import { getTaskTitle, UNCATEGORIZED_VALUE } from '@/features/notes/utils'

interface TaskHistoryCardProps {
  task: Task
  selected: boolean
  baseURL: string
  categories: Category[]
  onSelect: (taskId: string) => void
  onMoveToCategory: (taskId: string, categoryId?: string) => void
  onClearCache: (taskId: string) => void
  onRemove: (taskId: string) => void
}

export function TaskHistoryCard({
  task,
  selected,
  baseURL,
  categories,
  onSelect,
  onMoveToCategory,
  onClearCache,
  onRemove,
}: TaskHistoryCardProps) {
  const title = getTaskTitle(task)

  return (
    <div
      key={task.id}
      onClick={() => onSelect(task.id)}
      className={cn(
        'flex cursor-pointer flex-col rounded-md border border-neutral-200 p-3',
        selected && 'border-primary bg-primary-light'
      )}
    >
      <div className="flex items-center gap-4">
        {task.platform === 'local' ? (
          <img
            src={task.audioMeta.cover_url ? `${task.audioMeta.cover_url}` : '/placeholder.png'}
            alt="封面"
            className="h-10 w-12 rounded-md object-cover"
          />
        ) : (
          <LazyImage
            src={
              task.audioMeta.cover_url
                ? `${baseURL}/image_proxy?url=${encodeURIComponent(task.audioMeta.cover_url)}`
                : '/placeholder.png'
            }
            alt="封面"
          />
        )}

        <div className="flex w-full items-center justify-between gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="line-clamp-2 max-w-[180px] flex-1 overflow-hidden text-sm text-ellipsis">
                  {title}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{title}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[10px]">
        <div className="flex shrink-0 items-center gap-1">
          {task.status === 'SUCCESS' && (
            <div className="bg-primary w-10 rounded p-0.5 text-center text-white">已完成</div>
          )}
          {task.status !== 'SUCCESS' && task.status !== 'FAILED' ? (
            <div className="w-10 rounded bg-green-500 p-0.5 text-center text-white">等待中</div>
          ) : null}
          {task.status === 'FAILED' && (
            <div className="w-10 rounded bg-red-500 p-0.5 text-center text-white">失败</div>
          )}
        </div>

        <div className="flex min-w-0 items-center gap-1">
          <Select
            value={task.categoryId || UNCATEGORIZED_VALUE}
            onValueChange={value =>
              onMoveToCategory(task.id, value === UNCATEGORIZED_VALUE ? undefined : value)
            }
          >
            <SelectTrigger
              size="sm"
              className="h-7 max-w-[120px] text-xs"
              onClick={event => event.stopPropagation()}
            >
              <SelectValue placeholder="分类" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNCATEGORIZED_VALUE}>未分类</SelectItem>
              {categories.map(category => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {task.status === 'SUCCESS' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={event => {
                      event.stopPropagation()
                      if (
                        window.confirm(
                          '确认清理这篇笔记的本地缓存文件？这不会删除笔记内容、版本历史或分类。'
                        )
                      ) {
                        onClearCache(task.id)
                      }
                    }}
                    className="h-7 w-7 shrink-0 px-0"
                  >
                    <HardDrive className="text-muted-foreground h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>清理缓存</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={event => {
                    event.stopPropagation()
                    if (window.confirm('删除后会先移入回收站，可在回收站恢复。确认删除？')) {
                      onRemove(task.id)
                    }
                  }}
                  className="h-7 w-7 shrink-0 px-0"
                >
                  <Trash className="text-muted-foreground h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>删除</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  )
}
