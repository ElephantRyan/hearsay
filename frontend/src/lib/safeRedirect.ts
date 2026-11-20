/**
 * Where to go after signing in. Only a path on this site is allowed: an
 * absolute URL, a protocol-relative "//host", or a backslash trick would turn
 * the sign-in page into an open redirect.
 */
export function safeRedirect(target: string | undefined): string {
  if (!target) return "/";
  if (!target.startsWith("/") || target.startsWith("//") || target.includes("\\")) return "/";
  if (target.startsWith("/sign-in")) return "/";
  return target;
}
