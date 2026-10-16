export type OriginPolicyInput = {
  origin: string | null;
  host: string | null;
  forwardedHost: string | null;
  forwardedProto: string | null;
  trustedOrigin: string | null;
};

export function validateMutationOrigin(input: OriginPolicyInput): string | null {
  if (!input.origin || input.origin === "null") return "A valid request origin is required.";
  if (!input.trustedOrigin || input.origin !== input.trustedOrigin) return "The request origin is not allowed.";

  const trusted = new URL(input.trustedOrigin);
  const effectiveHost = input.forwardedHost || input.host;
  if (!effectiveHost || effectiveHost !== trusted.host) return "The request host is not allowed.";
  if (input.forwardedProto && input.forwardedProto.split(",")[0].trim() !== trusted.protocol.slice(0, -1)) {
    return "The request protocol is not allowed.";
  }
  return null;
}
