import { stepCountIs } from 'ai';

/** 当前使用的模型标识 */
export const CHAT_MODEL = 'deepseek/deepseek-v3.2';

/** 系统提示词（可在此修改人设与能力说明） */
export const SYSTEM_PROMPT =
  '你是森奇，一个友好、专业的 AI 助手。你可以使用工具查询当前日期、星期几和各地天气。';

/** 工具调用最大步数（避免无限循环） */
export const CHAT_MAX_STEPS = 5;
export const chatStopWhen = stepCountIs(CHAT_MAX_STEPS);

export { chatTools } from './tools';
