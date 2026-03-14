import { XMLParser } from "fast-xml-parser";
import type { TebraSoapConfig } from "./config.js";

const API_NS = "http://www.kareo.com/api/schemas/";
const SOAP_ENV_NS = "http://schemas.xmlsoap.org/soap/envelope/";

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: true,
  trimValues: true
});

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function valueToXml(value: string | number | boolean): string {
  return escapeXml(String(value));
}

function mapToXmlFields(fields: Record<string, string | number | boolean | undefined>): string {
  const chunks: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === "") continue;
    chunks.push(`<api:${key}>${valueToXml(value)}</api:${key}>`);
  }
  return chunks.join("");
}

export class TebraSoapClient {
  constructor(private readonly config: TebraSoapConfig) {}

  private buildRequestHeaderXml(): string {
    return [
      "<api:RequestHeader>",
      `<api:ClientVersion>${valueToXml(this.config.clientVersion)}</api:ClientVersion>`,
      `<api:CustomerKey>${valueToXml(this.config.customerKey)}</api:CustomerKey>`,
      `<api:Password>${valueToXml(this.config.password)}</api:Password>`,
      `<api:User>${valueToXml(this.config.user)}</api:User>`,
      "</api:RequestHeader>"
    ].join("");
  }

  private buildInlineAuthXml(): string {
    return [
      `<api:CustomerKey>${valueToXml(this.config.customerKey)}</api:CustomerKey>`,
      `<api:Password>${valueToXml(this.config.password)}</api:Password>`,
      `<api:User>${valueToXml(this.config.user)}</api:User>`
    ].join("");
  }

  private buildEnvelope(
    operation: string,
    requestElement: string,
    extraRequestXml: string,
    authMode: "request_header" | "inline_auth"
  ): string {
    const authXml =
      authMode === "inline_auth" ? this.buildInlineAuthXml() : this.buildRequestHeaderXml();
    return [
      `<?xml version="1.0" encoding="utf-8"?>`,
      `<soapenv:Envelope xmlns:soapenv="${SOAP_ENV_NS}" xmlns:api="${API_NS}">`,
      "<soapenv:Header/>",
      "<soapenv:Body>",
      `<api:${operation}>`,
      `<api:${requestElement}>`,
      authXml,
      extraRequestXml,
      `</api:${requestElement}>`,
      `</api:${operation}>`,
      "</soapenv:Body>",
      "</soapenv:Envelope>"
    ].join("");
  }

  async callOperation(
    operation: string,
    options?: {
      requestElement?: string;
      extraRequestXml?: string;
      fields?: Record<string, string | number | boolean | undefined>;
      authMode?: "request_header" | "inline_auth";
    }
  ): Promise<{ requestXml: string; rawXml: string; parsed: unknown }> {
    const requestElement = options?.requestElement ?? `${operation}Req`;
    const authMode = options?.authMode ?? "request_header";
    const fromFields = options?.fields ? mapToXmlFields(options.fields) : "";
    const extraRequestXml = `${fromFields}${options?.extraRequestXml ?? ""}`;
    const soapAction = `${API_NS}KareoServices/${operation}`;
    const envelope = this.buildEnvelope(operation, requestElement, extraRequestXml, authMode);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(this.config.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: soapAction,
          Accept: "text/xml, application/soap+xml"
        },
        body: envelope,
        signal: controller.signal
      });

      const rawXml = await response.text();
      const parsed = parser.parse(rawXml);

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status} ${response.statusText}. SOAP response: ${rawXml.slice(0, 4000)}`
        );
      }

      return { requestXml: envelope, rawXml, parsed };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function buildSimpleFieldsXml(fields: Record<string, string | number | boolean | undefined>): string {
  return mapToXmlFields(fields);
}
