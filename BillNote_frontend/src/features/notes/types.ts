export type TaskStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'PARSING'
  | 'DOWNLOADING'
  | 'TRANSCRIBING'
  | 'SUMMARIZING'
  | 'SAVING'
  | 'SUCCESS'
  | 'FAILED'
export type SortMode = 'latest' | 'oldest' | 'title-asc' | 'title-desc'
export type ActiveHistoryView = 'all' | 'uncategorized' | 'trash' | string

export interface AudioMeta {
  cover_url: string
  duration: number
  file_path: string
  platform: string
  raw_info: any
  title: string
  video_id: string
}

export interface Segment {
  start: number
  end: number
  text: string
}

export interface Transcript {
  full_text: string
  language: string
  raw: any
  segments: Segment[]
}

export interface Markdown {
  ver_id: string
  content: string
  style: string
  model_name: string
  created_at: string
  source_ver_id?: string
  edited_manually?: boolean
}

export type MarkdownVersion = Markdown

export interface Category {
  id: string
  name: string
  createdAt: string
}

export interface DeletedMarkdownVersion {
  taskId: string
  version: MarkdownVersion
  deletedAt: string
}

export interface NoteFormData {
  video_url: string
  link: undefined | boolean
  screenshot: undefined | boolean
  platform: string
  quality: string
  model_name: string
  provider_id: string
  extras?: string
  format?: string[]
  video_understanding?: boolean
  video_interval?: number
  grid_size?: [number, number]
  task_id?: string
  style?: string
}

export interface Task {
  id: string
  markdown: string | MarkdownVersion[]
  transcript: Transcript
  status: TaskStatus
  message?: string
  progress?: TaskProgress
  isDeleted?: boolean
  deletedAt?: string
  categoryId?: string
  platform?: string
  audioMeta: AudioMeta
  createdAt: string
  formData: NoteFormData
}

export interface TaskProgress {
  phase: string
  current: number
  total: number
  percent: number
  detail?: string
}

export interface NotesBackupSnapshot {
  tasks: Task[]
  categories: Category[]
  deletedVersions: DeletedMarkdownVersion[]
  currentTaskId: string | null
  schemaVersion: number
  exportedAt: string
}

export interface NotesBackupStatus {
  backupExists: boolean
  backupTaskCount: number
  backupDeletedTaskCount: number
  backupDeletedVersionCount: number
  lastBackupAt: string | null
  schemaVersion: number | null
  path: string
}

export interface NotesBackupFile {
  name: string
  relativePath: string
  size: number
  isLatest: boolean
  exportedAt: string | null
  taskCount: number
  deletedTaskCount: number
  deletedVersionCount: number
}

export interface NotesBackupImportPayload {
  file: NotesBackupFile
  snapshot: NotesBackupSnapshot
}

export type TrashItem =
  | { kind: 'task'; task: Task; deletedAt: string }
  | { kind: 'version'; deletedVersion: DeletedMarkdownVersion; task?: Task; deletedAt: string }
