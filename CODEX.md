# Codex 工作上下文

本文记录当前本地 BiliNote 项目已经做过的改动、遇到的问题、验证方式和后续接手注意点。目标是让后续继续开发时不用重新踩坑。

## 项目环境

- 项目根目录：`F:\jiaqi\BiliNote`
- 后端目录：`backend`
- 前端目录：`BillNote_frontend`
- 后端实际端口：`8483`
- 前端端口：`3015`
- 一键启动入口：`run.bat`
- 前端本地持久化 key：`task-storage`
- 当前主要运行方式：
  - 后端：`cd backend && python main.py`
  - 前端：`cd BillNote_frontend && pnpm dev`

## 已完成的主要改动

### 启动与稳定性

- 新增/调整一键启动脚本 `run.bat`。
- 启动脚本会等待后端 `http://127.0.0.1:8483/api/sys_check` 可用后再打开前端，避免前端先启动时反复出现 `ECONNREFUSED 127.0.0.1:8483`。
- 前端启动检查改为静默请求并自动重试，减少启动期间误报“网络连接失败”。

### B 站下载与本地文件

- B 站 cookie 应填写完整 `name=value; name=value` 格式，而不是只填 `SESSDATA` 的值。
- 下载文件主要落在：
  - `backend/data/data`
  - `backend/data/output_frames`
  - `backend/data/grid_output`
  - `backend/static/screenshots`
  - `backend/note_results`
- Whisper / faster-whisper 模型通常缓存到用户目录或 Hugging Face 缓存目录，不在项目 `backend/data` 内。

### 视频理解与截图

- 视频理解会明显增加耗时和 token 消耗。
- 采样间隔影响视频理解拼图，不影响“原片截图”插入的逻辑。
- 采样间隔 30 秒、拼图 2x2 表示每 30 秒采一帧，每 4 帧拼成一张图，所以一张图覆盖约 120 秒。
- 推荐默认：
  - 普通课程：30 秒，2x2
  - 画面信息密集：10-20 秒，2x2
  - 长视频省 token：30-60 秒，2x2 或 3x3
- 3x3 覆盖范围更大，但单格分辨率更低，细节识别会变差。

### 重新生成图片修复

- 修复重新生成同一任务时启用视频理解但日志显示 `images=0` 的问题。
- `_download_media()` 命中音频缓存时，不再直接跳过视频理解所需图片。
- 增加 `{task_id}_video_images.json` 图片缓存。
- 参数一致时复用图片缓存；采样间隔或拼图尺寸变化时重新生成。

### 数据库重复插入修复

- `insert_video_task()` 对已有 `task_id` 做幂等处理。
- 重新生成同一任务时不再把 `UNIQUE constraint failed: video_tasks.task_id` 当成错误刷屏。

### 防重复生成

- 修复手速快连续点击“生成笔记”会创建多个生成任务的问题。
- 前端生成中会禁用生成按钮，避免重复提交。

### 分类与排序

- 新增本地笔记分类功能，数据仍存放在前端 Zustand `task-storage`。
- 分类模型为单选文件夹：
  - `全部`
  - `未分类`
  - 用户自定义分类
  - `回收站`
- 新生成笔记默认进入“未分类”。
- 支持新建、重命名、删除分类。
- 删除分类会把该分类下所有笔记移入回收站，并有强确认文案。
- 普通笔记列表支持排序：
  - 最新优先
  - 最旧优先
  - 标题 A-Z
  - 标题 Z-A
- 回收站不参与普通排序，按删除时间最新优先。

### 回收站

- 删除普通笔记改为移入回收站。
- 回收站支持恢复和永久删除。
- 删除前增加确认，降低误删风险。
- 恢复笔记时保留原分类；如果原分类不存在，则恢复到“未分类”。

### 版本管理

- 新增笔记版本删除功能。
- 多版本笔记可删除当前版本。
- 只剩一个版本时拒绝删除，提示“至少保留一个版本”。
- 删除版本后会自动切换到剩余版本中最新的版本。
- 版本删除后来改为软删除：
  - 删除版本进入统一回收站。
  - 回收站中区分“笔记”和“版本”。
  - 已删除版本可恢复或永久删除。
  - 如果原笔记仍在回收站，恢复版本时提示先恢复原笔记。
  - 如果原笔记已永久删除，版本不可恢复，只能永久删除版本记录。

