const LOCAL_APP_URL = "http://localhost:3000";

export type ApplicationUrlEnv = {
  APP_URL?: string;
  NODE_ENV?: string;
};

function isLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".localhost");
}

/**
 * Resolves the server-side public URL used in email links. `APP_URL` is never
 * exposed to the browser; it is only read while constructing server emails.
 */
export function resolveApplicationUrl(env: ApplicationUrlEnv = {
  APP_URL: process.env.APP_URL,
  NODE_ENV: process.env.NODE_ENV,
}): string {
  const configured = env.APP_URL?.trim();
  const production = env.NODE_ENV === "production";

  if (!configured) {
    if (production) throw new Error("The public application URL is not configured.");
    return LOCAL_APP_URL;
  }

  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    throw new Error("The public application URL is invalid.");
  }

  if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password || parsed.hash) {
    throw new Error("The public application URL is invalid.");
  }

  if (production && isLocalHostname(parsed.hostname)) {
    throw new Error("The public application URL is not configured.");
  }

  const path = parsed.pathname.replace(/\/$/, "");
  return `${parsed.origin}${path === "/" ? "" : path}`;
}

export function getApplicationUrl(): string {
  return resolveApplicationUrl();
}

export function publicApplicationLink(pathname: string, token: string, env?: ApplicationUrlEnv): string {
  const baseUrl = env ? resolveApplicationUrl(env) : getApplicationUrl();
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${baseUrl}${path}?token=${encodeURIComponent(token)}`;
}
