'use client';

import type { UIMessage } from 'ai';
import { MessageBubble } from '@/components/chat/MessageBubble';

type ChatMessagesProps = {
  messages: UIMessage[];
};

export function ChatMessages({ messages }: ChatMessagesProps) {
  if (messages.length === 0) {
    return (
      <p className="text-center text-zinc-500 mt-20">
        发送消息试试看～
      </p>
    );
  }

  return (
    <>
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}
    </>
  );
}
