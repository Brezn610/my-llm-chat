'use client';

import { Suspense, useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useChat } from '@ai-sdk/react';
import { ChatMessages } from '@/components/ChatMessages';
import { ChatInput } from '@/components/ChatInput';

type ChatItem = { id: string; title: string; created_at: string };

function ChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chatIdFromUrl = searchParams.get('chat');

  const { messages, sendMessage, status, error, regenerate, setMessages } = useChat();
  const [input, setInput] = useState('');
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const isLoading = status === 'submitted' || status === 'streaming';

  // 加载会话列表
  const fetchChats = useCallback(async () => {
    try {
      const res = await fetch('/api/chats');
      if (res.ok) {
        const data = await res.json();
        setChats(data);
      }
    } catch (err) {
      console.error('Failed to fetch chats:', err);
    } finally {
      setLoadingChats(false);
    }
  }, []);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // 根据 URL 中的 chatId 加载消息
  useEffect(() => {
    if (!chatIdFromUrl) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    setLoadingMessages(true);

    fetch(`/api/chats/${chatIdFromUrl}/messages`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) {
          setMessages(data);
        }
      })
      .catch((err) => {
        if (!cancelled) console.error('Failed to load messages:', err);
      })
      .finally(() => {
        if (!cancelled) setLoadingMessages(false);
      });

    return () => {
      cancelled = true;
    };
  }, [chatIdFromUrl, setMessages]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!input.trim() || status !== 'ready') return;

    let currentChatId = chatIdFromUrl;
    if (!currentChatId) {
      currentChatId = crypto.randomUUID();
      router.replace(`/?chat=${currentChatId}`);
    }

    await sendMessage({ text: input }, { body: { chatId: currentChatId } });
    setInput('');
    fetchChats();
  };

  const handleNewChat = () => {
    router.replace('/');
    setMessages([]);
    setInput('');
  };

  const handleDeleteChat = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/chats/${id}`, { method: 'DELETE' });
      if (!res.ok) return;
      setChats((prev) => prev.filter((c) => c.id !== id));
      if (chatIdFromUrl === id) {
        router.replace('/');
        setMessages([]);
        setInput('');
      }
    } catch (err) {
      console.error('Failed to delete chat:', err);
    }
  };

  return (
    <div className="flex min-h-screen bg-zinc-950 text-white">
      {/* 左侧会话列表 */}
      <aside className="w-56 shrink-0 border-r border-zinc-800 flex flex-col">
        <button
          type="button"
          className="m-3 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium"
          onClick={handleNewChat}
        >
          新对话
        </button>
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {loadingChats ? (
            <p className="text-zinc-500 text-sm px-2 py-2">加载中...</p>
          ) : chats.length === 0 ? (
            <p className="text-zinc-500 text-sm px-2 py-2">暂无历史对话</p>
          ) : (
            <ul className="space-y-1">
              {chats.map((c) => (
                <li key={c.id} className="group flex items-center gap-1">
                  <button
                    type="button"
                    className={`flex-1 min-w-0 text-left px-3 py-2 rounded-lg text-sm truncate ${
                      chatIdFromUrl === c.id
                        ? 'bg-zinc-700 text-white'
                        : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                    }`}
                    onClick={() => router.replace(`/?chat=${c.id}`)}
                  >
                    {c.title}
                  </button>
                  <button
                    type="button"
                    className="shrink-0 p-1.5 rounded text-zinc-500 hover:bg-zinc-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => handleDeleteChat(e, c.id)}
                    title="删除对话"
                    aria-label="删除对话"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* 主聊天区 */}
      <main className="relative flex flex-1 flex-col max-w-2xl mx-auto py-12 min-h-screen">
        <h1 className="text-4xl font-bold text-center mb-12">
          森林奇谈机器人 🎉
        </h1>

        {error && (
          <div className="mx-6 mb-4 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            出错了，请稍后重试。
            <button
              type="button"
              onClick={() => regenerate()}
              className="ml-3 underline underline-offset-4 hover:text-red-100"
            >
              重试
            </button>
          </div>
        )}

        <div className="flex-1 px-6 space-y-8 overflow-y-auto pb-32">
          {loadingMessages ? (
            <p className="text-center text-zinc-500 mt-20">加载对话中...</p>
          ) : (
            <ChatMessages messages={messages} />
          )}
        </div>

        <ChatInput
          input={input}
          isLoading={isLoading}
          onChange={setInput}
          onSubmit={handleSubmit}
        />
      </main>
    </div>
  );
}

export default function Chat() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-500">加载中...</div>}>
      <ChatContent />
    </Suspense>
  );
}
