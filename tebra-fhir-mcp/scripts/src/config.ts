export type TebraConfig = {
  clientId: string;
  clientSecret: string;
  scope: string;
  tokenUrl: string;
  fhirBaseUrl: string;
  timeoutMs: number;
  audience?: string;
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function optionalEnv(name: string, fallback: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) return fallback;
  return value.trim();
}

export function loadConfig(): TebraConfig {
  return {
    clientId: requiredEnv("TEBRA_CLIENT_ID"),
    clientSecret: requiredEnv("TEBRA_CLIENT_SECRET"),
    scope: optionalEnv("TEBRA_SCOPE", "system/*.read"),
    tokenUrl: optionalEnv("TEBRA_TOKEN_URL", "https://fhir.prd.cloud.tebra.com/smartauth/oauth/token"),
    fhirBaseUrl: optionalEnv("TEBRA_FHIR_BASE_URL", "https://fhir.prd.cloud.tebra.com/fhir-request"),
    timeoutMs: Number(optionalEnv("TEBRA_TIMEOUT_MS", "30000")),
    audience: process.env.TEBRA_AUDIENCE?.trim() || undefined
  };
}

