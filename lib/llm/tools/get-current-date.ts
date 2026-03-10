import { tool } from 'ai';
import { z } from 'zod';

/** 获取当前日期与星期几（Function Calling 工具，无需用户权限） */
export const getCurrentDateTool = tool({
  description: '获取当前日期和星期几。当用户问“今天星期几”“今天几号”“现在什么时候”时使用。',
  inputSchema: z.object({}),
  execute: async () => {
    const now = new Date();
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    return {
      date: now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }),
      weekday: weekdays[now.getDay()],
      iso: now.toISOString().slice(0, 19).replace('T', ' '),
    };
  },
});
