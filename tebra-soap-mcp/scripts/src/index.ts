import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from "./config.js";
import { TebraSoapClient } from "./soap-client.js";

const OPERATIONS = [
  "GetCustomerIdFromKey",
  "GetPatient",
  "GetPatients",
  "GetAllPatients",
  "GetAppointment",
  "GetAppointments",
  "GetAppointmentReasons",
  "GetCharges",
  "GetPayments",
  "GetPractices",
  "GetProviders",
  "GetServiceLocations",
  "GetProcedureCodes",
  "GetTransactions",
  "GetEncounterDetails",
  "CreatePatient",
  "CreateAppointment",
  "CreateEncounter",
  "CreatePayment",
  "UpdatePatient",
  "UpdateAppointment",
  "UpdateEncounterStatus",
  "DeleteAppointment",
  "CreateDocument",
  "DeleteDocument"
] as const;

function toText(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function extractDiagnostics(parsed: unknown): {
  securityResponse?: unknown;
  errorResponse?: unknown;
  customerKeyValid?: unknown;
  authenticated?: unknown;
  authorized?: unknown;
  customerId?: unknown;
  fault?: unknown;
} {
  const diagnostics: {
    securityResponse?: unknown;
    errorResponse?: unknown;
    customerKeyValid?: unknown;
    authenticated?: unknown;
    authorized?: unknown;
    customerId?: unknown;
    fault?: unknown;
  } = {};

  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;

    for (const [key, value] of Object.entries(obj)) {
      if (key === "SecurityResponse") diagnostics.securityResponse = value;
      if (key === "ErrorResponse") diagnostics.errorResponse = value;
      if (key === "s:Fault") diagnostics.fault = value;
      if (key === "CustomerKeyValid") diagnostics.customerKeyValid = value;
      if (key === "Authenticated") diagnostics.authenticated = value;
      if (key === "Authorized") diagnostics.authorized = value;
      if (key === "CustomerId") diagnostics.customerId = value;
      walk(value);
    }
  };

  walk(parsed);
  return diagnostics;
}

const config = loadConfig();
const soap = new TebraSoapClient(config);
const server = new McpServer({
  name: "tebra-soap-mcp-server",
  version: "0.1.0"
});

