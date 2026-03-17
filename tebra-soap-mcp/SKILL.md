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

## Runtime guidance

**Always use the skill's wrapper tools** (`tebra_soap_health_check`, `tebra_soap_get_appointments`, etc.) rather than direct shell commands or manual API calls.

The Tebra SOAP secrets are only available within the skill's MCP server runtime. Direct shell commands (e.g., `curl`, custom scripts run via `run_bash_command`) will not have access to `TEBRA_SOAP_CUSTOMER_KEY`, `TEBRA_SOAP_USER`, or `TEBRA_SOAP_PASSWORD` environment variables.

## Important auth note

For `GetCustomerIdFromKey`, use this payload shape:

- `GetCustomerIdFromKey` -> `request` -> `CustomerKey`, `Password`, `User`

Do not use:

- `GetCustomerIdFromKeyReq` with nested `RequestHeader`

Using the wrong shape can return `CustomerId = -1` even with valid credentials.

## Request-shape guardrails

- Most `Get*` operations in this API are safest with a `request` wrapper and explicit `Fields` + `Filter` blocks.
- **Singular vs plural operations have different shapes**: `GetAppointments` (plural) returns minimal data (ID, start time) even when requesting additional fields; use `GetAppointment` (singular) with a specific nested structure for full patient/reason details.
- **Deserialization errors indicate shape mismatch**: If you get XML deserialization errors, verify you're using the exact operation name from the WSDL and the correct nesting (some operations require `request` -> `Fields` then `Filter`, in that order).
- **Field ordering matters**: Some operations require `Fields` before `Filter` in the XML structure; reversing them can cause errors.
- For analytics, `ProcedureCode` may return mixed values (numeric CPTs and non-CPT strings). Count only 5-digit numeric CPT values.
- If server-side date filters return unexpected windows, fetch with safe filters and apply client-side filtering using returned date fields (for example, `ServiceStartDate`).

## Data behavior notes

- **Filter behavior inconsistency**: Server-side date and patient filters on operations like `GetCharges` do not always narrow results as expected. Date windows may return out-of-range rows. Always apply client-side filtering on returned date fields (e.g., `ServiceStartDate`, `ServiceEndDate`) to ensure accurate windows.
- **GetPatient nil payloads**: Authenticated calls to `GetPatient` may return `Patient: nil` even for valid PatientIDs. This suggests permission scoping or data availability limitations in your tenant. For diagnosis/chart data enrichment, prefer `GetCharges` (which includes `DiagnosisCode1-4` fields) or encounter-level data over `GetPatient` when available.
- **GetEncounterDetails is single-encounter only**: This operation requires a specific `EncounterID` and does not accept broad patient/date filters. It cannot be used for "get all encounters for patient X this month" style queries — use it only when you already have a specific encounter ID from another operation (e.g., from `GetCharges`).
- **Tenant-specific variations**: Data availability varies by Tebra tenant configuration. If an operation returns empty/minimal data despite successful authentication, verify API user permissions in Tebra or contact support.

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
