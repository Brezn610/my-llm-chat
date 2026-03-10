# 森林奇谈机器人 — 技术路径与设计说明

本文档描述项目采用的技术栈、架构分层与关键设计细节，便于维护与排查问题。

---

## 一、技术栈总览

| 层级 | 技术选型 | 用途 |
|------|----------|------|
| 前端框架 | Next.js 16 (App Router) + React 19 | 服务端/客户端渲染、路由、API 路由 |
| UI / 样式 | Tailwind CSS 4 | 样式与响应式布局 |
| 聊天与流式 | Vercel AI SDK (`ai` + `@ai-sdk/react`) | 流式对话、`useChat`、UIMessage 协议 |
| 大模型 | DeepSeek（经 AI Gateway 等） | 对话生成，`streamText` + `toUIMessageStreamResponse` |
| 持久化 | Supabase (PostgreSQL) | 会话与消息存储、按访问者隔离 |
| 语言与类型 | TypeScript 5 | 类型安全与可维护性 |

---

## 二、架构分层

```
┌─────────────────────────────────────────────────────────────────┐
│  浏览器 (React + useChat + Tailwind)                              │
│  - 对话列表侧栏（可收起/抽屉）                                      │
│  - 消息列表 + 输入框 + 分层错误展示                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │ fetch (自定义：解析 4xx/5xx 的 error 文案)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Next.js API (App Router)                                         │
│  - POST /api/chat      流式对话、限流、写库、模型调用               │
│  - GET  /api/chats     会话列表（按 visitor_id）                   │
│  - GET  /api/chats/[id]/messages  某会话消息                      │
│  - DELETE /api/chats/[id]  删除会话                               │
└───────────────────────────┬─────────────────────────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────────┐  ┌─────────────────┐
│  Supabase    │  │  限流 (内存 Map)   │  │  DeepSeek/      │
│  (chats +    │  │  按 IP 每日 50 次  │  │  AI Gateway     │
│  messages)   │  │                  │  │  streamText     │
└──────────────┘  └──────────────────┘  └─────────────────┘
```

---

## 三、核心设计细节

### 3.1 流式对话

- **协议**：使用 AI SDK 的 **UIMessage 流**（`toUIMessageStreamResponse()`），前端 `useChat` 消费流并实时更新 `messages`。（曾用 `toTextStreamResponse()` 导致前端收不到结构化消息、看不到回复，改为 UIMessage 流后恢复正常。）
- **顺序**：先发用户消息再更新 URL（新对话时先 `sendMessage` 再 `router.replace`），避免因先改 URL 触发「加载空会话」导致发送空消息。（曾遇到「输入消息一直卡住」即因此：先改 URL 会拉空消息并清空状态，请求带空 messages 导致异常或卡住，改为先发再改 URL 后解决。）
- **人设与模型**：由 `lib/llm` 统一配置：`CHAT_MODEL`、`SYSTEM_PROMPT`、`chatTools`、`chatStopWhen`；API 仅做组合调用。

### 3.2 持久化与多会话

- **库表**（Supabase）：
  - `chats`：`id`、`visitor_id`、`title`、`created_at`
  - `messages`：`chat_id`、`message`(JSONB)、`created_at`，`ON DELETE CASCADE`
- **访问者隔离**：未登录场景用 **visitor_id = 客户端 IP**（`x-forwarded-for` / `x-real-ip`），会话列表与写会话时均按 `visitor_id` 过滤，避免跨人看到对话。
- **会话归属校验**：续聊时若 `chatId` 已存在，会校验 `visitor_id` 与当前请求一致，否则 403。
- **标题**：首条用户消息的前 30 字作为会话 `title` 写入并更新。

### 3.3 限流（无登录）

- **规则**：按 IP，**每 24 小时 50 次** 请求（仅统计 `POST /api/chat`）。
- **实现**：内存 `Map<IP, { count, windowStart }>`，超限返回 429 及分层错误文案。
- **注意**：多实例/多节点部署时需改为 Redis/KV 等共享存储，否则限流按节点独立。

### 3.4 分层错误处理

- **统一格式**：所有接口错误通过 `lib/api-error.ts` 的 `apiErrorResponse(layer, detail, status)` 返回：
  - JSON：`{ error: "[层级] 详情", layer }`
  - 响应头：`X-Error-Layer`
  - 日志：`[Chat API][层级]` 打标，便于在终端/日志中按层级检索。
