import "server-only";

const SUPABASE_SECRET_KEY = "SUPABASE_SECRET_KEY";

export function getServerSupabaseSecretKey(): string {
  const value = process.env[SUPABASE_SECRET_KEY]?.trim();

  if (!value) {
    throw new Error(`Missing required Supabase environment variable: ${SUPABASE_SECRET_KEY}.`);
  }

  return value;
}
