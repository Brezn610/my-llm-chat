import { streamText, convertToModelMessages, generateId, type UIMessage } from 'ai';
import { getSupabase } from '@/lib/supabase';
import { getClientIp } from '@/lib/visitor';
import { apiErrorResponse } from '@/lib/api-error';

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
      system: '你是森奇，一个友好、专业的 AI 助手。',
      messages: await convertToModelMessages(messages),
      onFinish: async ({ text }) => {
        const assistantMsg: UIMessage = {
          id: generateId(),
          role: 'assistant',
          parts: [{ type: 'text', text }],
        };
        await supabase.from('messages').insert({
          chat_id: id,
          message: assistantMsg,
        });
      },
    });

    const response = result.toUIMessageStreamResponse();
    response.headers.set('X-Chat-Id', id);
    return response;
  } catch (error) {
    console.error('[Chat API][模型/环境]', error);
    const message = error instanceof Error ? error.message : '服务暂不可用，请稍后重试。';
    return apiErrorResponse('model', message, 500);
  }
}