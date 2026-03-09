import { streamText, convertToModelMessages, type UIMessage } from 'ai';

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

function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }

  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp;

  return 'unknown';
}

function checkRateLimit(req: Request): Response | null {
  const ip = getClientIp(req);
  const now = Date.now();

  const record = ipUsage.get(ip);

  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    ipUsage.set(ip, { count: 1, windowStart: now });
    return null;
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return new Response(
      JSON.stringify({
        error: '今日请求次数已用完，请明天再试。',
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
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

  try {
    const { messages }: { messages: UIMessage[] } = await req.json();

    const result = streamText({
      model: 'deepseek/deepseek-v3.2',
      messages: await convertToModelMessages(messages),
    });

    // 返回 UIMessage 流，才能被 useChat 正确解析并更新 messages
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('Chat API error:', error);

    return new Response(
      JSON.stringify({ error: 'Chat service unavailable, please try again later.' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }
}