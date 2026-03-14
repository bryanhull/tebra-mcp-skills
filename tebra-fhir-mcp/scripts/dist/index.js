import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from "./config.js";
import { TebraClient } from "./tebra-client.js";
function toText(value) {
    return JSON.stringify(value, null, 2);
}
const config = loadConfig();
const tebra = new TebraClient(config);
const server = new McpServer({
    name: "tebra-fhir-mcp-server",
    version: "0.1.0"
});
server.registerTool("tebra_health_check", {
    title: "Tebra Health Check",
    description: "Validate OAuth credentials and read FHIR capability statement.",
    inputSchema: {},
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async () => {
    const metadata = await tebra.searchResource("metadata");
    return {
        content: [{ type: "text", text: toText(metadata) }],
        structuredContent: { ok: true, metadata }
    };
});
server.registerTool("tebra_search_patients", {
    title: "Search Patients",
    description: "Search patients by id, identifier, name, birthdate, or gender using Tebra FHIR Patient endpoint.",
    inputSchema: {
        id: z.string().optional().describe("FHIR patient id"),
        identifier: z.string().optional().describe("Identifier such as MPI"),
        name: z.string().optional().describe("Any part of patient name"),
        birthdate: z.string().optional().describe("Birthdate (YYYY-MM-DD)"),
        gender: z.string().optional().describe("Gender"),
        count: z.number().int().min(1).max(100).optional().describe("FHIR _count limit")
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ id, identifier, name, birthdate, gender, count }) => {
    const query = {};
    if (id)
        query.id = id;
    if (identifier)
        query.identifier = identifier;
    if (name)
        query.name = name;
    if (birthdate)
        query.birthdate = birthdate;
    if (gender)
        query.gender = gender;
    if (count)
        query._count = count;
    const result = await tebra.searchResource("Patient", query);
    return {
        content: [{ type: "text", text: toText(result) }],
        structuredContent: { result }
    };
});
server.registerTool("tebra_get_patient", {
    title: "Get Patient",
    description: "Get a single patient resource by FHIR id.",
    inputSchema: {
        patient_id: z.string().min(1).describe("FHIR patient id")
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ patient_id }) => {
    const result = await tebra.getResourceById("Patient", patient_id);
    return {
        content: [{ type: "text", text: toText(result) }],
        structuredContent: { result }
    };
});
server.registerTool("tebra_search_resource", {
    title: "Search Any FHIR Resource",
    description: "Search a Tebra FHIR resource by name with optional patient and additional query params.",
    inputSchema: {
        resource: z
            .string()
            .min(1)
            .describe("FHIR resource name such as AllergyIntolerance, Condition, Observation, DiagnosticReport, Encounter"),
        patient: z.string().optional().describe("Patient id for resources that require patient filter"),
        params_json: z
            .string()
            .optional()
            .describe("Optional JSON object string of extra query parameters"),
        count: z.number().int().min(1).max(100).optional().describe("FHIR _count limit")
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ resource, patient, params_json, count }) => {
    const query = {};
    if (patient)
        query.patient = patient;
    if (count)
        query._count = count;
    if (params_json) {
        let parsed;
        try {
            parsed = JSON.parse(params_json);
        }
        catch {
            throw new Error("params_json must be valid JSON object text.");
        }
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("params_json must be a JSON object.");
        }
        for (const [key, value] of Object.entries(parsed)) {
            if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
                query[key] = value;
            }
        }
    }
    const result = await tebra.searchResource(resource, query);
    return {
        content: [{ type: "text", text: toText(result) }],
        structuredContent: { result }
    };
});
server.registerTool("tebra_patient_clinical_summary", {
    title: "Patient Clinical Summary",
    description: "Fetch a compact patient summary bundle by querying common USCDI clinical resources for one patient.",
    inputSchema: {
        patient_id: z.string().min(1).describe("FHIR patient id"),
        resources: z
            .array(z.string())
            .optional()
            .describe("Optional list of resources. Defaults to AllergyIntolerance, Condition, MedicationRequest, Observation, DiagnosticReport, Encounter, Procedure, DocumentReference."),
        count_per_resource: z.number().int().min(1).max(50).default(10)
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
    }
}, async ({ patient_id, resources, count_per_resource }) => {
    const defaults = [
        "AllergyIntolerance",
        "Condition",
        "MedicationRequest",
        "Observation",
        "DiagnosticReport",
        "Encounter",
        "Procedure",
        "DocumentReference"
    ];
    const selected = resources?.length ? resources : defaults;
    const patient = await tebra.getResourceById("Patient", patient_id);
    const summary = {
        patient,
        bundles: {}
    };
    for (const resource of selected) {
        try {
            const bundle = await tebra.searchResource(resource, { patient: patient_id, _count: count_per_resource });
            summary.bundles[resource] = bundle;
        }
        catch (error) {
            summary.bundles[resource] = {
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    return {
        content: [{ type: "text", text: toText(summary) }],
        structuredContent: summary
    };
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((error) => {
    process.stderr.write(`Tebra FHIR MCP server failed to start: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exit(1);
});
