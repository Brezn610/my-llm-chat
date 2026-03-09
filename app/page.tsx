'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useChat } from '@ai-sdk/react';
import { ChatMessages } from '@/components/ChatMessages';
import { ChatInput } from '@/components/ChatInput';

const STORAGE_KEY = 'chat-messages';

export default function Chat() {
  const { messages, sendMessage, status, error, regenerate, setMessages } = useChat();
  const [input, setInput] = useState('');
  const isLoading = status === 'submitted' || status === 'streaming';

  // 首次加载时，从 localStorage 恢复历史消息
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        setMessages(parsed);
      }
    } catch {
      // 解析失败就忽略
    }
  }, [setMessages]);

  // 每次消息变化时，写入 localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!messages.length) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!input.trim() || status !== 'ready') return;

    await sendMessage({ text: input });
    setInput('');
  };

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto py-12 min-h-screen bg-zinc-950 text-white">
      <h1 className="text-4xl font-bold text-center mb-12">我的第一个 LLM 聊天机器人 🎉</h1>

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
        <ChatMessages messages={messages} />
      </div>

      <ChatInput
        input={input}
        isLoading={isLoading}
        onChange={setInput}
        onSubmit={handleSubmit}
      />
    </div>
  );
}