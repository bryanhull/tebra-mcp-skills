# Tebra SOAP MCP Server

MCP server for Tebra Web Services API 2.1 (SOAP), focused on office administration workflows such as appointments, patients, charges, and payments.

## Overview

This server provides a stable MCP layer on top of Tebra's SOAP API so AI agents can query and operate against practice-management data without hand-crafting SOAP envelopes for each call.

It is designed for:

- Office administration and billing-adjacent workflows not fully covered by Tebra FHIR APIs.
- Read-focused automation (appointments, patients, charges, payments).
- Safe extensibility through a generic operation passthrough tool.

## Scope and non-goals

In scope:

- Authentication validation and connection diagnostics.
- Read/reporting workflows using key Get operations.
- Controlled access to additional SOAP operations via generic passthrough.

Out of scope:

- Replacing all Tebra API capabilities with opinionated wrappers.
- Long-running job orchestration or queueing.
- Data warehouse ETL (use a dedicated pipeline for large historical exports).

## Source references

Implemented and validated against:

- WSDL: `https://webservice.kareo.com/services/soap/2.1/KareoServices.svc?singleWsdl`
- Converted technical guide: `/home/workspace/Reports/Tebra API Integration Technical Guide.md`

## Prerequisites

1. Obtain Customer Key in Tebra (My Account -> Get Customer Key).
2. Ensure API user has required permissions (System Admin/account admin as required by Tebra docs). If you still see permission errors after verifying settings, or you cannot find the needed permission settings in your tenant, submit a support ticket to `https://helpme.tebra.com/Contact_Us/Customer_Care_Center`.
3. Confirm SOAP API access is enabled for your account.

## Installation

```bash
npm install
npm run build
```

## Configuration

### Required environment variables

- `TEBRA_SOAP_CUSTOMER_KEY`
- `TEBRA_SOAP_USER`
- `TEBRA_SOAP_PASSWORD`

### Optional environment variables

- `TEBRA_SOAP_ENDPOINT` (default: `https://webservice.kareo.com/services/soap/2.1/KareoServices.svc`)
- `TEBRA_SOAP_TIMEOUT_MS` (default: `30000`)
- `TEBRA_SOAP_CLIENT_VERSION` (default: `Zo-Tebra-Soap-MCP/0.1.0`)

## Running the server

```bash
npm start
```

## MCP client configuration (stdio)

```json
{
  "mcpServers": {
    "tebra-soap": {
      "command": "node",
      "args": ["/home/workspace/Skills/tebra-soap-mcp/scripts/dist/index.js"],
      "env": {
        "TEBRA_SOAP_CUSTOMER_KEY": "<customer-key>",
        "TEBRA_SOAP_USER": "<username>",
        "TEBRA_SOAP_PASSWORD": "<password>"
      }
    }
  }
}
```

## Exposed tools

- `tebra_soap_list_operations`
- `tebra_soap_debug_auth`
- `tebra_soap_health_check`
- `tebra_soap_call_operation` (generic)
- `tebra_soap_get_patient`
- `tebra_soap_get_appointments`
- `tebra_soap_get_patients`
- `tebra_soap_get_charges`
- `tebra_soap_get_payments`

## Tool reference

### `tebra_soap_health_check`

Purpose:

- Validates credentials and endpoint connectivity.

Behavior:

- Calls `GetCustomerIdFromKey` using the required special payload shape.

Use when:

- First-time setup.
- Rotating credentials.
- Confirming whether auth failures are credential vs request-shape issues.

### `tebra_soap_debug_auth`

Purpose:

- Returns detailed auth diagnostics from one or more operations.

Behavior:

- Extracts and returns `SecurityResponse`, `ErrorResponse`, `CustomerId`, and SOAP fault details where present.

Use when:

- You need a support-ready diagnostic payload.
- Calls succeed at HTTP level but fail authorization.

### `tebra_soap_call_operation`

Purpose:

- Generic passthrough for operations without dedicated wrappers.

Behavior:

- Supports overriding request element name.
- For `Get*` operations, defaults request wrapper to `request` when not specified.
- For `GetCustomerIdFromKey`, defaults to inline auth mode and `request` wrapper.

Use when:

- You need `Create*`, `Update*`, `Delete*`, or less common `Get*` operations not yet wrapped.

### Wrapper tools (`tebra_soap_get_*`)

Purpose:

- Opinionated wrappers for commonly used read operations.

Behavior:

- Sends requests with explicit `<Fields>` and `<Filter>` blocks for better compatibility.
- Uses `request` wrapper for supported `Get*` calls.

## Request model and SOAP envelope behavior

### Baseline model

Many API calls use a request object that contains `RequestHeader` and operation-specific request payload.

### Critical special case

`GetCustomerIdFromKey` does not follow the typical nested `RequestHeader` shape used by many other calls.

Working shape:

```xml
<sch:GetCustomerIdFromKey>
  <sch:request>
    <sch:CustomerKey>[REDACTED]</sch:CustomerKey>
    <sch:Password>[REDACTED]</sch:Password>
    <sch:User>[REDACTED]</sch:User>
  </sch:request>
</sch:GetCustomerIdFromKey>
```

Common failing shape:

