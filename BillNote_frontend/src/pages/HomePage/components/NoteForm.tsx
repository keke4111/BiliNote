import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Info, Loader2, Plus } from 'lucide-react'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form.tsx'
import { Alert, AlertDescription } from '@/components/ui/alert.tsx'
import { Button } from '@/components/ui/button.tsx'
import { Checkbox } from '@/components/ui/checkbox.tsx'
import { Input } from '@/components/ui/input.tsx'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.tsx'
import { Textarea } from '@/components/ui/textarea.tsx'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip.tsx'
import { noteFormats, noteStyles, videoPlatforms } from '@/constant/note.ts'
import { generateNote } from '@/services/note.ts'
import { uploadFile } from '@/services/upload.ts'
import { useModelStore } from '@/store/modelStore'
import { useTaskStore } from '@/store/taskStore'
import { useNavigate } from 'react-router-dom'

const formSchema = z
  .object({
    video_url: z.string().optional(),
    platform: z.string().nonempty('请选择平台'),
    quality: z.enum(['fast', 'medium', 'slow']),
    screenshot: z.boolean().optional(),
    link: z.boolean().optional(),
    model_name: z.string().nonempty('请选择模型'),
    format: z.array(z.string()).default([]),
    style: z.string().nonempty('请选择笔记生成风格'),
    extras: z.string().optional(),
    video_understanding: z.boolean().optional(),
    video_interval: z.coerce.number().min(1).max(30).default(6).optional(),
    grid_size: z
      .tuple([z.coerce.number().min(1).max(10), z.coerce.number().min(1).max(10)])
      .default([2, 2])
      .optional(),
  })
  .superRefine(({ video_url, platform }, ctx) => {
    if (platform === 'local') {
      if (!video_url) {
        ctx.addIssue({ code: 'custom', message: '本地视频路径不能为空', path: ['video_url'] })
      }
      return
    }

    if (!video_url) {
      ctx.addIssue({ code: 'custom', message: '视频链接不能为空', path: ['video_url'] })
      return
    }

    try {
      const url = new URL(video_url)
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('invalid protocol')
      }
    } catch {
      ctx.addIssue({ code: 'custom', message: '请输入正确的视频链接', path: ['video_url'] })
    }
  })

export type NoteFormValues = z.infer<typeof formSchema>

const createDefaultValues = (firstModelName = ''): NoteFormValues => ({
  video_url: '',
  platform: 'bilibili',
  quality: 'medium',
  screenshot: false,
  link: false,
  model_name: firstModelName,
  format: ['toc', 'link', 'screenshot', 'summary'],
  style: 'detailed',
  extras: '',
  video_understanding: true,
  video_interval: 30,
  grid_size: [2, 2],
})

