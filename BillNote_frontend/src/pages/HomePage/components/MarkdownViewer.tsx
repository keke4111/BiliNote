import { FC, memo, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Button } from '@/components/ui/button.tsx'
import { ArrowRight, Copy, ExternalLink, Play, Save, X } from 'lucide-react'
import { toast } from 'react-hot-toast'
import Error from '@/components/Lottie/error.tsx'
import Loading from '@/components/Lottie/Loading.tsx'
import Idle from '@/components/Lottie/Idle.tsx'
import StepBar from '@/pages/HomePage/components/StepBar.tsx'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { atomDark as codeStyle } from 'react-syntax-highlighter/dist/esm/styles/prism'
import Zoom from 'react-medium-image-zoom'
import 'react-medium-image-zoom/dist/styles.css'
import gfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import 'github-markdown-css/github-markdown-light.css'
import { ScrollArea } from '@/components/ui/scroll-area.tsx'
import { Textarea } from '@/components/ui/textarea.tsx'
import { useTaskStore } from '@/store/taskStore'
import { noteStyles } from '@/constant/note.ts'
import { MarkdownHeader } from '@/pages/HomePage/components/MarkdownHeader.tsx'
import TranscriptViewer from '@/pages/HomePage/components/transcriptViewer.tsx'
import MarkmapEditor from '@/pages/HomePage/components/MarkmapComponent.tsx'
import ChatPanel from '@/pages/HomePage/components/ChatPanel.tsx'
import VideoBanner from '@/pages/HomePage/components/VideoBanner.tsx'
import { useMarkdownVersionState, type MarkdownVersion } from '@/features/notes'
import { exportMarkdownBundle } from '@/services/note.ts'

interface MarkdownViewerProps {
  content?: string | MarkdownVersion[]
  status: 'idle' | 'loading' | 'success' | 'failed'
}

const steps = [
  { label: '解析链接', key: 'PARSING' },
  { label: '下载音频', key: 'DOWNLOADING' },
  { label: '转写文字', key: 'TRANSCRIBING' },
  { label: '大模型总结', key: 'SUMMARIZING' },
  { label: '保存完成', key: 'SUCCESS' },
]

const remarkPlugins = [gfm, remarkMath]
const rehypePlugins = [rehypeKatex]