### 前端结构重整

- 新增笔记功能域目录：`BillNote_frontend/src/features/notes/`
- 拆分内容包括：
  - `types.ts`
  - `utils.ts`
  - `store.ts`
  - `selectors.ts`
  - `hooks/useMarkdownVersionState.ts`
- 保留兼容入口：`BillNote_frontend/src/store/taskStore/index.ts`
- 历史栏拆分为多个组件，降低 `NoteHistory` 复杂度。
- `MarkdownViewer` 抽出了版本状态 hook，减少版本切换和删除逻辑耦合。
- Zustand persist key 仍是 `task-storage`，避免丢历史数据。

### 设置页闪退修复

- 修复生成任务进行中打开“全局配置”导致前端闪退的问题。
- 对设置页、模型列表、供应商列表、部署监控页做了防御式兼容。
- 接口失败或返回结构异常时显示局部错误，不触发整页错误边界。
- 错误边界支持按路由重置，避免一次崩溃后切换页面仍停在红色错误页。

### 大模型命名与进度条

- 后端用户可见日志从 `GPT 总结...` 改为 `大模型总结...`。
- 保留内部类名和文件名，例如 `UniversalGPT`、`GPTSource`，避免大范围重命名。
- `_update_status()` 支持写入可选 `progress` 字段。
- `UniversalGPT.summarize()` 支持进度回调。
- `_summarize_text()` 会把大模型请求进度写入任务状态文件。
- `/api/task_status/{task_id}` 返回 `progress`。
- 前端 `Task` 类型增加 `progress`。
- 前端轮询任务状态时同步 `progress`。
- 生成页步骤条下方显示进度条和当前请求说明。
- 进度是 chunk/阶段级进度，不是 token 级实时流式进度。
- 多 chunk 时：
  - 请求阶段使用 0-90%
  - 合并阶段使用 90-100%
  - 避免合并时进度条回退

## 重要文件

### 后端

- `backend/app/services/note.py`
  - 生成笔记主流程
  - 状态文件写入
  - 下载、转写、总结、截图、存库串联
- `backend/app/gpt/universal_gpt.py`
  - 大模型调用
  - 分块请求
  - 分段合并
  - 大模型进度回调
- `backend/app/models/gpt_model.py`
  - `GPTSource`
  - 已增加 `progress_callback`
- `backend/app/routers/note.py`
  - `/api/task_status/{task_id}`
  - 已透传 `progress`
- `backend/app/db/video_task_dao.py`
  - 任务入库
  - 已做 task_id 幂等处理

### 前端

- `BillNote_frontend/src/features/notes/types.ts`
  - `Task`
  - `TaskProgress`
  - `MarkdownVersion`
  - `DeletedMarkdownVersion`
  - `Category`
- `BillNote_frontend/src/features/notes/store.ts`
  - 笔记 Zustand store
  - 分类、回收站、版本回收站逻辑
- `BillNote_frontend/src/features/notes/utils.ts`
  - 纯函数：标题、排序、过滤、版本转换等
- `BillNote_frontend/src/features/notes/selectors.ts`
  - 常用 selector
- `BillNote_frontend/src/hooks/useTaskPolling.ts`
  - 前端任务轮询
  - 已同步 `progress`
- `BillNote_frontend/src/pages/HomePage/components/MarkdownViewer.tsx`
  - 笔记展示
  - 生成中状态
  - 大模型进度条
- `BillNote_frontend/src/pages/HomePage/components/NoteHistory.tsx`
  - 历史栏组合组件
- `BillNote_frontend/src/pages/HomePage/components/history/*`
  - 历史栏拆分组件
- `BillNote_frontend/src/components/AppErrorBoundary.tsx`
  - 路由错误边界
- `BillNote_frontend/src/types/react-syntax-highlighter.d.ts`
  - 为 `react-syntax-highlighter` 补充本地声明

## 已知坑

### 端口不一致

文档里曾写前端代理后端 `8000`，但当前后端实际跑在 `8483`。如果出现：

```text
http proxy error: /api/sys_check
connect ECONNREFUSED 127.0.0.1:8483
```

通常是后端还没启动好，或后端启动失败。

### 后端没报错但前端显示网络失败

