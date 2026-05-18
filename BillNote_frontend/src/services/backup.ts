import request from '@/utils/request'
import axios from 'axios'
import type {
  NotesBackupFile,
  NotesBackupBundleImportPayload,
  NotesBackupImportPayload,
  NotesBackupSnapshot,
  NotesBackupStatus,
} from '@/features/notes/types'

export const syncNotesStoreSnapshot = async (snapshot: NotesBackupSnapshot) => {
  return await request.post('/backup/sync_notes_store', snapshot, {
    silent: true,
  })
}

export const getNotesBackupStatus = async (): Promise<NotesBackupStatus> => {
  return await request.get('/backup/notes_status', {
    silent: true,
  })
}

export const exportNotesStoreSnapshot = async (
  snapshot: NotesBackupSnapshot
): Promise<NotesBackupFile> => {
  return await request.post('/backup/export_notes_store', snapshot)
}

export const listNotesBackups = async (): Promise<NotesBackupFile[]> => {
  return await request.get('/backup/list_note_backups', {
    silent: true,
  })
}

export const importNotesStoreSnapshot = async (
  filename: string
): Promise<NotesBackupImportPayload> => {
  return await request.post('/backup/import_notes_store', { filename })
}

const getDownloadFileName = (contentDisposition?: string) => {
  if (!contentDisposition) return 'notes-backup.zip'
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1])
  const fallbackMatch = contentDisposition.match(/filename="?([^";]+)"?/i)
  return fallbackMatch?.[1] || 'notes-backup.zip'
}

export const exportNotesBackupBundle = async (snapshot: NotesBackupSnapshot) => {
  const baseURL = String(import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
  const response = await axios.post(`${baseURL}/backup/export_notes_bundle`, snapshot, {
    responseType: 'blob',
  })

  return {
    blob: response.data as Blob,
    filename: getDownloadFileName(response.headers['content-disposition']),
  }
}

export const importNotesBackupBundle = async (
  file: File
): Promise<NotesBackupBundleImportPayload> => {
  const baseURL = String(import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
  const formData = new FormData()
  formData.append('file', file)
  const response = await axios.post(`${baseURL}/backup/import_notes_bundle`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 0,
  })
  const payload = response.data
  if (payload?.code !== 0) {
    throw payload
  }
  return payload.data
}
