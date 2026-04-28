'use client'

import { useEffect, useState } from 'react'
import { BrainCircuit, Copy, Download, MessageSquare, Pencil, Trash } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'

interface VersionNote {
  ver_id: string
  model_name?: string
  style?: string
  created_at?: string
  edited_manually?: boolean
}

interface NoteHeaderProps {
  currentTask?: {
    markdown: VersionNote[] | string
  } | null
  isMultiVersion: boolean
  currentVerId: string
  setCurrentVerId: (id: string) => void
  modelName: string
  style: string
  noteStyles: ReadonlyArray<{ value: string; label: string }>
  onCopy: () => void
  onDownload: () => void
  onDownloadBundle?: () => void
  onDeleteVersion?: () => void
  onStartEditing?: () => void
  isEditing?: boolean
  createAt?: string | Date
  showTranscribe?: boolean
  setShowTranscribe: (show: boolean) => void
  showChat?: false | 'half' | 'full'
  setShowChat?: (mode: false | 'half' | 'full') => void
  viewMode?: 'map' | 'preview'
  setViewMode?: (mode: 'map' | 'preview') => void
}

export function MarkdownHeader({
  currentTask,
  isMultiVersion,
  currentVerId,
  setCurrentVerId,
  modelName,
  style,
  noteStyles,
  onCopy,
  onDownload,
  onDownloadBundle,
  onDeleteVersion,
  onStartEditing,
  isEditing = false,
  createAt,
  showTranscribe,
  setShowTranscribe,
  showChat,
  setShowChat,
  viewMode,
  setViewMode,
}: NoteHeaderProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let timer: NodeJS.Timeout
    if (copied) {
      timer = setTimeout(() => setCopied(false), 2000)
    }
    return () => clearTimeout(timer)
  }, [copied])

  const handleCopy = () => {
    onCopy()
    setCopied(true)
  }

  const styleName = noteStyles.find(v => v.value === style)?.label || style
  const versions: VersionNote[] = Array.isArray(currentTask?.markdown) ? currentTask.markdown : []

  const formatDate = (date: string | Date | undefined) => {
    if (!date) return ''
    const d = typeof date === 'string' ? new Date(date) : date
    if (Number.isNaN(d.getTime())) return ''
    return d
      .toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
      .replace(/\//g, '-')
  }

  const currentVersion = versions.find(version => version.ver_id === currentVerId)
  const currentVersionLabel = currentVersion?.edited_manually ? '手动编辑版' : '原始生成版'

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b bg-white/95 px-4 py-2 backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-3">
        {isMultiVersion && (
          <div className="flex items-center gap-1">
            <Select value={currentVerId} onValueChange={setCurrentVerId} disabled={isEditing}>
              <SelectTrigger className="h-8 w-[190px] text-sm">
                <div className="flex items-center">
                  {currentVersion
                    ? `${currentVersion.edited_manually ? '手动版' : '原始版'}（${currentVerId.slice(-6)}）`
                    : ''}
                </div>
              </SelectTrigger>

              <SelectContent>
                {versions.map(version => {
                  const shortId = version.ver_id.slice(-6)
                  const label = version.edited_manually ? '手动版' : '原始版'
                  return (
                    <SelectItem key={version.ver_id} value={version.ver_id}>
                      {`${label}（${shortId}）`}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>

            {onDeleteVersion && versions.length > 1 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={onDeleteVersion}
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-red-500 hover:text-red-600"
                      disabled={isEditing}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>删除当前版本</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        )}

        {!isMultiVersion && currentVersionLabel && (
          <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-200">
            {currentVersionLabel}
          </Badge>
        )}

        {isMultiVersion && currentVersion && (
          <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-200">
            {currentVersionLabel}
          </Badge>
        )}

        <Badge variant="secondary" className="bg-pink-100 text-pink-700 hover:bg-pink-200">
          {modelName}
        </Badge>
        <Badge variant="secondary" className="bg-cyan-100 text-cyan-700 hover:bg-cyan-200">
          {styleName}
        </Badge>

        {createAt && (
          <div className="text-muted-foreground text-sm">创建时间: {formatDate(createAt)}</div>
        )}
      </div>

      <div className="flex items-center gap-1">
        {onStartEditing && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={onStartEditing}
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  disabled={isEditing}
                >
                  <Pencil className="mr-1.5 h-4 w-4" />
                  <span className="text-sm">编辑笔记</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>编辑当前版本</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => {
                  setViewMode?.(viewMode === 'preview' ? 'map' : 'preview')
                }}
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                disabled={isEditing}
              >
                <BrainCircuit className="mr-1.5 h-4 w-4" />
                <span className="text-sm">{viewMode === 'preview' ? '思维导图' : 'Markdown'}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>切换预览与思维导图</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={handleCopy} variant="ghost" size="sm" className="h-8 px-2">
                <Copy className="mr-1.5 h-4 w-4" />
                <span className="text-sm">{copied ? '已复制' : '复制'}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>复制当前内容</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={onDownload} variant="ghost" size="sm" className="h-8 px-2">
                <Download className="mr-1.5 h-4 w-4" />
                <span className="text-sm">导出 Markdown</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>下载为 Markdown 文件</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {onDownloadBundle && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={onDownloadBundle} variant="ghost" size="sm" className="h-8 px-2">
                  <Download className="mr-1.5 h-4 w-4" />
                  <span className="text-sm">导出图片包</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>下载 Markdown 和本地图片压缩包</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => {
                  setShowTranscribe(!showTranscribe)
                }}
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                disabled={isEditing}
              >
                <span className="text-sm">原文参照</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>显示或隐藏转写原文</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {setShowChat && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => setShowChat(showChat ? false : 'half')}
                  variant={showChat ? 'default' : 'ghost'}
                  size="sm"
                  className="h-8 px-2"
                  disabled={isEditing}
                >
                  <MessageSquare className="mr-1.5 h-4 w-4" />
                  <span className="text-sm">AI 问答</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>基于当前笔记内容进行 AI 问答</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  )
}