生成过程中前端可能继续轮询任务状态。短时间网络失败不一定代表任务失败。应该看：

- 后端是否还有 `GET /api/task_status/... 200 OK`
- 状态文件是否继续更新
- 最终状态是否 `SUCCESS` 或 `FAILED`

### Windows 终端需要按回车才刷新

Windows 控制台如果进入了选择/快速编辑状态，输出会暂停，看起来像“卡住”。按回车后继续刷新。不是程序逻辑问题。

### B 站 412

`HTTP Error 412: Precondition Failed` 多数和 B 站风控、cookie、会员权限、yt-dlp 请求头有关。

处理顺序：

1. 确认 cookie 是完整 `name=value; name=value`。
2. 确认 `SESSDATA` 没过期。
3. 降低清晰度或关闭高码率需求。
4. 必要时更新 `yt-dlp`。

### torch / CUDA

- 未安装 torch 时，后端会提示 `还没有安装 torch，请先安装`。
- faster-whisper 可以用 CUDA，但 torch 状态检查不一定代表 faster-whisper 不能跑。
- 4060 Ti 16G 对 medium 模型会比 CPU 快很多。
- CUDA 已启用时，部署监控页能显示 GPU 和 CUDA 版本。

### 全局代理 / Clash

Codex 可能读取 `.codex/.env` 或环境变量里的代理端口。如果系统代理没开但 Codex 仍能通信，可能是环境变量代理生效。常见变量：

- `HTTP_PROXY`
- `HTTPS_PROXY`
- `ALL_PROXY`

### npm.ps1 执行策略

PowerShell 下直接运行 `npm` 可能报：

```text
无法加载文件 ... npm.ps1，因为在此系统上禁止运行脚本
```

解决方式是用：

```powershell
npm.cmd run build
```

或：

```powershell
pnpm.cmd dev
```

### 构建被 esbuild EPERM 阻断

当前 sandbox 环境执行：

```powershell
npm.cmd run build
```

会失败：

```text
Error: spawn EPERM
```

这是 esbuild 子进程在当前环境被拒绝，不一定是代码错误。之前多次验证都遇到同样问题。

### TypeScript 全量检查有历史错误

当前 `npx.cmd tsc -p tsconfig.app.json --noEmit` 会暴露项目已有的类型错误，例如：

- `react-markdown` 与 React 19 JSX 类型不兼容
- 下载器表单接口类型与 AxiosResponse 推断不一致
- 部分 icon 组件 JSX 类型不兼容
- 平台 SVG 上存在非标准属性如 `t`

因此做局部改动时更适合：

1. 对改动文件跑 Prettier。
2. 用 `transpileModule` 检查改动文件语法。
3. 用 `tsc` 过滤改动文件相关错误。
4. 完整构建若仍是 `esbuild spawn EPERM`，按环境限制记录。

### Git safe.directory

Codex sandbox 用户与项目拥有者不同，运行 git 可能报：

```text
fatal: detected dubious ownership in repository
```

可临时使用：

```powershell
git -c safe.directory=F:/jiaqi/BiliNote status --short
```

不要随意修改全局 git 配置，除非用户明确同意。

### rg 拒绝访问

本环境中 `rg.exe` 有时会报“拒绝访问”。可退回 PowerShell：

```powershell
Get-ChildItem -Recurse -Filter *.ts
Select-String -Path ... -Pattern ...
```

## 验证记录

### 后端语法检查

最近一次通过：

```powershell
python -m py_compile backend/app/models/gpt_model.py backend/app/gpt/universal_gpt.py backend/app/services/note.py backend/app/routers/note.py
```

### 前端格式化

最近一次执行过：

```powershell
npx.cmd prettier --write src/hooks/useTaskPolling.ts src/features/notes/types.ts src/pages/HomePage/components/MarkdownViewer.tsx
npx.cmd prettier --write src/types/react-syntax-highlighter.d.ts
```

### 前端局部语法检查

对这些文件做过 `typescript.transpileModule` 检查并通过：

- `src/features/notes/types.ts`
- `src/hooks/useTaskPolling.ts`
- `src/pages/HomePage/components/MarkdownViewer.tsx`

### 前端完整构建

执行：

```powershell
npm.cmd run build
```

当前失败原因：

```text
Error: spawn EPERM
```

