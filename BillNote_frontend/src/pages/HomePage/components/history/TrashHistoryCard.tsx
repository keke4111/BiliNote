import { RotateCcw, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils.ts'
import { Button } from '@/components/ui/button.tsx'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip.tsx'
import LazyImage from '@/components/LazyImage.tsx'
import type { TrashItem } from '@/features/notes/types'
import { formatHistoryDate, getTaskTitle, getTrashItemTitle } from '@/features/notes/utils'

interface TrashHistoryCardProps {
  item: TrashItem
  baseURL: string
  onRestoreTask: (taskId: string) => void
  onRestoreVersion: (taskId: string, versionId: string) => boolean
  onPermanentlyRemoveTask: (taskId: string) => void
  onPermanentlyRemoveVersion: (taskId: string, versionId: string) => void
}

export function TrashHistoryCard({
  item,
  baseURL,
  onRestoreTask,
  onRestoreVersion,
  onPermanentlyRemoveTask,
  onPermanentlyRemoveVersion,
}: TrashHistoryCardProps) {
  const title = getTrashItemTitle(item)
  const key =
    item.kind === 'task'
      ? `task-${item.task.id}`
      : `version-${item.deletedVersion.taskId}-${item.deletedVersion.version.ver_id}`

  return (
    <div
      key={key}
      className="flex cursor-default flex-col rounded-md border border-neutral-200 bg-neutral-50 p-3"
    >
      <div className="flex items-center gap-4">
        {item.kind === 'task' ? (
          item.task.platform === 'local' ? (
            <img
              src={
                item.task.audioMeta.cover_url
                  ? `${item.task.audioMeta.cover_url}`
                  : '/placeholder.png'
              }
              alt="封面"
              className="h-10 w-12 rounded-md object-cover"
            />
          ) : (
            <LazyImage
              src={
                item.task.audioMeta.cover_url
                  ? `${baseURL}/image_proxy?url=${encodeURIComponent(item.task.audioMeta.cover_url)}`
                  : '/placeholder.png'
              }
              alt="封面"
            />
          )
        ) : (
          <div className="bg-primary-light text-primary flex h-10 w-12 shrink-0 items-center justify-center rounded-md text-xs font-semibold">
            版本
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="line-clamp-2 max-w-[180px] overflow-hidden text-sm text-ellipsis">
                  {title}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{title}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {item.kind === 'version' && (
            <div className="text-muted-foreground text-[10px]">
              版本 · {getTaskTitle(item.task)} · {item.deletedVersion.version.ver_id.slice(-6)} ·{' '}
              {formatHistoryDate(item.deletedAt)}
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[10px]">
        <div className="flex shrink-0 items-center gap-1">
          <div
            className={cn(
              'w-10 rounded p-0.5 text-center text-white',
              item.kind === 'task' ? 'bg-neutral-500' : 'bg-amber-500'
            )}
          >
            {item.kind === 'task' ? '笔记' : '版本'}
          </div>
          <span className="text-muted-foreground">删除于 {formatHistoryDate(item.deletedAt)}</span>
        </div>

        <TooltipProvider>
          <div className="flex gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={event => {
                    event.stopPropagation()
                    if (item.kind === 'task') {
                      onRestoreTask(item.task.id)
                      return
                    }

                    onRestoreVersion(item.deletedVersion.taskId, item.deletedVersion.version.ver_id)
                  }}
                  className="h-7 w-7 shrink-0 px-0"
                >
                  <RotateCcw className="text-muted-foreground h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>恢复</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={event => {
                    event.stopPropagation()
                    if (!window.confirm('永久删除后将无法从回收站恢复，确认继续？')) return

                    if (item.kind === 'task') {
                      onPermanentlyRemoveTask(item.task.id)
                    } else {
                      onPermanentlyRemoveVersion(
                        item.deletedVersion.taskId,
                        item.deletedVersion.version.ver_id
                      )
                    }
                  }}
                  className="h-7 w-7 shrink-0 px-0"
                >
                  <XCircle className="text-destructive h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>永久删除</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>
    </div>
  )
}
