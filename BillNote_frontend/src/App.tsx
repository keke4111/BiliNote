import './App.css'
import { lazy, Suspense, useEffect } from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useTaskPolling } from '@/hooks/useTaskPolling.ts'
import { useNotesBackupSync } from '@/hooks/useNotesBackupSync.ts'
import { useCheckBackend } from '@/hooks/useCheckBackend.ts'
import { systemCheck } from '@/services/system.ts'
import { AppErrorBoundary } from '@/components/AppErrorBoundary'
import BackendInitDialog from '@/components/BackendInitDialog'
import Index from '@/pages/Index.tsx'
import { HomePage } from './pages/HomePage/Home.tsx'

const SettingPage = lazy(() => import('./pages/SettingPage/index.tsx'))
const Model = lazy(() => import('@/pages/SettingPage/Model.tsx'))
const ProviderForm = lazy(() => import('@/components/Form/modelForm/Form.tsx'))
const AboutPage = lazy(() => import('@/pages/SettingPage/about.tsx'))
const Monitor = lazy(() => import('@/pages/SettingPage/Monitor.tsx'))
const BackupPage = lazy(() => import('@/pages/SettingPage/Backup.tsx'))
const Downloader = lazy(() => import('@/pages/SettingPage/Downloader.tsx'))
const DownloaderForm = lazy(() => import('@/components/Form/DownloaderForm/Form.tsx'))
const TranscriberPage = lazy(() => import('@/pages/SettingPage/transcriber.tsx'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

const RouteErrorBoundary = ({ children }: { children: ReactNode }) => {
  const location = useLocation()
  return <AppErrorBoundary resetKey={location.pathname}>{children}</AppErrorBoundary>
}

function App() {
  useTaskPolling(3000)
  useNotesBackupSync()
  const { loading, initialized } = useCheckBackend()

  useEffect(() => {
    if (initialized) {
      systemCheck()
    }
  }, [initialized])

  if (!initialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-white text-sm text-neutral-600">
        <BackendInitDialog open={loading || !initialized} />
        <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm">
          正在连接后端服务...
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <RouteErrorBoundary>
        <Suspense
          fallback={<div className="flex h-screen items-center justify-center">加载中...</div>}
        >
          <Routes>
            <Route path="/" element={<Index />}>
              <Route index element={<HomePage />} />
              <Route path="settings" element={<SettingPage />}>
                <Route index element={<Navigate to="model" replace />} />
                <Route path="model" element={<Model />}>
                  <Route path="new" element={<ProviderForm isCreate />} />
                  <Route path=":id" element={<ProviderForm />} />
                </Route>
                <Route path="download" element={<Downloader />}>
                  <Route path=":id" element={<DownloaderForm />} />
                </Route>
                <Route path="transcriber" element={<TranscriberPage />} />
                <Route path="monitor" element={<Monitor />} />
                <Route path="backup" element={<BackupPage />} />
                <Route path="about" element={<AboutPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </Suspense>
      </RouteErrorBoundary>
    </BrowserRouter>
  )
}

export default App