- **层级**：`rate_limit` | `db` | `api` | `model`，对应限流、数据库、接口参数、模型/环境。
- **前端**：自定义 `fetch` 在 4xx/5xx 时读取 `body.error` 并 `throw new Error(body.error)`，使 `useChat` 的 `error` 展示后端文案；`ChatErrorDebug` 解析 `[层级]` 并展示对应排查建议。（这样出现「未配置数据库」等报错时，能直接看到是数据库层并给出排查步骤，而不是笼统的「出错了」。）

### 3.5 响应式与侧栏

- **大屏 (≥768px)**：侧栏默认展开，可点击收起；主区域在侧栏收起时显示「对话列表」按钮重新打开。
- **小屏**：侧栏默认收起，主区域全屏聊天；打开侧栏时为**抽屉 + 遮罩**，点击遮罩或收起按钮关闭；选择某条对话或「新对话」后自动收起侧栏。

### 3.6 前端状态与请求

- **useChat**：通过 `DefaultChatTransport` 指定 `api: '/api/chat'` 和自定义 `chatFetch`，请求体带 `chatId`（新对话时前端生成 UUID）。
- **会话列表**：`GET /api/chats` 按当前访问者返回；删除会话 `DELETE /api/chats/[id]`，删除后若为当前会话则跳转新对话并清空输入。
- **消息列表**：由 `GET /api/chats/[id]/messages` 按 URL 的 `chat` 参数加载，并 `setMessages` 注入 `useChat`；新消息或流式更新时通过 `messagesEndRef` 平滑滚动到底部。

### 3.7 环境与配置

- **必需环境变量**（见 `.env.example`）：
  - `AI_GATEWAY_API_KEY`（或实际使用的模型 API Key）
  - `NEXT_PUBLIC_SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`
- **可选**：`maxDuration = 30`（流式接口最长执行时间，秒）。

---

## 四、代码分层（LLM 与前端）

- **LLM 层**（`lib/llm/`）：模型、系统提示、Function Calling 工具。新增/修改工具或人设在此目录完成，API 通过组合使用。
- **前端渲染层**（`components/chat/`）：助手消息的 Markdown 与公式渲染（`AssistantMessageContent`）、单条气泡（`MessageBubble`）。后续加代码高亮、表格样式等只改此处。
- **API 层**（`app/api/chat/route.ts`）：限流、DB、visitor、从 `lib/llm` 取配置并调用 `streamText`、持久化，不内联工具或提示词。

## 五、关键文件与职责

| 路径 | 职责 |
|------|------|
| `lib/llm/config.ts` | 模型 ID、系统提示、工具调用停止条件 |
| `lib/llm/tools/*.ts` | 各 Function Calling 工具；`tools/index.ts` 汇总为 `chatTools` |
| `app/api/chat/route.ts` | 限流、DB 与 visitor 校验、组合 lib/llm 调用 streamText、UIMessage 持久化、分层错误 |
| `app/page.tsx` | 主页面：useChat、侧栏/主区布局、URL 与 chatId 同步、发送/新对话/删除逻辑、错误展示 |
| `app/layout.tsx` | 根布局、metadata、字体、KaTeX CSS |
| `components/ChatMessages.tsx` | 消息列表，每条委托给 MessageBubble |
| `components/chat/MessageBubble.tsx` | 单条消息气泡，按 role 选渲染方式 |
| `components/chat/AssistantMessageContent.tsx` | 助手内容：Markdown + 数学公式（扩展渲染能力在此修改） |
| `components/ChatInput.tsx` | 输入框、提交、加载态文案 |
| `components/ChatErrorDebug.tsx` | 解析 error.message 中的 [层级]，展示排查建议 |
| `app/api/chats/route.ts` | 按 visitor_id 拉取会话列表 |
| `app/api/chats/[id]/messages/route.ts` | 按 chat_id 拉取消息列表 |
| `app/api/chats/[id]/route.ts` | 删除会话（CASCADE 删消息） |
| `lib/supabase.ts` | Supabase 客户端（getSupabase），未配置时返回 null |
| `lib/visitor.ts` | getClientIp：从请求头解析访问者 IP |
| `lib/api-error.ts` | apiErrorResponse：统一错误 JSON + 日志打标 |
| `supabase-schema.sql` | chats / messages 建表及索引、visitor_id 说明 |

---

## 六、排查问题时的分层顺序

