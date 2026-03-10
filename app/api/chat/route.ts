import { streamText, convertToModelMessages, generateId, tool, stepCountIs, type UIMessage } from 'ai';
import { z } from 'zod';
import { getSupabase } from '@/lib/supabase';
import { getClientIp } from '@/lib/visitor';
import { apiErrorResponse } from '@/lib/api-error';

// 工具：获取当前日期与星期几（无需用户权限，服务端即可）
const getCurrentDateTool = tool({
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

// 中文城市名 → 英文名（Open-Meteo 地理编码对中文支持差，用英文名查询）
const CITY_ZH_TO_EN: Record<string, string> = {
  北京: 'Beijing', 上海: 'Shanghai', 广州: 'Guangzhou', 深圳: 'Shenzhen', 杭州: 'Hangzhou',
  成都: 'Chengdu', 武汉: 'Wuhan', 西安: 'Xi\'an', 南京: 'Nanjing', 重庆: 'Chongqing',
  天津: 'Tianjin', 苏州: 'Suzhou', 郑州: 'Zhengzhou', 长沙: 'Changsha', 沈阳: 'Shenyang',
  青岛: 'Qingdao', 宁波: 'Ningbo', 东莞: 'Dongguan', 无锡: 'Wuxi', 厦门: 'Xiamen',
  济南: 'Jinan', 哈尔滨: 'Harbin', 福州: 'Fuzhou', 大连: 'Dalian', 昆明: 'Kunming',
  合肥: 'Hefei', 石家庄: 'Shijiazhuang', 南昌: 'Nanchang', 长春: 'Changchun',
  太原: 'Taiyuan', 南宁: 'Nanning', 贵阳: 'Guiyang', 兰州: 'Lanzhou', 海口: 'Haikou',
  乌鲁木齐: 'Urumqi', 银川: 'Yinchuan', 西宁: 'Xining', 拉萨: 'Lhasa', 呼和浩特: 'Hohhot',
  香港: 'Hong Kong', 澳门: 'Macau', 台北: 'Taipei', 高雄: 'Kaohsiung', 台中: 'Taichung',
};

async function fetchWeather(city: string): Promise<{ city: string; temp: number; desc: string }> {
  const searchName = CITY_ZH_TO_EN[city.trim()] ?? city;
  const geoRes = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchName)}&count=1`,
    { signal: AbortSignal.timeout(5000) }
  );
  const geoData = (await geoRes.json()) as { results?: Array<{ latitude: number; longitude: number; name: string }> };
  const first = geoData.results?.[0];
  if (!first) {
    return { city, temp: 0, desc: `未找到城市：${city}` };
  }
  const forecastRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${first.latitude}&longitude=${first.longitude}&current=temperature_2m,weather_code`,
    { signal: AbortSignal.timeout(5000) }
  );
  const forecast = (await forecastRes.json()) as {
    current?: { temperature_2m?: number; weather_code?: number };
  };
  const temp = forecast.current?.temperature_2m ?? 0;
  const code = forecast.current?.weather_code ?? 0;
  const desc = weatherCodeToDesc(code);
  return { city: first.name, temp, desc };
}

function weatherCodeToDesc(code: number): string {
  const map: Record<number, string> = {
    0: '晴', 1: '大部晴朗', 2: '局部多云', 3: '多云', 45: '雾', 48: '雾凇',
    51: '毛毛雨', 53: '毛毛雨', 55: '毛毛雨', 61: '小雨', 63: '中雨', 65: '大雨',
    71: '小雪', 73: '中雪', 75: '大雪', 77: '雪粒', 80: '阵雨', 81: '阵雨', 82: '强阵雨',
    85: '阵雪', 86: '强阵雪', 95: '雷暴', 96: '雷暴伴小冰雹', 99: '雷暴伴大冰雹',
  };
  return map[code] ?? `天气代码 ${code}`;
}

const getWeatherTool = tool({
  description: '查询指定城市的当前天气（温度与天气现象）。当用户问某地天气时使用。',
  inputSchema: z.object({
    city: z.string().describe('城市名称，如：北京、上海、深圳'),
  }),
  execute: async ({ city }) => fetchWeather(city),
});

