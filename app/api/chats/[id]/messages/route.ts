import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
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
    console.error('GET /api/chats/[id]/messages error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}
