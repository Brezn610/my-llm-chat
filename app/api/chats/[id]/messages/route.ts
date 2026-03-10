import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { apiErrorResponse } from '@/lib/api-error';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabase();
  if (!supabase) {
    return apiErrorResponse('db', '未配置数据库', 503);
  }
  try {
    const { id } = await params;
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
