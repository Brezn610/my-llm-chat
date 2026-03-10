/**
 * Function Calling 工具汇总。
 * 新增工具：在此目录添加 xxx.ts 并在此处挂到 chatTools 上即可。
 */
import { getCurrentDateTool } from './get-current-date';
import { getWeatherTool } from './get-weather';

export const chatTools = {
  get_current_date: getCurrentDateTool,
  get_weather: getWeatherTool,
} as const;
