/**
 * Function Calling 工具汇总。
 * 新增工具：在此目录添加 xxx.ts 并在此处挂到 chatTools 上即可。
 */
import { createGetCurrentDateTool, getCurrentDateTool } from './get-current-date';
import { getWeatherTool } from './get-weather';
import { suggestSeasoningTool } from './suggest-seasoning';

/** 按请求时区生成的工具（用于日期显示与用户本地时间一致）；未传时区则用默认。 */
export function getChatTools(userTimezone?: string) {
  return {
    get_current_date: createGetCurrentDateTool(userTimezone),
    get_weather: getWeatherTool,
    suggest_seasoning: suggestSeasoningTool,
  } as const;
}

export const chatTools = {
  get_current_date: getCurrentDateTool,
  get_weather: getWeatherTool,
  suggest_seasoning: suggestSeasoningTool,
} as const;
