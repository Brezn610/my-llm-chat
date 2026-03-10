'use client';

/** 从接口返回的 error 文案中解析出层级（[限流] [数据库] [接口] [模型/环境]） */
function parseLayer(message: string): string | null {
  const m = message.match(/^\[([^\]]+)\]/);
  return m ? m[1] : null;
}

const LAYER_HINTS: Record<string, string> = {
  '限流': '1. 检查终端/服务器日志是否有 [Chat API][限流]。2. 今日该 IP 已达 50 次上限，明日重置或调整 RATE_LIMIT_MAX_REQUESTS。',
  '数据库': '1. 检查 .env.local 是否有 NEXT_PUBLIC_SUPABASE_URL、SUPABASE_SERVICE_ROLE_KEY。2. 在 Supabase 执行过 supabase-schema.sql 吗？',
  '接口': '1. 看 Network 里 POST /api/chat 的 Request Payload 是否包含 messages。2. 检查终端是否有 [Chat API][接口] 相关报错。',
  '模型/环境': '1. 检查 AI API Key（如 AI_GATEWAY_API_KEY）是否配置且有效。2. 看终端 [Chat API][模型/环境] 的完整报错。3. 若部署在 Vercel，在项目 Environment Variables 中配置相同变量。',
};

type Props = {
  error: Error | undefined;
  onRetry: () => void;
};

export function ChatErrorDebug({ error, onRetry }: Props) {
  if (!error) return null;

  const message = error.message || '未知错误';
  const layer = parseLayer(message);

  return (
    <div className="mx-6 mb-4 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
      <div className="font-medium text-red-100">出错了</div>
      <p className="mt-1">{message}</p>
      {layer && (
        <div className="mt-3 rounded-lg bg-zinc-900/80 px-3 py-2 text-zinc-300">
          <div className="text-xs font-medium text-zinc-400">问题层级：{layer}</div>
          <p className="mt-1.5 text-xs leading-relaxed">{LAYER_HINTS[layer] ?? '请查看浏览器 Network 与终端日志排查。'}</p>
        </div>
      )}
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 underline underline-offset-4 hover:text-red-100"
      >
        重试
      </button>
    </div>
  );
}