function createMarkdownComponents(baseURL: string) {
  return {
    h1: ({ children, ...props }: any) => (
      <h1
        className="text-primary my-6 scroll-m-20 text-3xl font-extrabold tracking-tight lg:text-4xl"
        {...props}
      >
        {children}
      </h1>
    ),
    h2: ({ children, ...props }: any) => (
      <h2
        className="text-primary mt-10 mb-4 scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight first:mt-0"
        {...props}
      >
        {children}
      </h2>
    ),
    h3: ({ children, ...props }: any) => (
      <h3
        className="text-primary mt-8 mb-4 scroll-m-20 text-xl font-semibold tracking-tight"
        {...props}
      >
        {children}
      </h3>
    ),
    h4: ({ children, ...props }: any) => (
      <h4
        className="text-primary mt-6 mb-2 scroll-m-20 text-lg font-semibold tracking-tight"
        {...props}
      >
        {children}
      </h4>
    ),
    p: ({ children, ...props }: any) => (
      <p className="leading-7 [&:not(:first-child)]:mt-6" {...props}>
        {children}
      </p>
    ),
    a: ({ href, children, ...props }: any) => {
      const firstChild = Array.isArray(children) ? children[0] : children
      const text = typeof firstChild === 'string' ? firstChild : ''
      const isOriginLink = text.startsWith('原片 @')

      if (isOriginLink) {
        const timeMatch = text.match(/原片 @ (\d{2}:\d{2})/)
        const timeText = timeMatch ? timeMatch[1] : '原片'

        return (
          <span className="origin-link my-2 inline-flex">
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
              {...props}
            >
              <Play className="h-3.5 w-3.5" />
              <span>原片（{timeText}）</span>
            </a>
          </span>
        )
      }

      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:text-primary/80 inline-flex items-center gap-0.5 font-medium underline underline-offset-4"
          {...props}
        >
          {children}
          {href?.startsWith('http') && <ExternalLink className="ml-0.5 inline-block h-3 w-3" />}
        </a>
      )
    },
    img: ({ src = '', ...props }: any) => {
      const resolvedSrc = src.startsWith('/') ? baseURL + src : src

      return (
        <div className="my-8 flex justify-center">
          <Zoom>
            <img
              {...props}
              src={resolvedSrc}
              className="max-w-full cursor-zoom-in rounded-lg object-cover shadow-md transition-all hover:shadow-lg"
              style={{ maxHeight: '500px' }}
            />
          </Zoom>
        </div>
      )
    },
    strong: ({ children, ...props }: any) => (
      <strong className="text-primary font-bold" {...props}>
        {children}
      </strong>
    ),
    li: ({ children, ...props }: any) => {
      const rawText = String(children)
      const isFakeHeading = /^(\*\*.+\*\*)$/.test(rawText.trim())

      if (isFakeHeading) {
        return <div className="text-primary my-4 text-lg font-bold">{children}</div>
      }

      return (
        <li className="my-1" {...props}>
          {children}
        </li>
      )
    },
    ul: ({ children, ...props }: any) => (
      <ul className="my-6 ml-6 list-disc [&>li]:mt-2" {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }: any) => (
      <ol className="my-6 ml-6 list-decimal [&>li]:mt-2" {...props}>
        {children}
      </ol>
    ),
    blockquote: ({ children, ...props }: any) => (
      <blockquote
        className="border-primary/20 text-muted-foreground mt-6 border-l-4 pl-4 italic"
        {...props}
      >
        {children}
      </blockquote>
    ),
    code: ({ inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '')
      const codeContent = String(children).replace(/\n$/, '')

      if (!inline && match) {
        return (
          <div className="group bg-muted relative my-6 overflow-hidden rounded-lg border shadow-sm">
            <div className="bg-muted text-muted-foreground flex items-center justify-between px-4 py-1.5 text-sm font-medium">
              <div>{match[1].toUpperCase()}</div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(codeContent)
                  toast.success('代码已复制')
                }}
                className="bg-background/80 hover:bg-background flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors"
              >
                <Copy className="h-3.5 w-3.5" />
                复制
              </button>
            </div>
            <SyntaxHighlighter
              style={codeStyle}
              language={match[1]}
              PreTag="div"
              className="!bg-muted !m-0 !p-0"
              customStyle={{
                margin: 0,
                padding: '1rem',
                background: 'transparent',
                fontSize: '0.9rem',
              }}
              {...props}
            >
              {codeContent}
            </SyntaxHighlighter>
          </div>
        )
      }

      return (
        <code
          className="bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm"
          {...props}
        >
          {children}
        </code>
      )
    },
    table: ({ children, ...props }: any) => (
      <div className="my-6 w-full overflow-y-auto">
        <table className="w-full border-collapse text-sm" {...props}>
          {children}
        </table>
      </div>
    ),
    th: ({ children, ...props }: any) => (
      <th
        className="border-muted-foreground/20 border px-4 py-2 text-left font-medium [&[align=center]]:text-center [&[align=right]]:text-right"
        {...props}
      >
        {children}
      </th>
    ),
    td: ({ children, ...props }: any) => (
      <td
        className="border-muted-foreground/20 border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right"
        {...props}
      >
        {children}
      </td>
    ),
    hr: ({ ...props }: any) => <hr className="border-muted-foreground/20 my-8" {...props} />,
  }
}