1. **前端**：Console 报错、Network 中 `POST /api/chat` 的 status 与 response body（是否含 `[层级]`）。
2. **接口**：终端或部署日志中搜索 `[Chat API]`，根据 `[限流]` / `[数据库]` / `[接口]` / `[模型/环境]` 定位层级。
3. **数据库**：确认 Supabase 已执行 `supabase-schema.sql`，且 env 在运行环境中正确配置。
4. **模型/环境**：确认 API Key、模型名、网络与超时；查看 `[Chat API][模型/环境]` 的完整堆栈。

---

## 七、遇到的问题与解决

开发与上线过程中遇到过的典型问题及对应处理，便于以后遇到类似情况时对照。

| 问题 | 原因 | 解决 |
|------|------|------|
| **TypeScript 报错：`Property 'input' / 'setInput' / 'handleSubmit' / 'isLoading' does not exist on type 'UseChatHelpers'`** | 新版 `@ai-sdk/react` 的 `useChat` 不再提供这些字段，API 已改为 `sendMessage` + `status`。 | 用 `useState` 管理 `input`，用 `status === 'submitted' \|\| 'streaming'` 表示 loading；提交时调用 `sendMessage({ text: input })` 并清空输入；不再使用 `api` 选项时用 `DefaultChatTransport({ api: '/api/chat' })` 传 endpoint。 |
| **发消息后一直看不到回复** | 接口返回的是 `toTextStreamResponse()` 纯文本流，而 `useChat` 需要 **UIMessage 数据流** 才能解析并更新 `messages`。 | 改为 `result.toUIMessageStreamResponse()`，前端即可正常收到并展示流式回复。 |
| **新对话里输入消息一直卡住** | 新对话时先执行了 `router.replace('/?chat=新id')`，URL 变化触发根据 `chatId` 拉取消息的 effect，拉取到空数组后 `setMessages([])`，随后 `sendMessage` 发出的请求里 `messages` 为空，后端报错或表现异常。 | **先发送再改 URL**：先 `sendMessage`，再根据是否需要更新 URL 执行 `router.replace`，最后 `fetchChats()`；避免「先改 URL → 拉空消息 → 再发空消息」的顺序。 |
| **「[数据库] 未配置数据库」** | 运行环境（本地或 Vercel 等）中未读到 `NEXT_PUBLIC_SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`。 | 本地：在项目根 `.env.local` 中配置并**重启** `npm run dev`。部署：在平台（如 Vercel）的 Environment Variables 里添加同名变量并重新部署。 |
| **手机/平板打开时「新对话」和聊天窗口一边一半** | 侧栏与主区固定左右分栏，小屏空间不足。 | 增加侧栏收起/展开：侧栏内加「收起」按钮；收起后主区显示「对话列表」按钮可再次打开；小屏下侧栏以**抽屉 + 遮罩**展示，并默认收起，选对话或新对话后自动收起。 |
| **`npm run dev` 报错：Port 3000 in use / Unable to acquire lock at .next/dev/lock** | 已有其他 `next dev` 进程在跑，或上次异常退出留下锁文件。 | 执行 `pkill -f "next dev"` 结束已有进程，并删除 `.next/dev/lock`，再重新 `npm run dev`。 |
| **是否需要 `export const runtime = 'edge'` 和 `maxTokens: 4096`？** | Edge 可延长流式时长，但会令当前**内存限流**失效（各节点独立）；大 maxTokens 易增加成本与超时。 | 保持默认 Node runtime，不设 `runtime = 'edge'`，以保留单机内存限流；`maxTokens` 暂不设置，若后续回复常被截断再按需设 1024/2048。 |
| **git push 失败：could not read Username for 'https://github.com'** | 当前环境无法交互输入 GitHub 凭据。 | 在本地终端自行执行 `git push` 并按提示登录；或改用 SSH：`git remote set-url origin git@github.com:Brezen610/my-llm-chat.git` 后再 push。 |

---

## 八、后续可扩展方向

- **登录与按账号限流**：接入 Auth，会话与限流按 `user_id` 而非 IP。
- **限流持久化**：多实例时用 Vercel KV / Upstash Redis 存储计数。
- **Markdown 渲染**：对助手回复做 Markdown 解析与渲染。
- **工具调用 (Tools)**：由 `lib/llm/tools/` 定义并汇总，API 组合使用；新增工具在该目录添加并在 `tools/index.ts` 挂载即可。助手回复的 Markdown/公式渲染在 `components/chat/AssistantMessageContent.tsx`，扩展展示能力在此修改。
