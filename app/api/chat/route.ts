import { streamText, convertToModelMessages, generateId, type UIMessage } from 'ai';
import { getSupabase } from '@/lib/supabase';
import { getClientIp, getOrCreateVisitorId, setVisitorCookie } from '@/lib/visitor';
import { apiErrorResponse } from '@/lib/api-error';
import { CHAT_MODEL, SYSTEM_PROMPT, getChatTools, chatStopWhen } from '@/lib/llm';

export const maxDuration = 30;

const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 50;

type RateLimitRecord = { count: number; windowStart: number };
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
  const rateLimitResponse = checkRateLimit(req);
  if (rateLimitResponse) return rateLimitResponse;

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
    const { messages, chatId, timezone }: { messages: UIMessage[]; chatId?: string; timezone?: string } = body;
    const tools = getChatTools(timezone);

    if (!messages?.length) {
      return apiErrorResponse('api', '请求缺少 messages', 400);
    }

    const id = chatId || crypto.randomUUID();
    const { visitorId, isNew: isNewVisitor } = getOrCreateVisitorId(req);

    if (chatId) {
      const { data: existing } = await supabase
        .from('chats')
        .select('id, visitor_id')
        .eq('id', id)
        .single();

      if (existing) {
        if (existing.visitor_id !== visitorId) {
          return apiErrorResponse('api', '对话不存在或无权操作', 403);
        }
      } else {
        const { error: chatError } = await supabase
          .from('chats')
          .insert({ id, visitor_id: visitorId, title: '新对话', created_at: new Date().toISOString() });
        if (chatError) console.error('[Chat API][数据库] Chat insert error:', chatError);
      }
    } else {
      const { error: chatError } = await supabase
        .from('chats')
        .insert({ id, visitor_id: visitorId, title: '新对话', created_at: new Date().toISOString() });
      if (chatError) console.error('[Chat API][数据库] Chat insert error:', chatError);
    }

    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === 'user') {
      await supabase.from('messages').insert({ chat_id: id, message: lastMsg });
      const textPart = lastMsg.parts?.find((p): p is { type: 'text'; text: string } => p.type === 'text');
      const text = textPart?.text ?? '';
      if (text) {
        const title = text.slice(0, 30).trim() || '新对话';
        await supabase.from('chats').update({ title }).eq('id', id);
      }
    }

    const result = streamText({
      model: CHAT_MODEL,
      system: SYSTEM_PROMPT,
      messages: await convertToModelMessages(messages, { tools }),
      tools,
      stopWhen: chatStopWhen,
    });

    const response = result.toUIMessageStreamResponse({
      originalMessages: messages,
      generateMessageId: generateId,
      onFinish: async ({ responseMessage }) => {
        if (responseMessage) {
          await supabase.from('messages').insert({ chat_id: id, message: responseMessage });
        }
      },
    });
    response.headers.set('X-Chat-Id', id);
    if (isNewVisitor) setVisitorCookie(response, visitorId);
    return response;
  } catch (error) {
    console.error('[Chat API][模型/环境]', error);
    const message = error instanceof Error ? error.message : '服务暂不可用，请稍后重试。';
    return apiErrorResponse('model', message, 500);
  }
}