const SectionHeader = ({ title, tip }: { title: string; tip?: string }) => (
  <div className="my-3 flex items-center justify-between">
    <h2 className="block">{title}</h2>
    {tip && (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="hover:text-primary h-4 w-4 cursor-pointer text-neutral-400" />
          </TooltipTrigger>
          <TooltipContent className="text-xs">{tip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )}
  </div>
)

const CheckboxGroup = ({
  value = [],
  onChange,
  disabledMap,
}: {
  value?: string[]
  onChange: (value: string[]) => void
  disabledMap: Record<string, boolean>
}) => (
  <div className="flex flex-wrap space-x-1.5">
    {noteFormats.map(({ label, value: itemValue }) => (
      <label key={itemValue} className="flex items-center space-x-2">
        <Checkbox
          checked={value.includes(itemValue)}
          disabled={disabledMap[itemValue]}
          onCheckedChange={checked =>
            onChange(checked ? [...value, itemValue] : value.filter(item => item !== itemValue))
          }
        />
        <span>{label}</span>
      </label>
    ))}
  </div>
)

const NoteForm = () => {
  const navigate = useNavigate()
  const [isUploading, setIsUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submittingRef = useRef(false)

  const { addPendingTask, currentTaskId, setCurrentTask, getCurrentTask, retryTask } =
    useTaskStore()
  const { loadEnabledModels, modelList } = useModelStore()

  const form = useForm<any>({
    resolver: zodResolver(formSchema),
    defaultValues: createDefaultValues(),
  })

  const currentTask = getCurrentTask()
  const firstModelName = modelList[0]?.model_name || ''
  const platform = useWatch({ control: form.control, name: 'platform' }) as string
  const videoUnderstandingEnabled = useWatch({
    control: form.control,
    name: 'video_understanding',
  })
  const editing = Boolean(currentTask?.id)

  useEffect(() => {
    loadEnabledModels()
  }, [loadEnabledModels])

  useEffect(() => {
    if (!currentTask) {
      form.reset(createDefaultValues(firstModelName))
      setUploadSuccess(false)
      return
    }

    const { formData } = currentTask
    form.reset({
      platform: formData.platform || 'bilibili',
      video_url: formData.video_url || '',
      model_name: formData.model_name || firstModelName,
      style: formData.style || 'detailed',
      quality: (formData.quality as NoteFormValues['quality']) || 'medium',
      extras: formData.extras || '',
      screenshot: formData.screenshot ?? false,
      link: formData.link ?? false,
      video_understanding: formData.video_understanding ?? true,
      video_interval: formData.video_interval ?? 30,
      grid_size: formData.grid_size ?? [2, 2],
      format: formData.format ?? ['toc', 'link', 'screenshot', 'summary'],
    })
  }, [currentTask, firstModelName, form])

  const isGenerating = () => !['SUCCESS', 'FAILED', undefined].includes(getCurrentTask()?.status)
  const generating = isGenerating()

  const handleFileUpload = async (file: File, callback: (url: string) => void) => {
    const uploadFormData = new FormData()
    uploadFormData.append('file', file)
    setIsUploading(true)
    setUploadSuccess(false)

    try {
      const data: any = await uploadFile(uploadFormData)
      callback(data.url)
      setUploadSuccess(true)
    } catch (error) {
      console.error('上传失败:', error)
    } finally {
      setIsUploading(false)
    }
  }

  const onSubmit = async (values: any) => {
    if (submittingRef.current) return
    submittingRef.current = true
    setIsSubmitting(true)

    try {
      const selectedProvider = modelList.find(model => model.model_name === values.model_name)
      if (!selectedProvider) {
        throw new Error('未找到模型对应的供应商')
      }

      const payload: any = {
        ...values,
        provider_id: selectedProvider.provider_id,
        task_id: currentTaskId || '',
      }

      if (currentTaskId) {
        const confirmed = window.confirm(
          '确认重新生成这篇笔记？这会基于当前表单设置新增一个版本，并重新执行下载/转写/总结流程。'
        )
        if (!confirmed) {
          return
        }
        await retryTask(currentTaskId, payload)
        return
      }

      const data: any = await generateNote(payload)
      addPendingTask(data.task_id, values.platform, payload)
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }

  const onInvalid = (errors: FieldErrors<any>) => {
    console.warn('表单校验失败', errors)
  }

  const handleCreateNew = () => {
    setCurrentTask(null)
    form.reset(createDefaultValues(firstModelName))
    setUploadSuccess(false)
  }

  const goModelAdd = () => {
    navigate('/settings/model')
  }

  const FormButton = () => {
    const label = generating ? '正在生成...' : editing ? '重新生成' : '生成笔记'

    return (
      <div className="flex gap-2">
        <Button
          type="submit"
          className={`${editing ? 'w-2/3' : 'w-full'} bg-primary`}
          disabled={generating || isSubmitting}
        >
          {(generating || isSubmitting) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {label}
        </Button>

        {editing && (
          <Button type="button" variant="outline" className="w-1/3" onClick={handleCreateNew}>
            <Plus className="mr-2 h-4 w-4" />
            新建笔记
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="h-full w-full">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-4">
          <FormButton />

          <SectionHeader title="视频链接" tip="支持 B站、YouTube 等平台" />
          <div className="flex gap-2">
            <FormField
              control={form.control}
              name="platform"
              render={({ field }) => (
                <FormItem>
                  <Select
                    disabled={editing}
                    value={field.value}
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {videoPlatforms.map(platformOption => (
                        <SelectItem key={platformOption.value} value={platformOption.value}>
                          <div className="flex items-center justify-center gap-2">
                            <div className="h-4 w-4">{platformOption.logo()}</div>
                            <span>{platformOption.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage style={{ display: 'none' }} />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="video_url"
              render={({ field }) => (
                <FormItem className="flex-1">
                  {platform === 'local' ? (
                    <Input disabled={editing} placeholder="请输入本地视频路径" {...field} />
                  ) : (
                    <Input disabled={editing} placeholder="请输入视频网站链接" {...field} />
                  )}
                  <FormMessage style={{ display: 'none' }} />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="video_url"
            render={({ field }) => (
              <FormItem className="flex-1">
                {platform === 'local' && (
                  <div
                    className="hover:border-primary mt-2 flex h-40 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-gray-300 transition-colors"
                    onDragOver={event => {
                      event.preventDefault()
                      event.stopPropagation()
                    }}
                    onDrop={event => {
                      event.preventDefault()
                      const file = event.dataTransfer.files?.[0]
                      if (file) handleFileUpload(file, field.onChange)
                    }}
                    onClick={() => {
                      const input = document.createElement('input')
                      input.type = 'file'
                      input.accept = 'video/*'
                      input.onchange = event => {
                        const file = (event.target as HTMLInputElement).files?.[0]
                        if (file) handleFileUpload(file, field.onChange)
                      }
                      input.click()
                    }}
                  >
                    {isUploading ? (
                      <p className="text-center text-sm text-blue-500">上传中，请稍候...</p>
                    ) : uploadSuccess ? (
                      <p className="text-center text-sm text-green-500">上传成功</p>
                    ) : (
                      <p className="text-center text-sm text-gray-500">
                        拖拽文件到这里上传
                        <br />
                        <span className="text-xs text-gray-400">或点击选择文件</span>
                      </p>
                    )}
                  </div>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-2">
            {modelList.length > 0 ? (
              <FormField
                control={form.control}
                name="model_name"
                render={({ field }) => (
                  <FormItem>
                    <SectionHeader title="模型选择" tip="不同模型效果不同，建议按实际效果选择" />
                    <Select
                      onOpenChange={() => {
                        loadEnabledModels()
                      }}
                      value={field.value}
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full min-w-0 truncate">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {modelList.map(model => (
                          <SelectItem key={model.id} value={model.model_name}>
                            {model.model_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <FormItem>
                <SectionHeader title="模型选择" tip="需要先配置供应商并保存模型" />
                <Button type="button" variant="outline" onClick={goModelAdd}>
                  请先添加模型
                </Button>
                <FormMessage />
              </FormItem>
            )}

            <FormField
              control={form.control}
              name="style"
              render={({ field }) => (
                <FormItem>
                  <SectionHeader title="笔记风格" tip="选择生成笔记的呈现风格" />
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full min-w-0 truncate">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {noteStyles.map(style => (
                        <SelectItem key={style.value} value={style.value}>
                          {style.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <SectionHeader title="视频理解" tip="将视频截图发给多模态模型辅助分析" />
          <div className="flex flex-col gap-2">
            <FormField
              control={form.control}
              name="video_understanding"
              render={() => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <FormLabel>启用</FormLabel>
                    <Checkbox
                      checked={videoUnderstandingEnabled}
                      onCheckedChange={value =>
                        form.setValue('video_understanding', Boolean(value))
                      }
                    />
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="video_interval"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>采样间隔（秒）</FormLabel>
                    <Input disabled={!videoUnderstandingEnabled} type="number" {...field} />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="grid_size"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>拼图尺寸（列 x 行）</FormLabel>
                    <div className="flex items-center space-x-2">
                      <Input
                        disabled={!videoUnderstandingEnabled}
                        type="number"
                        value={field.value?.[0] || 2}
                        onChange={event =>
                          field.onChange([Number(event.target.value), field.value?.[1] || 2])
                        }
                        className="w-16"
                      />
                      <span>x</span>
                      <Input
                        disabled={!videoUnderstandingEnabled}
                        type="number"
                        value={field.value?.[1] || 2}
                        onChange={event =>
                          field.onChange([field.value?.[0] || 2, Number(event.target.value)])
                        }
                        className="w-16"
                      />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Alert variant="warning" className="text-sm">
              <AlertDescription>
                <strong>提示：</strong>视频理解功能必须使用多模态模型。
              </AlertDescription>
            </Alert>
          </div>

          <FormField
            control={form.control}
            name="format"
            render={({ field }) => (
              <FormItem>
                <SectionHeader title="笔记格式" tip="选择要包含的笔记元素" />
                <CheckboxGroup
                  value={field.value}
                  onChange={field.onChange}
                  disabledMap={{
                    link: platform === 'local',
                    screenshot: !videoUnderstandingEnabled,
                  }}
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="extras"
            render={({ field }) => (
              <FormItem>
                <SectionHeader title="备注" tip="可在提示词末尾附加自定义要求" />
                <Textarea placeholder="例如：请把关键结论单独列出来" {...field} />
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </div>
  )
}

export default NoteForm
