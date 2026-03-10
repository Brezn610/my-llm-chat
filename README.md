# 森林奇谈机器人

基于 Next.js + Vercel AI SDK + DeepSeek 的免费 AI 聊天应用，支持多会话、流式回复、查日期/天气（Function Calling）、Markdown 与数学公式渲染。

---

## 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│  前端 (React + useChat + Tailwind)                               │
│  app/page.tsx · components/chat/ · components/ChatMessages 等     │
│  消息列表、侧栏、输入框、助手消息 Markdown/公式渲染                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │ POST /api/chat (流式)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  API 层 (Next.js App Router)                                     │
│  app/api/chat/route.ts  限流、DB、visitor、组合 LLM 调用、持久化   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  lib/llm/     │  │  Supabase       │  │  限流 (内存)     │
│  模型·提示·   │  │  chats/messages │  │  IP 每日 50 次   │
│  Function     │  │  按 visitor 隔离 │  │                 │
│  Calling 工具 │  │                 │  │                 │
└───────────────┘  └─────────────────┘  └─────────────────┘
```

### 代码分层

| 层级 | 目录/文件 | 说明 |
|------|-----------|------|
| **LLM 层** | `lib/llm/` | 模型 ID、系统提示、Function Calling 工具（日期、天气）。新增工具在 `lib/llm/tools/` 添加并在 `tools/index.ts` 挂载。 |
| **前端渲染** | `components/chat/` | 助手消息的 Markdown + 公式（`AssistantMessageContent`）、单条气泡（`MessageBubble`）。扩展展示能力在此修改。 |
| **API** | `app/api/chat/route.ts` | 限流、数据库、visitor 校验，从 `lib/llm` 取配置并调用 `streamText`，不内联工具或提示词。 |
| **持久化** | Supabase | 会话与消息按 `visitor_id`（当前为 IP）隔离。 |

更细的接口说明、限流与错误分层、排查顺序见 **[docs/TECH-PATH.md](docs/TECH-PATH.md)**。

---

## 技术栈

- **框架**: Next.js 16 (App Router) + React 19  
- **样式**: Tailwind CSS 4  
- **聊天/流式**: Vercel AI SDK（`ai`、`@ai-sdk/react`），UIMessage 流  
- **大模型**: DeepSeek（可经 AI Gateway 等转发）  
- **数据库**: Supabase (PostgreSQL)  
- **语言**: TypeScript 5  

---

## 快速开始

### 环境要求

- Node.js 18+  
- npm / pnpm / yarn  

### 安装与运行

```bash
git clone https://github.com/<your-username>/my-llm-app.git
cd my-llm-app
npm install
```

复制环境变量并填入自己的配置：

```bash
cp .env.example .env.local
```

编辑 `.env.local`，必填项：

| 变量 | 说明 |
|------|------|
| `AI_GATEWAY_API_KEY` | 大模型 API Key（如 DeepSeek 或网关 Key） |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key（服务端写库用） |

初始化数据库：在 Supabase SQL 编辑器中执行项目根目录的 **`supabase-schema.sql`**。

启动开发服务器：

```bash
npm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000) 即可使用。

---

## 扩展方式

- **新增 Function Calling 工具**：在 `lib/llm/tools/` 新建 `xxx.ts` 定义工具，在 `lib/llm/tools/index.ts` 中挂到 `chatTools`，API 会自动带上新工具。  
- **修改人设/模型**：改 `lib/llm/config.ts` 中的 `SYSTEM_PROMPT`、`CHAT_MODEL`。  
- **助手消息展示（代码高亮、表格等）**：在 `components/chat/AssistantMessageContent.tsx` 中扩展 Markdown/插件或样式。  

---

## 部署

- 将仓库部署到 Vercel / 其他 Node 平台即可。  
- 在部署环境配置与 `.env.example` 中相同的环境变量。  
- 限流当前为内存实现，多实例部署时需自行改为 Redis/KV 等共享存储（见 [docs/TECH-PATH.md](docs/TECH-PATH.md)）。  

---

## 开源与使用

- **许可证**：本项目采用 [MIT License](LICENSE)。  
- **贡献**：欢迎提 Issue 和 Pull Request，请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。  
- **安全**：若发现安全问题，请按 [SECURITY.md](SECURITY.md) 私下报告，勿在公开 Issue 中披露。  
- **敏感信息**：请勿将 `.env.local` 或任何含 API Key 的文件提交到仓库；`.env*` 已列入 `.gitignore`。  

---

## 相关文档

- [docs/TECH-PATH.md](docs/TECH-PATH.md) — 技术路径、接口、限流、错误分层与排查  
- [lib/llm/README.md](lib/llm/README.md) — LLM 层与工具目录说明  
