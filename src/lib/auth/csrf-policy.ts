export type OriginPolicyInput = {
  origin: string | null;
  host: string | null;
  forwardedHost: string | null;
  forwardedProto: string | null;
  trustedOrigin: string | string[] | null;
};

export function validateMutationOrigin(input: OriginPolicyInput): string | null {
  if (!input.origin || input.origin === "null") return "A valid request origin is required.";
  const trustedOrigins = Array.isArray(input.trustedOrigin) ? input.trustedOrigin : [input.trustedOrigin];
  const trusted = trustedOrigins
    .filter((origin): origin is string => Boolean(origin))
    .map((origin) => {
      try { return new URL(origin); } catch { return null; }
    })
    .find((candidate) => candidate?.origin === input.origin);
  if (!trusted) return "The request origin is not allowed.";

  const effectiveHost = (input.forwardedHost || input.host || "").split(",")[0].trim();
  if (!effectiveHost || effectiveHost !== trusted.host) return "The request host is not allowed.";
  if (input.forwardedProto && input.forwardedProto.split(",")[0].trim() !== trusted.protocol.slice(0, -1)) {
    return "The request protocol is not allowed.";
  }
  return null;
}
