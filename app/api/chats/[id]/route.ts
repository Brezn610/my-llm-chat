import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getOrCreateVisitorId, setVisitorCookie } from '@/lib/visitor';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  try {
    const { id } = await params;
    const { visitorId, isNew: isNewVisitor } = getOrCreateVisitorId(req);

    const { data: chat, error: fetchError } = await supabase
      .from('chats')
      .select('id')
      .eq('id', id)
      .eq('visitor_id', visitorId)
      .single();

    if (fetchError || !chat) {
      return NextResponse.json({ error: '对话不存在或无权删除' }, { status: 404 });
    }

    const { error } = await supabase.from('chats').delete().eq('id', id);

    if (error) throw error;
    const res = NextResponse.json({ ok: true });
    if (isNewVisitor) setVisitorCookie(res, visitorId);
    return res;
  } catch (err) {
    console.error('DELETE /api/chats/[id] error:', err);
    return NextResponse.json(
      { error: 'Failed to delete chat' },
      { status: 500 }
    );
  }
}
