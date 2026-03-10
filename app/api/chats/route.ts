import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { apiErrorResponse } from '@/lib/api-error';

export async function GET() {
  const supabase = getSupabase();
  if (!supabase) {
    return apiErrorResponse('db', '未配置数据库', 503);
  }
  try {
    const { data, error } = await supabase
      .from('chats')
      .select('id, title, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error('[Chat API][数据库] GET /api/chats error:', err);
    return apiErrorResponse('db', '获取会话列表失败', 500);
  }
}