const MarkdownViewer: FC<MarkdownViewerProps> = memo(({ status }) => {
  const baseURL = (
    String(import.meta.env.VITE_API_BASE_URL || '').replace('/api', '') || ''
  ).replace(/\/$/, '')
  const currentTask = useTaskStore(state => state.getCurrentTask())
  const deleteMarkdownVersion = useTaskStore(state => state.deleteMarkdownVersion)
  const saveEditedMarkdownVersion = useTaskStore(state => state.saveEditedMarkdownVersion)
  const retryTask = useTaskStore(state => state.retryTask)
  const taskStatus = currentTask?.status || 'PENDING'
  const markdownComponents = useMemo(() => createMarkdownComponents(baseURL), [baseURL])
  const {
    createTime,
    currentVerId,
    draftContent,
    handleDeleteVersion,
    isEditing,
    isMultiVersion,
    modelName,
    saveEditing,
    selectedContent,
    setDraftContent,
    setCurrentVerId,
    startEditing,
    cancelEditing,
    style,
  } = useMarkdownVersionState({
    currentTask,
    deleteMarkdownVersion,
    saveEditedMarkdownVersion,
  })
  const [showTranscribe, setShowTranscribe] = useState(false)
  const [showChat, setShowChat] = useState<false | 'half' | 'full'>(false)
  const [viewMode, setViewMode] = useState<'map' | 'preview'>('preview')

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(selectedContent)
      toast.success('已复制到剪贴板')
    } catch {
      toast.error('复制失败')
    }
  }

  const handleDownload = () => {
    const name = currentTask?.audioMeta.title || 'note'
    const blob = new Blob([selectedContent], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${name}.md`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleDownloadBundle = async () => {
    if (!selectedContent) {
      toast.error('当前没有可导出的 Markdown 内容')
      return
    }

    try {
      const title = currentTask?.audioMeta.title || 'note'
      const { blob, filename } = await exportMarkdownBundle({
        title,
        markdown: selectedContent,
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename || `${title}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success('Markdown 图片包已导出')
    } catch (error) {
      console.error('导出 Markdown 图片包失败:', error)
      toast.error('导出 Markdown 图片包失败')
    }
  }

  const handleStartEditing = () => {
    setViewMode('preview')
    setShowChat(false)
    setShowTranscribe(false)
    startEditing()
  }

  if (status === 'loading') {
    const progress = currentTask?.progress
    const progressPercent =
      typeof progress?.percent === 'number'
        ? Math.max(0, Math.min(100, progress.percent))
        : undefined

    return (
      <div className="flex h-screen w-full flex-col items-center justify-center space-y-4 text-neutral-500">
        <StepBar steps={steps} currentStep={taskStatus} />
        <Loading />
        {progress && progressPercent !== undefined && (
          <div className="w-full max-w-xl space-y-2 px-4">
            <div className="flex items-center justify-between gap-4 text-xs text-neutral-500">
              <span className="truncate">
                {progress.detail || currentTask?.message || '大模型处理中'}
              </span>
              <span className="font-mono">{progressPercent}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
              <div
                className="bg-primary h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {progress.total > 1 && (
              <div className="text-center text-xs text-neutral-400">
                请求分块 {progress.current}/{progress.total}
              </div>
            )}
          </div>
        )}
        {currentTask?.message && <p className="text-primary text-sm">{currentTask.message}</p>}
        <div className="text-center text-sm">
          <p className="text-lg font-bold">正在生成笔记，请稍候...</p>
          <p className="mt-2 text-xs text-neutral-500">
            这可能需要几分钟，取决于视频长度和大模型响应速度
          </p>
        </div>
      </div>
    )
  }

  if (status === 'idle') {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center space-y-3 text-neutral-500">
        <Idle />
        <div className="text-center">
          <p className="text-lg font-bold">输入视频链接并点击“生成笔记”</p>
          <p className="mt-2 text-xs text-neutral-500">支持哔哩哔哩、YouTube、抖音等视频平台</p>
        </div>
      </div>
    )
  }

  if (status === 'failed' && !isMultiVersion) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 space-y-3">
        <Error />
        <div className="text-center">
          <p className="text-lg font-bold text-red-500">笔记生成失败</p>
          <p className="mt-2 mb-2 text-xs text-red-400">请检查后台或稍后再试</p>

          <Button onClick={() => retryTask(currentTask?.id || '')} size="lg">
            重试
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden">
      <MarkdownHeader
        currentTask={currentTask}
        isMultiVersion={isMultiVersion}
        currentVerId={currentVerId}
        setCurrentVerId={setCurrentVerId}
        modelName={modelName}
        style={style}
        noteStyles={noteStyles}
        onCopy={handleCopy}
        onDownload={handleDownload}
        onDownloadBundle={handleDownloadBundle}
        onDeleteVersion={handleDeleteVersion}
        onStartEditing={handleStartEditing}
        isEditing={isEditing}
        createAt={createTime}
        showTranscribe={showTranscribe}
        setShowTranscribe={setShowTranscribe}
        showChat={showChat}
        setShowChat={setShowChat}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      {viewMode === 'map' ? (
        <div className="flex w-full flex-1 overflow-hidden bg-white">
          <div className="w-full">
            <MarkmapEditor
              value={selectedContent}
              onChange={() => {}}
              height="100%"
              title={currentTask?.audioMeta?.title || '思维导图'}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden bg-white py-2">
          {selectedContent && selectedContent !== 'loading' && selectedContent !== 'empty' ? (
            isEditing ? (
              <div className="flex h-full w-full flex-col overflow-hidden px-4 pb-4">
                <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  修改内容只保存在当前浏览器的本地笔记数据中，不会回写后端生成文件。
                </div>
                <div className="min-h-0 flex-1">
                  <Textarea
                    value={draftContent}
                    onChange={event => setDraftContent(event.target.value)}
                    className="h-full min-h-full resize-none font-mono text-sm leading-6"
                    placeholder="在这里编辑当前版本的 Markdown 内容"
                  />
                </div>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <Button variant="outline" onClick={cancelEditing}>
                    <X className="mr-1.5 h-4 w-4" />
                    取消编辑
                  </Button>
                  <Button onClick={saveEditing}>
                    <Save className="mr-1.5 h-4 w-4" />
                    保存修改
                  </Button>
                </div>
              </div>
            ) : showChat === 'full' && currentTask ? (
              <div className="h-full w-full">
                <ChatPanel taskId={currentTask.id} mode="full" onModeChange={setShowChat} />
              </div>
            ) : (
              <>
                <ScrollArea className="min-w-0 flex-1">
                  <div className="px-2">
                    <VideoBanner
                      audioMeta={currentTask?.audioMeta}
                      videoUrl={currentTask?.formData?.video_url}
                    />
                  </div>
                  <div className="markdown-body w-full px-2">
                    <ReactMarkdown
                      remarkPlugins={remarkPlugins}
                      rehypePlugins={rehypePlugins}
                      components={markdownComponents}
                    >
                      {selectedContent.replace(/^>\s*来源链接：[^\n]*\n*/m, '')}
                    </ReactMarkdown>
                  </div>
                </ScrollArea>
                {showTranscribe && (
                  <div className="ml-2 w-2/4">
                    <TranscriptViewer />
                  </div>
                )}
                {showChat === 'half' && currentTask && (
                  <div className="ml-2 h-full w-1/2 shrink-0">
                    <ChatPanel taskId={currentTask.id} mode="half" onModeChange={setShowChat} />
                  </div>
                )}
              </>
            )
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <div className="w-[300px] flex-col justify-items-center">
                <div className="bg-primary-light mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                  <ArrowRight className="text-primary h-8 w-8" />
                </div>
                <p className="mb-2 text-neutral-600">输入视频链接并点击“生成笔记”按钮</p>
                <p className="text-xs text-neutral-500">支持哔哩哔哩、YouTube 等视频网站</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
})

MarkdownViewer.displayName = 'MarkdownViewer'

export default MarkdownViewer
