/**
 * 分层错误：接口层统一返回格式，便于前端和日志排查
 * 层级：rate_limit | db | api | model
 */
export type ErrorLayer = 'rate_limit' | 'db' | 'api' | 'model';

export type ApiErrorBody = {
  error: string;
  layer: ErrorLayer;
};

const LAYER_LABELS: Record<ErrorLayer, string> = {
  rate_limit: '限流',
  db: '数据库',
  api: '接口',
  model: '模型/环境',
};

function formatMessage(layer: ErrorLayer, detail: string): string {
  return `[${LAYER_LABELS[layer]}] ${detail}`;
}

/** 返回 JSON 错误 Response，并打标日志 */
export function apiErrorResponse(
  layer: ErrorLayer,
  detail: string,
  status: number
): Response {
  const message = formatMessage(layer, detail);
  const body: ApiErrorBody = { error: message, layer };

  console.error(`[Chat API][${LAYER_LABELS[layer]}]`, detail);

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-Error-Layer': layer,
    },
  });
}
