/**
 * The `next` redirect parameter (login, register, Google, change password). Only a
 * same-site relative path is accepted: it starts with "/" but not "//" or "/\", has no
 * backslash or control character, and stays on this origin once resolved. Anything
 * else becomes "/". Safe in server and client code.
 */
const BASE = "http://lamsa.invalid";

export function safeNext(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048)
    return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  // Browsers treat "\" like "/" ("/\evil.example"), and control characters are trimmed.
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return "/";
  try {
    const url = new URL(value, BASE);
    if (url.origin !== BASE) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

/** "/login?next=…" (or "/register?next=…"); no parameter when next is "/". */
export function withNext(path: string, next: unknown): string {
  const target = safeNext(next);
  return target === "/" ? path : `${path}?next=${encodeURIComponent(target)}`;
}
