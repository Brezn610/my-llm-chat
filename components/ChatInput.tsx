import type { FormEvent } from 'react';

type ChatInputProps = {
  input: string;
  isLoading: boolean;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function ChatInput({ input, isLoading, onChange, onSubmit }: ChatInputProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6"
    >
      <input
        className="w-full p-5 bg-zinc-900 border border-zinc-700 rounded-3xl text-lg focus:border-blue-500 placeholder-zinc-500"
        value={input}
        placeholder="输入消息，按回车发送..."
        onChange={(e) => onChange(e.target.value)}
        disabled={isLoading}
      />
      {isLoading && (
        <div className="text-center mt-3 text-blue-400">
          森奇正在回复…
        </div>
      )}
    </form>
  );
}

