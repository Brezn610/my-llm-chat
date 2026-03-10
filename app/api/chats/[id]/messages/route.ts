import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getClientIp } from '@/lib/visitor';
import { apiErrorResponse } from '@/lib/api-error';
import type { UIMessage } from 'ai';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabase();
  if (!supabase) {
    return apiErrorResponse('db', '未配置数据库', 503);
  }
  try {
    const { id } = await params;
    const visitorId = getClientIp(req);

    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('id')
      .eq('id', id)
      .eq('visitor_id', visitorId)
      .single();

    if (chatError || !chat) {
      return apiErrorResponse('api', '对话不存在或无权查看', 404);
    }

    const { data, error } = await supabase
      .from('messages')
      .select('message')
      .eq('chat_id', id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const messages = (data ?? []).map((row) => row.message);
    return NextResponse.json(messages);
  } catch (err) {
    console.error('[Chat API][数据库] GET /api/chats/[id]/messages error:', err);
    return apiErrorResponse('db', '获取消息失败', 500);
  }
}

/** 追加一条消息（流式结束后由前端调用，保证刷新后能看到最新回复；按 message.id 去重） */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabase();
  if (!supabase) {
    return apiErrorResponse('db', '未配置数据库', 503);
  }
  try {
    const { id } = await params;
    const visitorId = getClientIp(req);

    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('id')
      .eq('id', id)
      .eq('visitor_id', visitorId)
      .single();

    if (chatError || !chat) {
      return apiErrorResponse('api', '对话不存在或无权操作', 403);
    }

    const body = await req.json();
    const message = body?.message as UIMessage | undefined;
    if (!message?.id) {
      return apiErrorResponse('api', '请求体需包含 message 且含 id', 400);
    }

    const { data: rows } = await supabase
      .from('messages')
      .select('message')
      .eq('chat_id', id);
    const alreadyExists = (rows ?? []).some((r) => (r.message as { id?: string })?.id === message.id);
    if (alreadyExists) {
      return NextResponse.json({ ok: true });
    }

    const { error } = await supabase.from('messages').insert({ chat_id: id, message });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[Chat API][数据库] POST /api/chats/[id]/messages error:', err);
    return apiErrorResponse('db', '保存消息失败', 500);
  }
}
