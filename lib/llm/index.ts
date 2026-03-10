/**
 * LLM 层统一导出。
 * - config: 模型、系统提示、工具、停止条件
 * - tools: 各 Function Calling 工具（也可通过 config 的 chatTools 使用）
 */
export { CHAT_MODEL, SYSTEM_PROMPT, chatStopWhen, chatTools } from './config';
export { chatTools as tools } from './tools';
