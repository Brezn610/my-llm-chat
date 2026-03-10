import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getClientIp } from '@/lib/visitor';
import { apiErrorResponse } from '@/lib/api-error';

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
