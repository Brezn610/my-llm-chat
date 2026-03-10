# LLM 层

与「调用大模型、Function Calling、系统提示」相关的逻辑集中在此目录，便于区分 LLM 与前端/API 职责。

## 结构

- **`config.ts`**  
  模型 ID、系统提示词、工具调用停止条件。改人设或模型在这里改。

- **`tools/`**  
  Function Calling 工具，每个能力一个文件，在 `tools/index.ts` 汇总为 `chatTools`。
  - `get-current-date.ts`：当前日期与星期几
  - `get-weather.ts`：城市天气。配置 `QWEATHER_API_KEY`（及可选 `QWEATHER_API_HOST`）时使用和风天气（中文城市名、中文描述）；未配置则回退到 Open-Meteo（需内置中文→英文城市映射）
  - 新增工具：在 `tools/` 下新增 `xxx.ts`，在 `tools/index.ts` 里挂到 `chatTools` 即可。

- **`index.ts`**  
  对外统一导出：`CHAT_MODEL`、`SYSTEM_PROMPT`、`chatTools`、`chatStopWhen`。  
  API 路由从 `@/lib/llm` 引入，通过组合实现完整对话流程。

## 与 API 的关系

`app/api/chat/route.ts` 只负责：限流、数据库、visitor 校验、从 `@/lib/llm` 取配置并调用 `streamText`、持久化。  
不在此目录写业务工具或系统提示，保持「LLM 配置与工具」与「HTTP/存储」解耦。
