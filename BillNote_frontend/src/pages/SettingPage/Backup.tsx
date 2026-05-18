import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { toast } from 'react-hot-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  buildNotesBackupSnapshot,
  getPersistedTaskStoreState,
  useTaskStore,
} from '@/store/taskStore'
import {
  exportNotesStoreSnapshot,
  exportNotesBackupBundle,
  getNotesBackupStatus,
  importNotesBackupBundle,
  importNotesStoreSnapshot,
  listNotesBackups,
  syncNotesStoreSnapshot,
} from '@/services/backup'
import type { NotesBackupFile, NotesBackupStatus } from '@/store/taskStore'
import { Database, Download, Loader2, RefreshCw, Upload } from 'lucide-react'

const formatDate = (value?: string | null) => {
  if (!value) return '未备份'
  return new Date(value).toLocaleString('zh-CN')
}

const formatSize = (size: number) => {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

export default function BackupPage() {
  const tasks = useTaskStore(state => state.tasks)
  const categories = useTaskStore(state => state.categories)
  const deletedVersions = useTaskStore(state => state.deletedVersions)
  const currentTaskId = useTaskStore(state => state.currentTaskId)
  const importBackupSnapshot = useTaskStore(state => state.importBackupSnapshot)

  const [status, setStatus] = useState<NotesBackupStatus | null>(null)
  const [backupFiles, setBackupFiles] = useState<NotesBackupFile[]>([])
  const [selectedFile, setSelectedFile] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [bundleExporting, setBundleExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [bundleImporting, setBundleImporting] = useState(false)
  const bundleInputRef = useRef<HTMLInputElement | null>(null)

  const browserTaskCount = tasks.length
  const browserDeletedTaskCount = tasks.filter(task => task.isDeleted).length
  const browserDeletedVersionCount = deletedVersions.length

  const backupInSync = useMemo(() => {
    if (!status?.backupExists) return false
    return (
      status.backupTaskCount === browserTaskCount &&
      status.backupDeletedTaskCount === browserDeletedTaskCount &&
      status.backupDeletedVersionCount === browserDeletedVersionCount
    )
  }, [status, browserTaskCount, browserDeletedTaskCount, browserDeletedVersionCount])

  const createSnapshot = useCallback(() => {
    return buildNotesBackupSnapshot(
      getPersistedTaskStoreState({
        tasks,
        categories,
        deletedVersions,
        currentTaskId,
      })
    )
  }, [tasks, categories, deletedVersions, currentTaskId])

  const loadBackupData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      const [backupStatus, files] = await Promise.all([getNotesBackupStatus(), listNotesBackups()])
      setStatus(backupStatus)
      setBackupFiles(files)
      setSelectedFile(current =>
        current && files.some(file => file.name === current) ? current : files[0]?.name || ''
      )
    } catch (error) {
      console.error('加载笔记备份信息失败:', error)
      toast.error('加载笔记备份信息失败')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadBackupData()
  }, [loadBackupData])

  const handleExport = async () => {
    setExporting(true)
    try {
      const file = await exportNotesStoreSnapshot(createSnapshot())
      toast.success(`导出成功：${file.name}`)
      await loadBackupData(true)
    } catch (error) {
      console.error('导出笔记库失败:', error)
      toast.error('导出笔记库失败')
    } finally {
      setExporting(false)
    }
  }

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleExportBundle = async () => {
    setBundleExporting(true)
    try {
      const result = await exportNotesBackupBundle(createSnapshot())
      downloadBlob(result.blob, result.filename)
      toast.success(`完整备份包导出成功：${result.filename}`)
    } catch (error) {
      console.error('导出完整备份包失败:', error)
      toast.error('导出完整备份包失败')
    } finally {
      setBundleExporting(false)
    }
  }

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error('请选择一个备份文件')
      return
    }

    setImporting(true)
    try {
      const payload = await importNotesStoreSnapshot(selectedFile)
      const result = importBackupSnapshot(payload.snapshot)
      await syncNotesStoreSnapshot(
        buildNotesBackupSnapshot(getPersistedTaskStoreState(useTaskStore.getState()))
      )
      await loadBackupData(true)

      toast.success(
        `导入完成：新增 ${result.addedTasks} 篇笔记，补充 ${result.mergedVersions} 个版本，新增 ${result.addedCategories} 个分类，新增 ${result.addedDeletedVersions} 个已删除版本`
      )
    } catch (error) {
      console.error('导入笔记库失败:', error)
      toast.error('导入笔记库失败')
    } finally {
      setImporting(false)
    }
  }

  const handleBundleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setBundleImporting(true)
    try {
      const payload = await importNotesBackupBundle(file)
      const result = importBackupSnapshot(payload.snapshot)
      await syncNotesStoreSnapshot(
        buildNotesBackupSnapshot(getPersistedTaskStoreState(useTaskStore.getState()))
      )
      await loadBackupData(true)

      toast.success(
        `完整备份导入完成：新增 ${result.addedTasks} 篇笔记，恢复 ${payload.restoredImages.length} 张图片，跳过 ${payload.skippedImages.length} 个文件`
      )
    } catch (error) {
      console.error('导入完整备份包失败:', error)
      toast.error('导入完整备份包失败')
    } finally {
      setBundleImporting(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-semibold">笔记备份</h2>
        <p className="mt-1 text-sm text-neutral-500">
          浏览器中的 `task-storage` 仍是当前主数据源，目录备份用于恢复和迁移。
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Database className="h-5 w-5" />
            备份健康状态
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadBackupData(true)}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            刷新
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-neutral-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              加载中...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-neutral-500">浏览器数据</div>
                  <div className="mt-2 space-y-1 text-sm">
                    <div>笔记总数：{browserTaskCount}</div>
                    <div>已删除笔记：{browserDeletedTaskCount}</div>
                    <div>已删除版本：{browserDeletedVersionCount}</div>
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-neutral-500">目录备份</div>
                  <div className="mt-2 space-y-1 text-sm">
                    <div>笔记总数：{status?.backupTaskCount ?? 0}</div>
                    <div>已删除笔记：{status?.backupDeletedTaskCount ?? 0}</div>
                    <div>已删除版本：{status?.backupDeletedVersionCount ?? 0}</div>
                    <div>最后备份：{formatDate(status?.lastBackupAt)}</div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Badge
                  variant={backupInSync ? 'default' : 'secondary'}
                  className={
                    backupInSync ? 'bg-green-500 hover:bg-green-600' : 'bg-amber-100 text-amber-700'
                  }
                >
                  {backupInSync ? '数量一致' : '数量不一致'}
                </Badge>
                <span className="text-sm text-neutral-500">
                  备份路径：{status?.path || 'backup/notes/latest.task-storage.json'}
                </span>
              </div>

              {!backupInSync && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                  浏览器数据是当前主数据源，目录备份可能落后。自动同步会持续覆盖最新快照。
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">导出 / 导入</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              导出笔记库 JSON
            </Button>
            <Button variant="outline" onClick={handleExportBundle} disabled={bundleExporting}>
              {bundleExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              导出完整备份包
            </Button>
            <Button variant="outline" onClick={handleImport} disabled={importing || !selectedFile}>
              {importing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              导入所选备份
            </Button>
            <Button
              variant="outline"
              onClick={() => bundleInputRef.current?.click()}
              disabled={bundleImporting}
            >
              {bundleImporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              导入完整备份包
            </Button>
            <input
              ref={bundleInputRef}
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              onChange={handleBundleFileChange}
            />
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">
            JSON 备份只包含笔记数据，不包含图片；完整备份包会额外包含本地截图和封面图片。
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">可导入备份文件</div>
            <Select value={selectedFile} onValueChange={setSelectedFile}>
              <SelectTrigger className="w-full max-w-xl">
                <SelectValue placeholder="请选择备份文件" />
              </SelectTrigger>
              <SelectContent>
                {backupFiles.map(file => (
                  <SelectItem key={file.name} value={file.name}>
                    {file.isLatest ? '[最新] ' : ''}
                    {file.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 text-sm text-neutral-600">
            {backupFiles.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4">当前还没有可用备份文件。</div>
            ) : (
              backupFiles.slice(0, 8).map(file => (
                <div key={file.relativePath} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{file.name}</div>
                      <div className="truncate text-xs text-neutral-500">{file.relativePath}</div>
                    </div>
                    <Badge variant="outline">{formatSize(file.size)}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-neutral-500">
                    <span>笔记：{file.taskCount}</span>
                    <span>已删除笔记：{file.deletedTaskCount}</span>
                    <span>已删除版本：{file.deletedVersionCount}</span>
                    <span>时间：{formatDate(file.exportedAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
