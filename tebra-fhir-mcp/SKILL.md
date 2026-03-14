---
name: tebra-fhir-mcp
description: MCP server for Tebra FHIR (Kareo EHR) with OAuth2 client-credentials auth and read-focused tools for patients and clinical resources.
compatibility: Created for Zo Computer
metadata:
  author: bryanhull.zo.computer
---

# Tebra FHIR MCP Server

This skill provides a local MCP server that connects to Tebra's FHIR API.

## What it does

- Authenticates using OAuth2 client credentials
- Reads patient and clinical FHIR resources
- Exposes MCP tools for common data retrieval workflows

## Setup

1. In Zo, add these secrets in [Settings > Advanced](/?t=settings&s=advanced):
   - `TEBRA_CLIENT_ID`
   - `TEBRA_CLIENT_SECRET`
2. Optional secrets:
   - `TEBRA_SCOPE` (default: `system/*.read`)
   - `TEBRA_TOKEN_URL` (default: `https://fhir.prd.cloud.tebra.com/smartauth/oauth/token`)
   - `TEBRA_FHIR_BASE_URL` (default: `https://fhir.prd.cloud.tebra.com/fhir-request`)
   - `TEBRA_TIMEOUT_MS` (default: `30000`)
   - `TEBRA_AUDIENCE` (only if your tenant requires it)

## Run

```bash
cd /home/workspace/Skills/tebra-fhir-mcp/scripts
npm install
npm run build
npm start
```

## MCP tools

- `tebra_health_check`
- `tebra_search_patients`
- `tebra_get_patient`
- `tebra_search_resource`
- `tebra_patient_clinical_summary`
