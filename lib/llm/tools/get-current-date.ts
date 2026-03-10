import { tool } from 'ai';
import { z } from 'zod';

/** 默认时区（未传用户时区时使用，如国内用户） */
const DEFAULT_TZ = 'Asia/Shanghai';

/**
 * 创建「当前日期与时间」工具，按指定时区返回。
 * 用于解决服务器时区与用户不一致（如你 13:25，服务器 12:25）的问题。
 */
function createGetCurrentDateTool(userTimezone?: string) {
  const tz = userTimezone && isValidTimezone(userTimezone) ? userTimezone : DEFAULT_TZ;
  return tool({
    description: '获取当前日期和星期几、当前时间。当用户问“今天星期几”“今天几号”“现在几点”时使用。',
    inputSchema: z.object({}),
    execute: () => {
      const now = new Date();
      return {
        date: now.toLocaleDateString('zh-CN', { timeZone: tz, year: 'numeric', month: 'long', day: 'numeric' }),
        weekday: now.toLocaleDateString('zh-CN', { timeZone: tz, weekday: 'long' }),
        time: now.toLocaleTimeString('zh-CN', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
        iso: now.toLocaleString('zh-CN', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).replace(/\//g, '-'),
      };
    },
  });
}

function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** 无时区时的默认工具（供 getChatTools 使用） */
export const getCurrentDateTool = createGetCurrentDateTool();
export { createGetCurrentDateTool };
