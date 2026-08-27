import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { SWIGGY_INSTAMART_MCP_URL } from "./config.js";

interface JsonRpcSuccess<T> {
  jsonrpc: "2.0";
  id: string | number | null;
  result: T;
}

interface JsonRpcFailure {
  jsonrpc: "2.0";
  id: string | number | null;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

type JsonRpcResponse<T> = JsonRpcSuccess<T> | JsonRpcFailure;

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: unknown
  ) {
    super(message);
  }
}

function getBearerToken(authorizationHeader: string | undefined): string {
  const value = authorizationHeader?.trim();
  if (!value?.toLowerCase().startsWith("bearer ")) {
    throw new UpstreamError("Missing Swiggy bearer token", 401);
  }
  return value;
}

export async function callSwiggyMcp<T>(
  authorizationHeader: string | undefined,
  method: string,
  params: Record<string, unknown> = {}
): Promise<T> {
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

  const envelope = payload as JsonRpcResponse<T>;
  if ("error" in envelope) {
    throw new UpstreamError(envelope.error.message, response.status, envelope.error);
  }

  return envelope.result;
}

export async function listSwiggyTools(authorizationHeader: string | undefined): Promise<Tool[]> {
  const result = await callSwiggyMcp<{ tools?: Tool[] }>(authorizationHeader, "tools/list");
  return result.tools ?? [];
}

export async function callSwiggyTool(
  authorizationHeader: string | undefined,
  name: string,
  args: Record<string, unknown>
) {
  return callSwiggyMcp(authorizationHeader, "tools/call", {
    name,
    arguments: args
  });
}

function parseMcpPayload(text: string): unknown {
  if (!text.trim()) return undefined;

  if (text.startsWith("event:") || text.startsWith("data:")) {
    const dataLine = text
      .split("\n")
      .find((line) => line.startsWith("data:"));
    if (!dataLine) return undefined;
    return JSON.parse(dataLine.slice("data:".length).trim());
  }

  return JSON.parse(text);
}
