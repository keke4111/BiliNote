import { useEffect, useRef } from 'react'
import { syncNotesStoreSnapshot } from '@/services/backup'
import {
  buildNotesBackupSnapshot,
  getPersistedTaskStoreState,
  useTaskStore,
} from '@/store/taskStore'

export const useNotesBackupSync = (delay = 800) => {
  const lastSnapshotRef = useRef('')
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    const scheduleSync = () => {
      const snapshot = buildNotesBackupSnapshot(getPersistedTaskStoreState(useTaskStore.getState()))
      const serialized = JSON.stringify(snapshot)
      if (serialized === lastSnapshotRef.current) return

      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
      }

      timerRef.current = window.setTimeout(async () => {
        try {
          await syncNotesStoreSnapshot(snapshot)
          lastSnapshotRef.current = serialized
        } catch (error) {
          console.error('笔记库备份同步失败:', error)
        }
      }, delay)
    }

    scheduleSync()
    const unsubscribe = useTaskStore.subscribe(() => {
      scheduleSync()
    })

    return () => {
      unsubscribe()
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
      }
    }
  }, [delay])
}