server.registerTool(
  "tebra_soap_list_operations",
  {
    title: "List SOAP Operations",
    description: "List common Tebra SOAP operations exposed by this MCP server.",
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async () => ({
    content: [{ type: "text", text: toText(OPERATIONS) }],
    structuredContent: { operations: OPERATIONS }
  })
);

server.registerTool(
  "tebra_soap_debug_auth",
  {
    title: "Debug SOAP Auth",
    description:
      "Run auth diagnostics against SOAP and extract SecurityResponse/ErrorResponse/fault details for support troubleshooting.",
    inputSchema: {
      operations: z
        .array(z.string())
        .optional()
        .describe("Optional operations list. Defaults to GetCustomerIdFromKey and GetThrottles.")
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async ({ operations }) => {
    const ops = operations?.length ? operations : ["GetCustomerIdFromKey", "GetThrottles"];
    const results: Record<string, unknown> = {};

    for (const op of ops) {
      try {
        const out =
          op === "GetCustomerIdFromKey"
            ? await soap.callOperation(op, { requestElement: "request", authMode: "inline_auth" })
            : await soap.callOperation(op);
        results[op] = {
          diagnostics: extractDiagnostics(out.parsed),
          parsed: out.parsed
        };
      } catch (error) {
        results[op] = {
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }

    return {
      content: [{ type: "text", text: toText(results) }],
      structuredContent: results
    };
  }
);

server.registerTool(
  "tebra_soap_health_check",
  {
    title: "SOAP Health Check",
    description: "Validate SOAP credentials by calling GetCustomerIdFromKey.",
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async () => {
    const result = await soap.callOperation("GetCustomerIdFromKey", {
      requestElement: "request",
      authMode: "inline_auth"
    });
    return {
      content: [{ type: "text", text: toText(result.parsed) }],
      structuredContent: result
    };
  }
);

server.registerTool(
  "tebra_soap_call_operation",
  {
    title: "Call SOAP Operation (Generic)",
    description:
      "Call any SOAP operation. RequestHeader is added automatically; provide only operation-specific XML fields.",
    inputSchema: {
      operation: z
        .string()
        .min(1)
        .describe("SOAP operation name such as GetPatients, CreateAppointment, UpdatePatient"),
      request_element_name: z
        .string()
        .optional()
        .describe("Optional request element name. Defaults to <Operation>Req."),
      extra_request_xml: z
        .string()
        .optional()
        .describe(
          "Raw XML inserted under the request element, after RequestHeader (for example: <api:PatientID>123</api:PatientID>)"
        )
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    }
  },
  async ({ operation, request_element_name, extra_request_xml }) => {
    const result = await soap.callOperation(operation, {
      requestElement: request_element_name,
      extraRequestXml: extra_request_xml ?? ""
    });
    return {
      content: [{ type: "text", text: toText(result.parsed) }],
      structuredContent: result
    };
  }
);

server.registerTool(
  "tebra_soap_get_patient",
  {
    title: "Get Patient",
    description: "Get one patient by PatientID (office admin SOAP API).",
    inputSchema: {
      patient_id: z.number().int().positive(),
      include_cases: z.boolean().optional().default(true)
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async ({ patient_id, include_cases }) => {
    const result = await soap.callOperation("GetPatient", {
      fields: {
        PatientID: patient_id,
        IncludeCases: include_cases
      }
    });
    return {
      content: [{ type: "text", text: toText(result.parsed) }],
      structuredContent: result
    };
  }
);

server.registerTool(
  "tebra_soap_get_appointments",
  {
    title: "Get Appointments",
    description: "Get appointments with required PracticeName and optional filters.",
    inputSchema: {
      practice_name: z.string().min(1),
      from_created_date: z.string().optional().describe("YYYY-MM-DD"),
      to_created_date: z.string().optional().describe("YYYY-MM-DD"),
      from_last_modified_date: z.string().optional().describe("YYYY-MM-DD"),
      to_last_modified_date: z.string().optional().describe("YYYY-MM-DD"),
      start_date: z.string().optional().describe("ISO datetime"),
      end_date: z.string().optional().describe("ISO datetime"),
      patient_id: z.number().int().positive().optional(),
      patient_full_name: z.string().optional(),
      service_location_name: z.string().optional(),
      appointment_reason: z.string().optional()
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (input) => {
    const result = await soap.callOperation("GetAppointments", {
      fields: {
        PracticeName: input.practice_name,
        FromCreatedDate: input.from_created_date,
        ToCreatedDate: input.to_created_date,
        FromLastModifiedDate: input.from_last_modified_date,
        ToLastModifiedDate: input.to_last_modified_date,
        StartDate: input.start_date,
        EndDate: input.end_date,
        PatientID: input.patient_id,
        PatientFullName: input.patient_full_name,
        ServiceLocationName: input.service_location_name,
        AppointmentReason: input.appointment_reason
      }
    });
    return {
      content: [{ type: "text", text: toText(result.parsed) }],
      structuredContent: result
    };
  }
);

server.registerTool(
  "tebra_soap_get_patients",
  {
    title: "Get Patients",
    description: "Get patients for a practice with optional date/name filters.",
    inputSchema: {
      practice_name: z.string().min(1),
      from_created_date: z.string().optional().describe("YYYY-MM-DD"),
      to_created_date: z.string().optional().describe("YYYY-MM-DD"),
      from_last_modified_date: z.string().optional().describe("YYYY-MM-DD"),
      to_last_modified_date: z.string().optional().describe("YYYY-MM-DD"),
      patient_full_name: z.string().optional(),
      include_cases: z.boolean().optional().default(false)
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (input) => {
    const result = await soap.callOperation("GetPatients", {
      fields: {
        PracticeName: input.practice_name,
        FromCreatedDate: input.from_created_date,
        ToCreatedDate: input.to_created_date,
        FromLastModifiedDate: input.from_last_modified_date,
        ToLastModifiedDate: input.to_last_modified_date,
        PatientFullName: input.patient_full_name,
        IncludeCases: input.include_cases
      }
    });
    return {
      content: [{ type: "text", text: toText(result.parsed) }],
      structuredContent: result
    };
  }
);

server.registerTool(
  "tebra_soap_get_charges",
  {
    title: "Get Charges",
    description: "Get charges for a practice with date filters.",
    inputSchema: {
      practice_name: z.string().min(1),
      from_created_date: z.string().optional().describe("YYYY-MM-DD"),
      to_created_date: z.string().optional().describe("YYYY-MM-DD"),
      from_last_modified_date: z.string().optional().describe("YYYY-MM-DD"),
      to_last_modified_date: z.string().optional().describe("YYYY-MM-DD"),
      patient_id: z.number().int().positive().optional()
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (input) => {
    const result = await soap.callOperation("GetCharges", {
      fields: {
        PracticeName: input.practice_name,
        FromCreatedDate: input.from_created_date,
        ToCreatedDate: input.to_created_date,
        FromLastModifiedDate: input.from_last_modified_date,
        ToLastModifiedDate: input.to_last_modified_date,
        PatientID: input.patient_id
      }
    });
    return {
      content: [{ type: "text", text: toText(result.parsed) }],
      structuredContent: result
    };
  }
);

server.registerTool(
  "tebra_soap_get_payments",
  {
    title: "Get Payments",
    description: "Get payments for a practice with optional date filters.",
    inputSchema: {
      practice_name: z.string().min(1),
      from_created_date: z.string().optional().describe("YYYY-MM-DD"),
      to_created_date: z.string().optional().describe("YYYY-MM-DD"),
      from_last_modified_date: z.string().optional().describe("YYYY-MM-DD"),
      to_last_modified_date: z.string().optional().describe("YYYY-MM-DD"),
      patient_id: z.number().int().positive().optional()
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (input) => {
    const result = await soap.callOperation("GetPayments", {
      fields: {
        PracticeName: input.practice_name,
        FromCreatedDate: input.from_created_date,
        ToCreatedDate: input.to_created_date,
        FromLastModifiedDate: input.from_last_modified_date,
        ToLastModifiedDate: input.to_last_modified_date,
        PatientID: input.patient_id
      }
    });
    return {
      content: [{ type: "text", text: toText(result.parsed) }],
      structuredContent: result
    };
  }
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  process.stderr.write(
    `Tebra SOAP MCP server failed to start: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`
  );
  process.exit(1);
});