这是当前环境限制，不是本次大模型进度条改动导致。

## 大模型进度实现细节

后端状态文件现在可能包含：

```json
{
  "status": "SUMMARIZING",
  "message": "正在请求大模型：chunk 1/3，图片 4 张",
  "progress": {
    "phase": "summarizing",
    "current": 1,
    "total": 3,
    "percent": 30,
    "detail": "正在请求大模型：chunk 1/3，图片 4 张"
  }
}
```

阶段说明：

- `summarizing`：正在请求大模型
- `merge`：正在合并多段总结结果

注意：单个大模型请求内部无法知道 token 生成进度，所以单 chunk 时只会显示“正在请求中”，请求返回后跳到完成。

## 后续开发建议

- 不要急着继续扩大 store 复杂度。分类、回收站、版本回收站已经很多，后续最好继续往 `features/notes` 内拆纯函数和 selector。
- 如果要做真正实时进度，需要后端改为 SSE 或 WebSocket，并且大模型 SDK 要启用 stream；当前实现只是轮询状态文件。
- 如果要降低视频理解 token 成本，应优先优化采样策略和拼图尺寸，而不是只改提示词。
- 如果要让生成中切换页面更稳，应继续检查全局轮询和页面卸载后的状态更新路径。
- 如果要做后端数据库同步分类，建议先设计迁移方案，当前分类只存在前端本地 `task-storage`。

## 2026-04-27 第一批完成记录

### 完成项

- 修复“新增模型后需要刷新页面才显示到已启用模型列表”的问题。
- 删除模型后，右侧“已启用模型”列表和首页模型下拉也会同步刷新。
- 供应商列表开关现在有明确语义：控制该供应商下的模型是否出现在首页“模型选择”中。
- 后端 `GET /model_list` 已改为只返回 `enabled=1` 的供应商下挂载的模型。
- 设置页模型供应商列表增加说明文案，避免把开关误解成“当前选中模型”。
- “新建笔记”现在会显式重置表单到新建默认值，并清空视频链接。

### 用户可见行为变化

- 在模型供应商编辑页保存模型后，新的模型标签会立即出现在“已启用模型”区域，无需手动刷新。
- 关闭某个供应商开关后，返回首页时该供应商下的模型不会再出现在模型下拉中。
- 点击“新建笔记”后，不会再残留上一条任务的视频链接。

### 相关实现约束

- 供应商开关不会删除供应商配置，也不会影响历史笔记已经记录下来的 `provider_id` 和 `model_name`。
- 当前过滤只作用于“全局可选模型列表”接口 `/model_list`。
- 设置页按供应商查看“已启用模型”仍然可以看到该供应商自己的已保存模型，便于继续管理。

### 验证结果

- 后端 `python -m py_compile backend/app/db/model_dao.py backend/app/services/model.py backend/app/routers/model.py` 通过。
- 前端改动文件已执行 `prettier`。
- 前端改动文件通过 `typescript.transpileModule` 语法检查。
- `tsc` 过滤后剩余报错来自项目旧文件 `src/components/Form/DownloaderForm/providerCard.tsx` 的未使用导入，与本批改动无关。

## 2026-04-27 第二批完成记录

### 完成项
- 新增应用内“编辑笔记”能力，入口位于笔记顶部工具栏。
- 手动编辑采用“保留初始版本 + 派生手动版本”的策略：
  - 第一次编辑原始生成版本时，会新增一个手动编辑版。
  - 继续编辑当前手动版时，直接覆盖该手动版内容，不会每次都新建版本。
- 旧字符串格式笔记首次保存编辑时，会自动转换为版本数组，再按版本体系保存。
- 版本下拉现在会区分“原始版”和“手动版”。
- 编辑中的内容只保存在前端本地 `task-storage`，不会回写后端 `note_results/*.json` 或 `*_markdown.md`。

### 新增接口与数据
- `BillNote_frontend/src/features/notes/store.ts`
  - 新增 `saveEditedMarkdownVersion(taskId, sourceVersionId, content)`。
- `BillNote_frontend/src/features/notes/types.ts`
  - `MarkdownVersion` 新增可选字段：
    - `source_ver_id?: string`
    - `edited_manually?: boolean`
