import { URL } from "node:url";
export class TebraClient {
    config;
    accessToken = null;
    tokenExpiresAtMs = 0;
    constructor(config) {
        this.config = config;
    }
    async fetchJson(url, init) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
        try {
            const response = await fetch(url, { ...init, signal: controller.signal });
            const bodyText = await response.text();
            let body = null;
            try {
                body = bodyText ? JSON.parse(bodyText) : null;
            }
            catch {
                body = bodyText;
            }
            if (!response.ok) {
                const details = typeof body === "string" ? body : body ? JSON.stringify(body) : "No error body";
                throw new Error(`HTTP ${response.status} ${response.statusText} from ${url}: ${details}`);
            }
            return body;
        }
        finally {
            clearTimeout(timeout);
        }
    }
    isTokenValid() {
        if (!this.accessToken)
            return false;
        return Date.now() < this.tokenExpiresAtMs - 60_000;
    }
    async requestToken() {
        const params = new URLSearchParams();
        params.set("grant_type", "client_credentials");
        if (this.config.scope)
            params.set("scope", this.config.scope);
        if (this.config.audience)
            params.set("audience", this.config.audience);
        const basicAuth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString("base64");
        const token = await this.fetchJson(this.config.tokenUrl, {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: `Basic ${basicAuth}`
            },
            body: params.toString()
        });
        if (!token.access_token) {
            throw new Error("Token response did not include access_token.");
        }
        this.accessToken = token.access_token;
        const expiresIn = token.expires_in ?? 3600;
        this.tokenExpiresAtMs = Date.now() + expiresIn * 1000;
    }
    async getAccessToken() {
        if (!this.isTokenValid()) {
            await this.requestToken();
        }
        return this.accessToken;
    }
    buildFhirUrl(resource, query) {
        const cleanBase = this.config.fhirBaseUrl.replace(/\/+$/, "");
        const cleanResource = resource.replace(/^\/+/, "");
        const url = new URL(`${cleanBase}/${cleanResource}`);
        if (query) {
            for (const [key, value] of Object.entries(query)) {
                if (value === undefined || value === null || value === "")
                    continue;
                url.searchParams.set(key, String(value));
            }
        }
        return url.toString();
    }
    async searchResource(resource, query) {
        const accessToken = await this.getAccessToken();
        const url = this.buildFhirUrl(resource, query);
        return this.fetchJson(url, {
            method: "GET",
            headers: {
                Accept: "application/fhir+json, application/json",
                Authorization: `Bearer ${accessToken}`
            }
        });
    }
    async getResourceById(resource, id) {
        const accessToken = await this.getAccessToken();
        const cleanBase = this.config.fhirBaseUrl.replace(/\/+$/, "");
        const cleanResource = resource.replace(/^\/+/, "");
        const cleanId = id.replace(/^\/+/, "");
        const url = `${cleanBase}/${cleanResource}/${cleanId}`;
        return this.fetchJson(url, {
            method: "GET",
            headers: {
                Accept: "application/fhir+json, application/json",
                Authorization: `Bearer ${accessToken}`
            }
        });
    }
}
