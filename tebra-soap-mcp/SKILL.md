---
name: tebra-soap-mcp
description: MCP server for Tebra Web Services API 2.1 (SOAP) using CustomerKey, User, and Password for office administration workflows.
compatibility: Created for Zo Computer
metadata:
  author: bryanhull.zo.computer
---

# Tebra SOAP MCP Server

This skill provides an MCP server for the Tebra/Kareo SOAP API.

## Setup

Add these secrets in [Settings > Advanced](/?t=settings&s=advanced):

- `TEBRA_SOAP_CUSTOMER_KEY`
- `TEBRA_SOAP_USER`
- `TEBRA_SOAP_PASSWORD`

Optional:

- `TEBRA_SOAP_ENDPOINT` (default: `https://webservice.kareo.com/services/soap/2.1/KareoServices.svc`)
- `TEBRA_SOAP_TIMEOUT_MS` (default: `30000`)
- `TEBRA_SOAP_CLIENT_VERSION` (default: `Zo-Tebra-Soap-MCP/0.1.0`)

If you encounter permission errors after confirming your API user permissions, or you cannot locate the required permission settings in Tebra, submit a support ticket at `https://helpme.tebra.com/Contact_Us/Customer_Care_Center`.

## Important auth note

For `GetCustomerIdFromKey`, use this payload shape:

- `GetCustomerIdFromKey` -> `request` -> `CustomerKey`, `Password`, `User`

Do not use:

- `GetCustomerIdFromKeyReq` with nested `RequestHeader`

Using the wrong shape can return `CustomerId = -1` even with valid credentials.

## Request-shape guardrails

- Most `Get*` operations in this API are safest with a `request` wrapper and explicit `Fields` + `Filter` blocks.
- For analytics, `ProcedureCode` may return mixed values (numeric CPTs and non-CPT strings). Count only 5-digit numeric CPT values.
- If server-side date filters return unexpected windows, fetch with safe filters and apply client-side filtering using returned date fields (for example, `ServiceStartDate`).

## Run

```bash
cd /home/workspace/Skills/tebra-soap-mcp/scripts
npm install
npm run build
npm start
```

## Tools

- `tebra_soap_list_operations`
- `tebra_soap_debug_auth`
- `tebra_soap_health_check`
- `tebra_soap_call_operation`
- `tebra_soap_get_patient`
- `tebra_soap_get_appointments`
- `tebra_soap_get_patients`
- `tebra_soap_get_charges`
- `tebra_soap_get_payments`