- `BillNote_frontend/src/features/notes/useMarkdownVersionState.ts`
  - 新增编辑态管理：
    - `isEditing`
    - `draftContent`
    - `startEditing`
    - `cancelEditing`
    - `saveEditing`
    - `setDraftContent`

### 用户可见行为变化
- 点击“编辑笔记”后，会进入当前版本的 Markdown 文本编辑模式。
- 保存原始版修改后，会自动切换到新生成的手动编辑版。
- 编辑状态下会禁用版本切换、版本删除、思维导图切换、原文参照和 AI 问答入口，避免未保存草稿串到别的版本或视图。
- 取消编辑会丢弃当前草稿，不会修改原内容。

### 已知限制
- 第一版使用简单 `textarea`，没有做富文本编辑、语法高亮输入或草稿自动保存。
- 手动编辑版删除后仍然走现有“版本回收站”逻辑；恢复逻辑未改。
- 目前没有单独记录“编辑者”“编辑备注”或“手动修改时间线”。

### 验证结果
- `prettier` 已执行：
  - `src/features/notes/types.ts`
  - `src/features/notes/store.ts`
  - `src/features/notes/useMarkdownVersionState.ts`
  - `src/pages/HomePage/components/MarkdownHeader.tsx`
  - `src/pages/HomePage/components/MarkdownViewer.tsx`
- 上述文件已通过 `typescript.transpileModule` 语法检查。
- `MarkdownViewer.tsx` 额外做了 `typescript.createSourceFile(..., ScriptKind.TSX)` 解析检查，结果通过。

## 2026-04-27 第三批完成记录

### 完成项
- 新增按笔记清理缓存能力，前端入口放在历史卡片中，仅对成功笔记显示。
- 后端新增 `POST /clear_task_cache`，按 `task_id` 删除任务级缓存文件和可安全确认归属的媒体缓存。
- 清理范围包括：
  - `note_results/{task_id}*`
  - `backend/data/data/{video_id}.*`
  - 笔记正文中引用的 `static/screenshots/*`
  - 可安全映射到本地的 `static/cover/*`
- 返回结构包含三类结果：
  - `deleted`
  - `missing`
  - `skipped`

### 用户可见行为变化
- 成功笔记历史卡片上新增“清理缓存”按钮。
- 点击后会先弹确认框，明确说明这不会删除笔记内容、版本历史或分类。
- 清理完成后会 toast 提示删除数量；如果文件本来就不存在，也会给出“已不存在”的提示，而不是报错。

### 安全约束
- 只允许删除以下白名单目录内的文件：
  - `note_results`
  - `backend/data/data`
  - `backend/static/screenshots`
  - `backend/static/cover`
- `local` 平台任务不会删除原始本地视频来源，也不会删除 `/uploads` 下的原始上传视频。
- 对 `local` 平台，仅额外允许删除“可明确判定为派生物”的单个文件：
  - `audio_meta.file_path` 指向的派生音频
  - 与源视频同名的 `_cover.jpg` 派生封面
- 超出白名单目录或无法安全确认归属的路径，一律记入 `skipped`，不执行删除。
- 向量索引、前端本地 `task-storage`、笔记版本历史都不会被清理。

### 相关实现
- 后端：
  - `backend/app/services/note.py`
  - `backend/app/routers/note.py`
- 前端：
  - `BillNote_frontend/src/services/note.ts`
  - `BillNote_frontend/src/pages/HomePage/components/history/TaskHistoryCard.tsx`
  - `BillNote_frontend/src/pages/HomePage/components/NoteHistory.tsx`

### 验证结果
- 后端相关文件已通过 `python -m py_compile` 语法检查。
- 前端相关文件已执行 `prettier`。
- 前端相关文件已通过 `typescript.transpileModule` 语法检查。

## 2026-04-27 生成表单默认值调整记录

### 完成项
- 首页新建笔记默认值已调整为当前推荐设置：
  - 笔记风格：`详细`
  - 视频理解：开启
  - 采样间隔：`30`
  - 拼图尺寸：`2 x 2`
  - 笔记格式默认勾选：
    - 目录
    - 原片跳转
    - 原片截图
    - AI 总结
- “重新生成笔记”现在会先弹确认框，避免误触直接重跑下载/转写/总结流程。

