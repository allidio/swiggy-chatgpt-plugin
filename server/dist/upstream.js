import { SWIGGY_INSTAMART_MCP_URL } from "./config.js";
export class UpstreamError extends Error {
    status;
    body;
    constructor(message, status, body) {
        super(message);
        this.status = status;
        this.body = body;
    }
}
function getBearerToken(authorizationHeader) {
    const value = authorizationHeader?.trim();
    if (!value?.toLowerCase().startsWith("bearer ")) {
        throw new UpstreamError("Missing Swiggy bearer token", 401);
    }
    return value;
}
export async function callSwiggyMcp(authorizationHeader, method, params = {}) {
    const authorization = getBearerToken(authorizationHeader);
    const response = await fetch(SWIGGY_INSTAMART_MCP_URL, {
        method: "POST",
        headers: {
            authorization,
            "content-type": "application/json",
            accept: "application/json, text/event-stream"
        },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            method,
            params
        })
    });
    const text = await response.text();
    const payload = parseMcpPayload(text);
    if (!response.ok) {
        throw new UpstreamError(`Swiggy MCP returned HTTP ${response.status}`, response.status, payload ?? text);
    }
    if (!payload || typeof payload !== "object") {
        throw new UpstreamError("Swiggy MCP returned an empty or unsupported response", response.status, text);
    }
    const envelope = payload;
    if ("error" in envelope) {
        throw new UpstreamError(envelope.error.message, response.status, envelope.error);
    }
    return envelope.result;
}
export async function listSwiggyTools(authorizationHeader) {
    const result = await callSwiggyMcp(authorizationHeader, "tools/list");
    return result.tools ?? [];
}
export async function callSwiggyTool(authorizationHeader, name, args) {
    return callSwiggyMcp(authorizationHeader, "tools/call", {
        name,
        arguments: args
    });
}
function parseMcpPayload(text) {
    if (!text.trim())
        return undefined;
    if (text.startsWith("event:") || text.startsWith("data:")) {
        const dataLine = text
            .split("\n")
            .find((line) => line.startsWith("data:"));
        if (!dataLine)
            return undefined;
        return JSON.parse(dataLine.slice("data:".length).trim());
    }
    return JSON.parse(text);
}
//# sourceMappingURL=upstream.js.map