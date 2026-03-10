'use client';

import type { UIMessage } from 'ai';
import { AssistantMessageContent } from './AssistantMessageContent';

type Props = { message: UIMessage };

/**
 * 单条消息气泡：按 role 选择渲染方式。
 * - user: 纯文本
 * - assistant: Markdown + 公式（AssistantMessageContent），后续可在此扩展 tool 调用展示等
 */
export function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] p-5 rounded-3xl ${
          isUser ? 'bg-blue-600' : 'bg-zinc-800'
        }`}
      >
        {message.parts?.map((part, index) => {
          if (part.type !== 'text') return null;
          if (message.role === 'assistant') {
            return <AssistantMessageContent key={index} text={part.text} />;
          }
          return <span key={index}>{part.text}</span>;
        })}
      </div>
    </div>
  );
}
