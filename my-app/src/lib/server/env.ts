type RequiredKey = 'SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY' | 'SUPABASE_STORAGE_BUCKET';

function requireEnv(name: RequiredKey): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value;
}

export function getSupabaseEnv() {
  return {
    url: requireEnv('SUPABASE_URL'),
    serviceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    bucket: requireEnv('SUPABASE_STORAGE_BUCKET'),
  };
}

export function getAiEnv() {
  const apiKey = process.env.POE_API_KEY;
  if (!apiKey) {
    throw new Error('Missing required env var: POE_API_KEY');
  }

  return {
    apiKey,
    model: process.env.POE_MODEL ?? 'Grok-4',
    baseUrl: process.env.POE_BASE_URL ?? 'https://api.poe.com/v1',
  };
}
