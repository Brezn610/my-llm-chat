import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getOrCreateVisitorId, setVisitorCookie } from '@/lib/visitor';
import { apiErrorResponse } from '@/lib/api-error';

export async function GET(req: Request) {
  const supabase = getSupabase();
  if (!supabase) {
    return apiErrorResponse('db', '未配置数据库', 503);
  }
  try {
    const { visitorId, isNew: isNewVisitor } = getOrCreateVisitorId(req);
    const { data, error } = await supabase
      .from('chats')
      .select('id, title, created_at')
      .eq('visitor_id', visitorId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    const res = NextResponse.json(data ?? []);
    if (isNewVisitor) setVisitorCookie(res, visitorId);
    return res;
  } catch (err) {
    console.error('[Chat API][数据库] GET /api/chats error:', err);
    return apiErrorResponse('db', '获取会话列表失败', 500);
  }
}
