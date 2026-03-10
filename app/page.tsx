'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { ChatMessages } from '@/components/ChatMessages';
import { ChatInput } from '@/components/ChatInput';
import { ChatErrorDebug } from '@/components/ChatErrorDebug';

type ChatItem = { id: string; title: string; created_at: string };

/** 自定义 fetch：接口非 2xx 时读出后端返回的 error 文案并抛出，便于分层展示 */
async function chatFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (!res.ok && String(input).includes('/api/chat')) {
    const ct = res.headers.get('content-type');
    if (ct?.includes('application/json')) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? res.statusText);
    }
  }
  return res;
}

function ChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chatIdFromUrl = searchParams.get('chat');

  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/chat', fetch: chatFetch }),
    []
  );
  const [input, setInput] = useState('');
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // 小屏默认收起，大屏会通过 useEffect 设为 true
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const lastChatIdRef = useRef<string | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const onFinish = useCallback(async ({ message }: { message: { id?: string; role?: string } }) => {
    const cid = lastChatIdRef.current;
    if (cid && message?.role === 'assistant' && message?.id) {
      try {
        await fetch(`/api/chats/${cid}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message }),
        });
      } catch (e) {
        console.error('Failed to persist assistant message:', e);
      }
    }
  }, []);

  const userTimezone = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Asia/Shanghai';
  const { messages, sendMessage, status, error, regenerate, setMessages } = useChat({
    transport,
    onFinish,
    body: { timezone: userTimezone },
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  // 每次消息更新（含流式输出）都滚到底部，便于看到最新回复
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 回到顶端按钮：同时监听窗口与消息区域滚动，任一滚动超过 300px 时显示
  useEffect(() => {
    const onScroll = () => {
      const el = messagesContainerRef.current;
      const scrollTop = el && el.scrollHeight > el.clientHeight ? el.scrollTop : window.scrollY;
      setShowBackToTop(scrollTop > 300);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    const container = messagesContainerRef.current;
    if (container) container.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      container?.removeEventListener('scroll', onScroll);
    };
  }, [loadingMessages, messages.length]);

  // 大屏默认展开侧栏，小屏默认收起
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    setSidebarOpen(mq.matches);
    const handler = () => setSidebarOpen(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

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

    const text = input.trim();
    const currentChatId = chatIdFromUrl || crypto.randomUUID();
    lastChatIdRef.current = currentChatId;
    setInput('');
    await sendMessage({ text }, { body: { chatId: currentChatId, timezone: userTimezone } });
    if (!chatIdFromUrl) {
      router.replace(`/?chat=${currentChatId}`);
    }
    fetchChats();
  };

  const handleNewChat = () => {
    router.replace('/');
    setMessages([]);
    setInput('');
    setSidebarOpen(false); // 小屏时选中后收起侧栏
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
    <div className="flex h-screen overflow-hidden bg-zinc-950 text-white">
      {/* 小屏时侧栏打开时的遮罩，点击收起 */}
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="收起侧栏"
        />
      )}

      {/* 左侧会话列表：大屏为侧栏，小屏为抽屉 */}
      <aside
        className={
          'z-40 flex flex-col border-r border-zinc-800 bg-zinc-950 transition-[width,transform] duration-200 ease-out ' +
          (sidebarOpen ? 'w-56' : 'w-0 min-w-0 overflow-hidden ') +
          'md:relative md:shrink-0 ' +
          'max-md:fixed max-md:inset-y-0 max-md:left-0 ' +
          (sidebarOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full')
        }
      >
        <div className="flex h-14 w-56 shrink-0 items-center gap-2 border-b border-zinc-800 px-3">
          <button
            type="button"
            className="m-0 flex-1 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium"
            onClick={handleNewChat}
          >
            新对话
          </button>
          <button
            type="button"
            className="shrink-0 p-2 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white"
            onClick={() => setSidebarOpen(false)}
            title="收起对话列表"
            aria-label="收起对话列表"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
        </div>
        <div className="scrollbar-dark flex-1 overflow-y-auto px-2 pb-4">
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
                    onClick={() => {
                      router.replace(`/?chat=${c.id}`);
                      setSidebarOpen(false); // 小屏时选中后收起侧栏
                    }}
                  >
                    {c.title}
                  </button>
                  <button
                    type="button"
                    className="shrink-0 p-1.5 rounded text-red-500 hover:bg-zinc-700 hover:text-red-400"
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

      {/* 主聊天区：小屏侧栏打开时留出左边距避免挡标题，侧栏收起时加大顶边距避免「对话列表」按钮挡标题 */}
      <main
        className={
          'relative flex flex-1 flex-col max-w-2xl mx-auto min-h-0 min-w-0 py-12 ' +
          (sidebarOpen ? 'max-md:ml-56' : 'max-md:pt-20')
        }
      >
        {/* 侧栏收起时显示「打开对话列表」按钮 */}
        {!sidebarOpen && (
          <button
            type="button"
            className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white"
            onClick={() => setSidebarOpen(true)}
            title="打开对话列表"
            aria-label="打开对话列表"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            对话列表
          </button>
        )}
        <h1 className="text-4xl font-bold text-center mb-12">
          森林奇谈机器人 🎉
        </h1>

        {error && (
          <ChatErrorDebug error={error} onRetry={() => regenerate()} />
        )}

        <div
          ref={messagesContainerRef}
          className="scrollbar-dark flex-1 px-6 space-y-8 overflow-y-auto pb-32 min-h-0"
        >
          {loadingMessages ? (
            <p className="text-center text-zinc-500 mt-20">加载对话中...</p>
          ) : (
            <>
              <ChatMessages messages={messages} />
              <div ref={messagesEndRef} aria-hidden="true" />
            </>
          )}
        </div>

        {showBackToTop && (
          <button
            type="button"
            className="fixed bottom-36 right-8 z-20 flex items-center justify-center w-10 h-10 rounded-full bg-zinc-700 text-zinc-300 shadow-lg hover:bg-zinc-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            onClick={() => {
              const el = messagesContainerRef.current;
              if (el && el.scrollHeight > el.clientHeight) {
                el.scrollTo({ top: 0, behavior: 'smooth' });
              } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            title="回到顶端"
            aria-label="回到顶端"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
          </button>
        )}

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
