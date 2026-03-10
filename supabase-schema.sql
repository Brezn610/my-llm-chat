-- 在 Supabase Dashboard -> SQL Editor 中执行此脚本

-- 会话表
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT DEFAULT '新对话',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 消息表（存储 UIMessage 格式）
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  message JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 索引：按会话查询消息
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);

-- 索引：按时间列出会话
CREATE INDEX IF NOT EXISTS idx_chats_created_at ON chats(created_at DESC);
