# Tebra FHIR MCP Server

## Install

```bash
npm install
npm run build
```

## Required environment variables

- `TEBRA_CLIENT_ID`
- `TEBRA_CLIENT_SECRET`

## Optional environment variables

- `TEBRA_SCOPE` (default: `system/*.read`)
- `TEBRA_TOKEN_URL` (default: `https://fhir.prd.cloud.tebra.com/smartauth/oauth/token`)
- `TEBRA_FHIR_BASE_URL` (default: `https://fhir.prd.cloud.tebra.com/fhir-request`)
- `TEBRA_TIMEOUT_MS` (default: `30000`)
- `TEBRA_AUDIENCE`

## Run

```bash
npm start
```

## Example MCP client config (stdio)

```json
{
  "mcpServers": {
    "tebra": {
      "command": "node",
      "args": ["/home/workspace/Skills/tebra-fhir-mcp/scripts/dist/index.js"],
      "env": {
        "TEBRA_CLIENT_ID": "<your-client-id>",
        "TEBRA_CLIENT_SECRET": "<your-client-secret>"
      }
    }
  }
}
```

## Exposed tools

- `tebra_health_check`
- `tebra_search_patients`
- `tebra_get_patient`
- `tebra_search_resource`
- `tebra_patient_clinical_summary`