const chatTools = {
  get_current_date: getCurrentDateTool,
  get_weather: getWeatherTool,
} as const;

// 可选：限制最长流式响应时间（秒）
export const maxDuration = 30;

// 简单内存限流：按 IP 每天最多 50 次
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 50;

type RateLimitRecord = {
  count: number;
  windowStart: number;
};

const ipUsage = new Map<string, RateLimitRecord>();

function checkRateLimit(req: Request): Response | null {
  const ip = getClientIp(req);
  const now = Date.now();

  const record = ipUsage.get(ip);

  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    ipUsage.set(ip, { count: 1, windowStart: now });
    return null;
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return apiErrorResponse('rate_limit', '今日请求次数已用完，请明天再试。', 429);
  }

  record.count += 1;
  ipUsage.set(ip, record);
  return null;
}

export async function POST(req: Request) {
  // 先做限流检查
  const rateLimitResponse = checkRateLimit(req);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const supabase = getSupabase();
  if (!supabase) {
    return apiErrorResponse(
      'db',
      '未配置数据库。请添加 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY 到 .env.local',
      503
    );
  }

  try {
    const body = await req.json();
    const { messages, chatId }: { messages: UIMessage[]; chatId?: string } = body;

    if (!messages?.length) {
      return apiErrorResponse('api', '请求缺少 messages', 400);
    }

    const id = chatId || crypto.randomUUID();
    const visitorId = getClientIp(req);

    if (chatId) {
      // 可能已有会话（续聊）或前端刚生成 id 的首条消息：先查是否存在
      const { data: existing } = await supabase
        .from('chats')
        .select('id, visitor_id')
        .eq('id', id)
        .single();

      if (existing) {
        if (existing.visitor_id !== visitorId) {
          return apiErrorResponse('api', '对话不存在或无权操作', 403);
        }
        // 归属正确，直接续写
      } else {
        // 会话不存在：首条消息，创建并绑定当前访问者
        const { error: chatError } = await supabase
          .from('chats')
          .insert({ id, visitor_id: visitorId, title: '新对话', created_at: new Date().toISOString() });
        if (chatError) {
          console.error('[Chat API][数据库] Chat insert error:', chatError);
        }
      }
    } else {
      // 无 chatId：新会话，创建并绑定当前访问者
      const { error: chatError } = await supabase
        .from('chats')
        .insert({ id, visitor_id: visitorId, title: '新对话', created_at: new Date().toISOString() });
      if (chatError) {
        console.error('[Chat API][数据库] Chat insert error:', chatError);
      }
    }

    // 保存最后一条用户消息，并更新会话标题（首条消息时）
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === 'user') {
      await supabase.from('messages').insert({
        chat_id: id,
        message: lastMsg,
      });
      const textPart = lastMsg.parts?.find((p): p is { type: 'text'; text: string } => p.type === 'text');
      const text = textPart?.text ?? '';
      if (text) {
        const title = text.slice(0, 30).trim() || '新对话';
        await supabase.from('chats').update({ title }).eq('id', id);
      }
    }

    const result = streamText({
      model: 'deepseek/deepseek-v3.2',
      system: '你是森奇，一个友好、专业的 AI 助手。你可以使用工具查询当前日期、星期几和各地天气。',
      messages: await convertToModelMessages(messages, { tools: chatTools }),
      tools: chatTools,
      stopWhen: stepCountIs(5),
    });

    const response = result.toUIMessageStreamResponse({
      originalMessages: messages,
      generateMessageId: generateId,
      onFinish: async ({ responseMessage }) => {
        if (responseMessage) {
          await supabase.from('messages').insert({
            chat_id: id,
            message: responseMessage,
          });
        }
      },
    });
    response.headers.set('X-Chat-Id', id);
    return response;
  } catch (error) {
    console.error('[Chat API][模型/环境]', error);
    const message = error instanceof Error ? error.message : '服务暂不可用，请稍后重试。';
    return apiErrorResponse('model', message, 500);
  }
}