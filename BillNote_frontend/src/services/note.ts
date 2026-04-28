import request from '@/utils/request'
import axios from 'axios'
import toast from 'react-hot-toast'

export const generateNote = async (data: {
  video_url: string
  platform: string
  quality: string
  model_name: string
  provider_id: string
  task_id?: string
  format: Array<string>
  style: string
  extras?: string
  video_understand?: boolean
  video_interval?: number
  grid_size: Array<number>
}) => {
  try {
    console.log('generateNote', data)
    const response = await request.post('/generate_note', data)

    if (!response) {
      if (response.data.msg) {
        toast.error(response.data.msg)
      }
      return null
    }
    toast.success('笔记生成任务已提交！')

    console.log('res', response)
    // 成功提示

    return response
  } catch (e: any) {
    console.error('❌ 请求出错', e)

    // 错误提示
    // toast.error('笔记生成失败，请稍后重试')

    throw e // 抛出错误以便调用方处理
  }
}

export const delete_task = async ({ video_id, platform }) => {
  try {
    const data = {
      video_id,
      platform,
    }
    const res = await request.post('/delete_task', data)

    toast.success('任务已成功删除')
    return res
  } catch (e) {
    toast.error('请求异常，删除任务失败')
    console.error('❌ 删除任务失败:', e)
    throw e
  }
}

export const clear_task_cache = async (task_id: string) => {
  try {
    const res = await request.post('/clear_task_cache', { task_id })
    const deletedCount = res?.deleted?.length || 0
    const missingCount = res?.missing?.length || 0

    if (deletedCount > 0) {
      toast.success(
        missingCount > 0
          ? `已清理 ${deletedCount} 个缓存文件，另有 ${missingCount} 个文件原本不存在`
          : `已清理 ${deletedCount} 个缓存文件`
      )
    } else if (missingCount > 0) {
      toast.success('缓存文件已不存在，无需重复清理')
    } else {
      toast.success('缓存清理完成')
    }

    return res
  } catch (e) {
    toast.error('请求异常，清理缓存失败')
    console.error('清理缓存失败:', e)
    throw e
  }
}

export const get_task_status = async (task_id: string) => {
  try {
    // 成功提示

    return await request.get('/task_status/' + task_id)
  } catch (e) {
    console.error('❌ 请求出错', e)

    // 错误提示
    toast.error('笔记生成失败，请稍后重试')

    throw e // 抛出错误以便调用方处理
  }
}

const getDownloadFileName = (contentDisposition?: string) => {
  if (!contentDisposition) return 'note.zip'
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1])
  }
  const fallbackMatch = contentDisposition.match(/filename="?([^";]+)"?/i)
  return fallbackMatch?.[1] || 'note.zip'
}

export const exportMarkdownBundle = async (data: { title: string; markdown: string }) => {
  const baseURL = String(import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
  const response = await axios.post(`${baseURL}/export_markdown_bundle`, data, {
    responseType: 'blob',
  })

  return {
    blob: response.data as Blob,
    filename: getDownloadFileName(response.headers['content-disposition']),
  }
}
