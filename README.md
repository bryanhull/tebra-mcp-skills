# Tebra MCP Skills

This repository contains Zo skills for Tebra integrations:

- `tebra-soap-mcp`: SOAP Web Services API 2.1 tools for office administration workflows.
- `tebra-fhir-mcp`: FHIR API tools for clinical interoperability workflows.

Each skill has its own `SKILL.md` and implementation under `scripts/`.

## Quick start

1. Add required secrets/environment variables in Zo.
2. Build the skill script packages:

```bash
cd Skills/tebra-soap-mcp/scripts && npm install && npm run build
cd ../tebra-fhir-mcp/scripts && npm install && npm run build
```
