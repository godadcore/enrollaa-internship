const SUPABASE_URL_KEY = "NEXT_PUBLIC_SUPABASE_URL";
const SUPABASE_PUBLISHABLE_KEY = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";

type PublicSupabaseConfig = {
  url: string;
  publishableKey: string;
};

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required Supabase environment variable: ${name}.`);
  return value;
}

function validateSupabaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("Unsupported protocol");
  } catch {
    throw new Error(`${SUPABASE_URL_KEY} must be a valid HTTP(S) URL.`);
  }
  return url;
}

export function getPublicSupabaseConfig(): PublicSupabaseConfig {
  return {
    url: validateSupabaseUrl(requiredEnvironmentValue(SUPABASE_URL_KEY)),
    publishableKey: requiredEnvironmentValue(SUPABASE_PUBLISHABLE_KEY),
  };
}

