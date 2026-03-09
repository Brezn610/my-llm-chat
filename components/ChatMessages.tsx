import type { UIMessage } from 'ai';

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
        <div
          key={m.id}
          className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[85%] p-5 rounded-3xl ${
              m.role === 'user' ? 'bg-blue-600' : 'bg-zinc-800'
            }`}
          >
            {m.parts?.map((part, index) =>
              part.type === 'text' ? <span key={index}>{part.text}</span> : null,
            )}
          </div>
        </div>
      ))}
    </>
  );
}

