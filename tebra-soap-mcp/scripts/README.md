# Tebra SOAP MCP Server

MCP server for Tebra Web Services API 2.1 (SOAP) focused on office administration workflows (appointments, patients, charges, payments, etc.).

## What this server is for

- Practice-management and billing workflows that are not fully covered by Tebra FHIR APIs.
- Read and operational workflows such as `GetAppointments`, `GetPatients`, `GetCharges`, `GetPayments`.
- Advanced SOAP operations via a generic passthrough tool.

## Source reference

This server was implemented against:

- WSDL: `https://webservice.kareo.com/services/soap/2.1/KareoServices.svc?singleWsdl`
- Converted technical guide: `/home/workspace/Reports/Tebra API Integration Technical Guide.md`

## Prerequisites

1. Obtain Customer Key in Tebra (My Account -> Get Customer Key).
2. Ensure API user has required permissions (System Admin/account admin as required by Tebra docs). If you still see permission errors after verifying settings, or you cannot find the needed permission settings in your tenant, submit a support ticket to `https://helpme.tebra.com/Contact_Us/Customer_Care_Center`.
3. Confirm SOAP API access is enabled for your account.

## Install

```bash
npm install
npm run build
```

## Required environment variables

- `TEBRA_SOAP_CUSTOMER_KEY`
- `TEBRA_SOAP_USER`
- `TEBRA_SOAP_PASSWORD`

## Optional environment variables

- `TEBRA_SOAP_ENDPOINT` (default: `https://webservice.kareo.com/services/soap/2.1/KareoServices.svc`)
- `TEBRA_SOAP_TIMEOUT_MS` (default: `30000`)
- `TEBRA_SOAP_CLIENT_VERSION` (default: `Zo-Tebra-Soap-MCP/0.1.0`)

## Run

```bash
npm start
```

## Example MCP client config (stdio)

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

## Auth model and request shape

Most operations use a request object with nested `RequestHeader`.

- Example pattern: `<Operation><OperationReq><RequestHeader>...</RequestHeader>...</OperationReq></Operation>`

Special case:

- `GetCustomerIdFromKey` works with: `<GetCustomerIdFromKey><request><CustomerKey/><Password/><User/></request></GetCustomerIdFromKey>`

### `GetCustomerIdFromKey` example: failing vs working

Failing shape:

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

## Known pitfalls and how this skill avoids them

1. `GetCustomerIdFromKey` is a special auth shape.
   - It must use `<request><CustomerKey/><Password/><User/></request>`.
   - This skill forces `inline_auth` + `request` for that operation.

2. Many `Get*` operations expect `<request>`, not `<Operation>Req`.
   - In practice, `GetCharges`, `GetPractices`, `GetPatients`, `GetAppointments`, and `GetPayments` are safest with `<request>`.
   - The generic tool now defaults `request_element_name` to `request` for `Get*` operations unless you override it.

3. `Get*` operations often require both `Fields` and `Filter` blocks.
   - Sending only flat top-level keys can lead to empty results or internal faults.
   - The wrapper tools now send `<Fields>` + `<Filter>` explicitly in the request body.

4. `GetPractices` may fail when `Filter` is omitted.
   - If you see a null-reference/internal error, include a minimal filter such as `Active=true`.
   - This is a known server behavior quirk, not credential failure.

5. `ProcedureCode` values can be mixed types.
   - Some values are numeric CPTs (e.g., `99215`), others are non-CPT strings (e.g., `COSME`).
   - For CPT analytics, count only 5-digit numeric codes and support both numeric and string representations.

6. Date fields can behave differently by operation.
   - If a server-side date filter looks inconsistent, fetch with a broad but safe filter, then filter client-side using returned date fields (for example `ServiceStartDate`) for reporting windows.

## Common usage guidance from Tebra docs

- Prefer `PracticeName` filters for Get operations.
- If using date filters, provide both start and end (for example, `FromCreatedDate` and `ToCreatedDate`).
- Use narrower filters to reduce payload size and API load.
- Poll conservatively; avoid high-frequency polling when not needed.

## Rate limit reminders (selected)

- `GetAppointments`: 1 call/second
- `GetCharges`: 1 call/second
- `GetPatients`: 1 call/second
- `GetPayments`: 1 call/second
- `CreateAppointment`: 1 call every 0.5 seconds
- `UpdateAppointment`: 1 call every 0.5 seconds
- `DeleteAppointment`: 1 call every 0.5 seconds

429 responses are account-level throttling; add delay/retry backoff.

## Using the generic tool safely

`tebra_soap_call_operation` is for operations not yet wrapped in dedicated MCP tools.

- It auto-injects `RequestHeader` by default.
- Use `request_element_name` when the operation expects a non-default request wrapper.
- Use `extra_request_xml` for nested objects.

## Troubleshooting

- `CustomerId = -1` / `IsAuthorized = false`:
  - Verify operation-specific request shape first (especially `GetCustomerIdFromKey`).
  - Confirm key/user/password belong to the same account.
  - Confirm API permissions and account activation.
- `DeserializationFailed` fault:
  - Wrong request wrapper or XML schema mismatch for that operation.
- `429`:
  - Slow down and add retry with backoff.
- XML special characters in password (`&`, `<`, `>`, `"`, `'`):
  - Must be XML-escaped by the client.
