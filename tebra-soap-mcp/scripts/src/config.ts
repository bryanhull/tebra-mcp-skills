export type TebraSoapConfig = {
  endpoint: string;
  customerKey: string;
  user: string;
  password: string;
  timeoutMs: number;
  clientVersion: string;
};

function required(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) return fallback;
  return value.trim();
}

export function loadConfig(): TebraSoapConfig {
  return {
    endpoint: optional(
      "TEBRA_SOAP_ENDPOINT",
      "https://webservice.kareo.com/services/soap/2.1/KareoServices.svc"
    ),
    customerKey: required("TEBRA_SOAP_CUSTOMER_KEY"),
    user: required("TEBRA_SOAP_USER"),
    password: required("TEBRA_SOAP_PASSWORD"),
    timeoutMs: Number(optional("TEBRA_SOAP_TIMEOUT_MS", "30000")),
    clientVersion: optional("TEBRA_SOAP_CLIENT_VERSION", "Zo-Tebra-Soap-MCP/0.1.0")
  };
}

