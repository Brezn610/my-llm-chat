'use client';

import type { UIMessage } from 'ai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

type ChatMessagesProps = {
  messages: UIMessage[];
};

/** 将模型常用的 \( \) 和 \[ \] 转为 remark-math 支持的 $ 和 $$ */
function normalizeMathDelimiters(text: string): string {
  return text
    .replace(/\\\[/g, '$$')
    .replace(/\\\]/g, '$$')
    .replace(/\\\(/g, '$')
    .replace(/\\\)/g, '$');
}

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
        <div
          key={m.id}
          className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[85%] p-5 rounded-3xl ${
              m.role === 'user' ? 'bg-blue-600' : 'bg-zinc-800'
            }`}
          >
            {m.parts?.map((part, index) => {
              if (part.type !== 'text') return null;
              const raw = part.text;
              if (m.role === 'assistant') {
                const normalized = normalizeMathDelimiters(raw);
                return (
                  <div key={index} className="chat-markdown [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-0.5 [&_strong]:font-semibold break-words">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={{
                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      }}
                    >
                      {normalized}
                    </ReactMarkdown>
                  </div>
                );
              }
              return <span key={index}>{raw}</span>;
            })}
          </div>
        </div>
      ))}
    </>
  );
}
