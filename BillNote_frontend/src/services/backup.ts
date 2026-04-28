import request from '@/utils/request'
import type {
  NotesBackupFile,
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
