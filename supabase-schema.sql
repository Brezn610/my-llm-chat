-- 在 Supabase Dashboard -> SQL Editor 中执行此脚本

-- 会话表（visitor_id 用于按 IP/访问者隔离，同一访问者只能看到自己的对话）
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL,
  title TEXT DEFAULT '新对话',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 若表已存在且无 visitor_id，需在 Supabase SQL Editor 中执行：
-- ALTER TABLE chats ADD COLUMN IF NOT EXISTS visitor_id TEXT;
-- UPDATE chats SET visitor_id = 'unknown' WHERE visitor_id IS NULL;
-- CREATE INDEX IF NOT EXISTS idx_chats_visitor_id ON chats(visitor_id);
-- CREATE INDEX IF NOT EXISTS idx_chats_visitor_created ON chats(visitor_id, created_at DESC);

-- 消息表（存储 UIMessage 格式）
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  message JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 索引：按会话查询消息
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);

-- 索引：按访问者+时间列出会话
CREATE INDEX IF NOT EXISTS idx_chats_visitor_created ON chats(visitor_id, created_at DESC);