### 用户可见行为变化
- 点击“新建笔记”后，表单会恢复到上述新默认值，并清空视频链接。
- 选择已有笔记后，如果点击“重新生成笔记”，必须先确认，取消后不会发起任务。
- 打开旧任务时，如果某些字段缺失，会按新默认值兜底显示：
  - `style`
  - `video_understanding`
  - `video_interval`
  - `grid_size`
  - `format`

### 相关实现
- `BillNote_frontend/src/pages/HomePage/components/NoteForm.tsx`

### 验证结果
- `NoteForm.tsx` 已执行 `prettier`。
- `NoteForm.tsx` 已通过 `typescript.transpileModule` 语法检查。

## 2026-04-27 不满格拼图补齐记录

### 完成项
- 视频理解拼图不再丢弃最后一组不满格截图。
- 当最后一组截图数量少于拼图尺寸要求时，会保留已有截图，并用白底空白格补齐整张拼图。
- 适用于所有拼图尺寸，而不只是 `2x2`。

### 用户可见行为变化
- 视频尾部最后一小段画面现在会进入最后一张拼图，而不是被直接跳过。
- 日志不再出现“图片不足，跳过第 N 组”，改为记录“已使用空白格补齐”。

### 相关实现
- `backend/app/utils/video_reader.py`

### 已知限制
- 旧的 `{task_id}_video_images.json` 图片缓存不会自动追补；需要重新生成任务或改变视频理解参数后，才会得到新的补齐结果。
- 空白格固定使用白底，不提供前端配置项，也不会在空白格上绘制提示文字。


## 2026-04-27 ??????????????
### ???
- ?????????????????? `backup/notes/`?
- ??????? `task-storage` ????????? `backup/notes/latest.task-storage.json`?
- ??????????????? `backup/notes/exports/notes-export-YYYYMMDD-HHmmss.json`?
- ??????????????????????????????????
- ?????????????????????????????????????????????/?????

### ????
- `POST /backup/sync_notes_store`
- `GET /backup/notes_status`
- `POST /backup/export_notes_store`
- `GET /backup/list_note_backups`
- `POST /backup/import_notes_store`

### ????
- `tasks`
- `categories`
- `deletedVersions`
- `currentTaskId`
- `schemaVersion`
- `exportedAt`

### ????
- ? `taskId` ?????????????
- ???????????????????????
- ???????????????????????????
- ?????????????????????????????

### ????
- ?????????????????????????????????
- ?????????????????????????? `latest.task-storage.json` ? `backup/notes/exports/` ??????
- ???????????????????????????????????????

### ????
- `python -m py_compile backend/app/services/note_backup.py backend/app/routers/note.py` ???
- `NotesBackupService` ????? `sync_latest / get_status / export_snapshot / list_backups / load_backup_file` ???????
- ????????? `prettier`?
- `src/App.tsx`?`src/pages/SettingPage/Menu.tsx`?`src/pages/SettingPage/Backup.tsx`?`src/hooks/useNotesBackupSync.ts`?`src/services/backup.ts`?`src/features/notes/store.ts` ??? `typescript.transpileModule` ?????

Verification note: the backup feature was syntax-checked end to end. Full runtime invocation of NotesBackupService was not executed inside the current Codex sandbox because the default Python environment here does not include the backend FastAPI dependency chain. Local project runtime should be verified in the repo's normal backend environment.

## 2026-04-28 Markdown bundle export

### Completed
- Added backend zip export for the current Markdown content plus local images.
- New endpoint: `POST /export_markdown_bundle`.
- Zip layout:
  - `<note-title>/note.md`
  - `<note-title>/assets/images/*`
- Local image links in Markdown are rewritten to `assets/images/<filename>`.
- Existing single-file Markdown export remains unchanged.
- Frontend now has an additional `导出图片包` action in the note header.

### Behavior
- Local images under `/static/screenshots/...` and `/static/cover/...` are bundled.
- External image URLs are not downloaded and remain unchanged.
- Missing local images do not block export; their original Markdown links remain unchanged.
- Zip files are generated in memory and are not persisted in the project directory.

### Verification
- `python -m py_compile backend/app/services/note_export.py backend/app/routers/note.py` passed.
- Frontend changed files passed `typescript.transpileModule`.
- A direct service-level zip generation check confirmed `note.md` and `assets/images/*` are written and local screenshot links are rewritten.
