const VISITOR_COOKIE = 'visitor_id';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 年

/** 从 Cookie 读取访问者 ID（同一浏览器持久化，IP 变化也不丢会话） */
export function getVisitorIdFromCookie(req: Request): string | null {
  const raw = req.headers.get('Cookie');
  if (!raw) return null;
  const match = raw.match(new RegExp(`${VISITOR_COOKIE}=([^;]+)`));
  return match?.[1]?.trim() || null;
}

/**
 * 获取或创建访问者 ID：优先读 Cookie（换网络后仍能认人），无则用当前 IP 并写入 Cookie。
 * 兼容已有按 IP 存的数据；返回 isNew 时调用方需在 Response 上 Set-Cookie。
 */
export function getOrCreateVisitorId(req: Request): { visitorId: string; isNew: boolean } {
  const fromCookie = getVisitorIdFromCookie(req);
  if (fromCookie) return { visitorId: fromCookie, isNew: false };
  const currentIp = getClientIp(req);
  return { visitorId: currentIp, isNew: true };
}

/** 在 Response 上设置 visitor_id Cookie（仅当 getOrCreateVisitorId 返回 isNew 时调用） */
export function setVisitorCookie(res: Response, visitorId: string): void {
  const value = `${VISITOR_COOKIE}=${visitorId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
  res.headers.append('Set-Cookie', value);
}

/** 限流等仍按 IP 使用 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}