```xml
<api:GetCustomerIdFromKey>
  <api:GetCustomerIdFromKeyReq>
    <api:RequestHeader>
      <api:CustomerKey>[REDACTED]</api:CustomerKey>
      <api:Password>[REDACTED]</api:Password>
      <api:User>[REDACTED]</api:User>
    </api:RequestHeader>
  </api:GetCustomerIdFromKeyReq>
</api:GetCustomerIdFromKey>
```

## Known pitfalls and how this server handles them

1. `GetCustomerIdFromKey` auth shape mismatch.
- Server enforces inline auth + `request` for this call.

2. `Get*` wrapper mismatch (`request` vs `<Operation>Req`).
- Generic tool now defaults to `request` for `Get*` unless overridden.

3. Missing `Fields`/`Filter` sections on Get operations.
- Wrapper tools explicitly send both blocks.

4. `GetPractices` null-reference edge case when no filter is supplied.
- Use a minimal filter (for example `Active=true`) if encountered.

5. Mixed `ProcedureCode` types.
- Expect both numeric CPT values and non-CPT codes (for example `COSME`).
- For CPT reporting, count only 5-digit numeric values.

6. Date-window discrepancies across filter modes.
- If server-side date filters produce surprising windows, fetch safely and apply client-side windowing against returned date fields (for example `ServiceStartDate`).

## Common operation guidance

### Get operations

- Prefer scoped filters (`PracticeName`, plus date window).
- For date filters, send both start and end values.
- Narrow by patient/provider/location when possible to reduce payload size.

### Charges/CPT analytics

Recommended approach:

1. Fetch charges with `ProcedureCode` and relevant date fields.
2. Normalize code values to string.
3. Keep only 5-digit numeric CPT values.
4. Group and count.
5. Report top N and total lines considered.

### Payments

- Include date filters and patient filters for operational reporting.
- Validate whether payment date vs created date is the desired business metric.

## Rate limits and throughput

Selected limits from Tebra documentation:

- `GetAppointments`: 1 call/second
- `GetCharges`: 1 call/second
- `GetPatients`: 1 call/second
- `GetPayments`: 1 call/second
- `CreateAppointment`: 1 call every 0.5 seconds
- `UpdateAppointment`: 1 call every 0.5 seconds
- `DeleteAppointment`: 1 call every 0.5 seconds

Operational recommendations:

- Add retry with exponential backoff for 429 responses.
- Avoid burst polling across many concurrent tasks.
- Prefer batched reporting windows over high-frequency polling.

## Error model and diagnostics

Inspect these fields in responses:

- `SecurityResponse`
- `ErrorResponse`
- SOAP fault body (`s:Fault`)

Typical patterns:

- `CustomerId = -1` / `IsAuthorized = false`: auth payload shape, credentials mismatch, or permissions.
- `DeserializationFailed`: wrapper or XML schema mismatch.
- Internal service fault with null-reference: often missing expected filter/body structure.

## Security and PHI handling

- Never hardcode credentials in source files.
- Use environment variables only.
- Treat responses as potentially sensitive/PHI-bearing data.
- Minimize logged payload details in shared logs.
- Redact identifiers before sharing diagnostics externally.

## Local development

From `scripts/`:

```bash
npm install
npm run build
npm start
```

Development notes:

- Server is TypeScript compiled to `dist/`.
- SOAP calls are implemented in `src/soap-client.ts`.
- Tool registration and wrapper behavior are in `src/index.ts`.

## Suggested validation checklist

1. Run build (`npm run build`).
2. Run `tebra_soap_health_check`.
3. Run `tebra_soap_debug_auth` for `GetCustomerIdFromKey` and `GetThrottles`.
4. Run one wrapper tool (`tebra_soap_get_charges`) with a narrow date range.
5. Confirm no SOAP fault and expected `SecurityResponse` success.

## Troubleshooting playbook

### Auth fails but endpoint reachable

- Run `tebra_soap_health_check`.
- Verify `GetCustomerIdFromKey` uses `request` with inline auth fields.
- Confirm credentials all belong to the same tenant.
- Confirm API permissions are assigned to the API user.

### Permission settings unclear in Tebra

- Open support ticket: `https://helpme.tebra.com/Contact_Us/Customer_Care_Center`

### Empty result sets

- Confirm date window and business date type (created vs modified vs service).
- Confirm `PracticeName` exactly matches authorized practice.
- Confirm filters are not overly restrictive.

### 429 throttling

- Reduce request frequency.
- Add retry/backoff.
- Spread load over time windows.

### XML encoding issues

- Ensure special characters are escaped (`&`, `<`, `>`, `"`, `'`).

## FAQ

### Does this replace Tebra FHIR?

No. Use SOAP for office administration workflows and operations that are not fully available in FHIR.

### Can I call operations not in the wrappers?

Yes. Use `tebra_soap_call_operation` and provide operation-specific request XML.

### Why does SoapUI sometimes work when code fails?

Usually due to subtle payload shape differences (`request` wrapper, `Fields/Filter` blocks, or auth placement).

## Contributing

When adding a new wrapper tool:

1. Confirm exact request/response shape in WSDL.
2. Add explicit `Fields` + `Filter` construction where applicable.
3. Keep auth mode explicit for special-case operations.
4. Update README sections for usage and pitfalls.
5. Validate with a live call and include expected response markers.

## License

Internal project codebase. Add repository-level licensing terms if publishing externally.
