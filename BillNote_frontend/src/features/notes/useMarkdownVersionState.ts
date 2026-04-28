import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import type { MarkdownVersion, Task } from './types'
import { getLatestVersion } from './utils'

interface UseMarkdownVersionStateArgs {
  currentTask: Task | null
  deleteMarkdownVersion: (taskId: string, versionId: string) => boolean
  saveEditedMarkdownVersion: (
    taskId: string,
    sourceVersionId: string,
    content: string
  ) => { versionId: string } | null
}

export function useMarkdownVersionState({
  currentTask,
  deleteMarkdownVersion,
  saveEditedMarkdownVersion,
}: UseMarkdownVersionStateArgs) {
  const [currentVerId, setCurrentVerId] = useState('')
  const [selectedContent, setSelectedContent] = useState('')
  const [modelName, setModelName] = useState('')
  const [style, setStyle] = useState('')
  const [createTime, setCreateTime] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [draftContent, setDraftContent] = useState('')
  const isMultiVersion = Array.isArray(currentTask?.markdown)

  useEffect(() => {
    if (!currentTask) return

    if (!isMultiVersion) {
      setCurrentVerId('')
      setModelName(currentTask.formData.model_name)
      setStyle(currentTask.formData.style || '')
      setCreateTime(currentTask.createdAt)
      setSelectedContent(typeof currentTask.markdown === 'string' ? currentTask.markdown : '')
      return
    }

    const versions = currentTask.markdown as MarkdownVersion[]
    const latestVersion = getLatestVersion(versions)
    if (!latestVersion) return

    const currentVersionExists = versions.some(version => version.ver_id === currentVerId)
    setCurrentVerId(currentVersionExists ? currentVerId : latestVersion.ver_id)
  }, [currentTask, currentVerId, isMultiVersion])

  useEffect(() => {
    if (!currentTask || !isMultiVersion) return

    const currentVersion = (currentTask.markdown as MarkdownVersion[]).find(
      version => version.ver_id === currentVerId
    )
    if (!currentVersion) return

    setModelName(currentVersion.model_name)
    setStyle(currentVersion.style)
    setCreateTime(currentVersion.created_at || '')
    setSelectedContent(currentVersion.content)
  }, [currentTask, currentVerId, isMultiVersion])

  useEffect(() => {
    setIsEditing(false)
    setDraftContent('')
  }, [currentTask?.id, currentVerId])

  const handleVersionChange = (versionId: string) => {
    setIsEditing(false)
    setDraftContent('')
    setCurrentVerId(versionId)
  }

  const startEditing = () => {
    if (!currentTask) return
    setDraftContent(selectedContent)
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setDraftContent('')
    setIsEditing(false)
  }

  const saveEditing = () => {
    if (!currentTask) return

    const result = saveEditedMarkdownVersion(currentTask.id, currentVerId, draftContent)
    if (!result) {
      toast.error('保存失败')
      return
    }

    setCurrentVerId(result.versionId)
    setDraftContent('')
    setIsEditing(false)
    toast.success('笔记修改已保存')
  }

  const handleDeleteVersion = () => {
    if (!currentTask || !Array.isArray(currentTask.markdown) || !currentVerId) return

    if (currentTask.markdown.length <= 1) {
      toast.error('至少保留一个版本')
      return
    }

    const confirmed = window.confirm(
      `删除版本（${currentVerId.slice(-6)}）后会移入回收站，可在回收站恢复。确认删除？`
    )
    if (!confirmed) return

    setIsEditing(false)
    setDraftContent('')

    const remainingVersions = currentTask.markdown.filter(
      version => version.ver_id !== currentVerId
    )
    const nextVersion = getLatestVersion(remainingVersions)
    const deleted = deleteMarkdownVersion(currentTask.id, currentVerId)
    if (deleted && nextVersion) {
      setCurrentVerId(nextVersion.ver_id)
    }
  }

  return {
    cancelEditing,
    createTime,
    currentVerId,
    draftContent,
    handleDeleteVersion,
    isEditing,
    isMultiVersion,
    modelName,
    saveEditing,
    selectedContent,
    setCurrentVerId: handleVersionChange,
    setDraftContent,
    startEditing,
    style,
  }
}
