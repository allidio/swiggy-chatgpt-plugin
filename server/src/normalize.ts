import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import { WIDGET_RESOURCE_URI } from "./config.js";
import type { ToolDefinition } from "./swiggySchemas.js";

export interface InstamartSnapshot {
  service: "swiggy-instamart";
  toolName: string;
  stage: ToolDefinition["stage"];
  view: "addresses" | "products" | "goToItems" | "cart" | "checkout" | "orders" | "tracking" | "support" | "generic";
  success: boolean;
  message?: string;
  data?: unknown;
  stateVersion: number;
}

let stateVersion = 0;

export function mergeToolDescription(local: ToolDefinition, upstream?: Tool): string {
  return upstream?.description || local.description;
}

export function toToolResult(tool: ToolDefinition, upstreamResult: unknown): CallToolResult {
  const payload = unwrapSwiggyPayload(upstreamResult);
  const success = payloadSuccess(payload);
  const snapshot: InstamartSnapshot = {
    service: "swiggy-instamart",
    toolName: tool.name,
    stage: tool.stage,
    view: viewForTool(tool.name),
    success,
    message: payloadMessage(payload),
    data: payloadData(payload),
    stateVersion: ++stateVersion
  };

  return {
    content: [
      {
        type: "text",
        text: summarizeSnapshot(snapshot)
      }
    ],
    structuredContent: snapshot as unknown as Record<string, unknown>,
    _meta: {
      upstream: payload,
      ui: { resourceUri: WIDGET_RESOURCE_URI },
      "openai/outputTemplate": WIDGET_RESOURCE_URI
    }
  };
}

export function toErrorToolResult(tool: ToolDefinition, error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : "Unknown Swiggy MCP error";
  const snapshot: InstamartSnapshot = {
    service: "swiggy-instamart",
    toolName: tool.name,
    stage: tool.stage,
    view: viewForTool(tool.name),
    success: false,
    message,
    stateVersion: ++stateVersion
  };

  return {
    isError: true,
    content: [{ type: "text", text: message }],
    structuredContent: snapshot as unknown as Record<string, unknown>,
    _meta: {
      error,
      ui: { resourceUri: WIDGET_RESOURCE_URI },
      "openai/outputTemplate": WIDGET_RESOURCE_URI
    }
  };
}

function unwrapSwiggyPayload(result: unknown): unknown {
  if (result && typeof result === "object" && "content" in result) {
    return result;
  }
  return result;
}

function payloadSuccess(payload: unknown): boolean {
  if (payload && typeof payload === "object" && "success" in payload) {
    return Boolean((payload as { success: unknown }).success);
  }
  if (payload && typeof payload === "object" && "isError" in payload) {
    return !Boolean((payload as { isError: unknown }).isError);
  }
  return true;
}

function payloadMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const candidate = payload as {
    message?: unknown;
    error?: { message?: unknown };
    content?: Array<{ type?: string; text?: unknown }>;
  };
  if (typeof candidate.message === "string") return candidate.message;
  if (typeof candidate.error?.message === "string") return candidate.error.message;
  const textContent = candidate.content?.find((item) => item.type === "text" && typeof item.text === "string");
  if (typeof textContent?.text === "string") return firstUsefulLine(textContent.text);
  return undefined;
}

function payloadData(payload: unknown): unknown {
  if (payload && typeof payload === "object" && "structuredContent" in payload) {
    return (payload as { structuredContent: unknown }).structuredContent;
  }
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: unknown }).data;
  }
  return payload;
}

function firstUsefulLine(text: string): string | undefined {
  return text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("⚠️"));
}

function viewForTool(toolName: string): InstamartSnapshot["view"] {
  switch (toolName) {
    case "get_addresses":
    case "create_address":
    case "delete_address":
      return "addresses";
    case "search_products":
    case "search_products_bulk":
      return "products";
    case "your_go_to_items":
      return "goToItems";
    case "get_cart":
    case "update_cart":
    case "clear_cart":
      return "cart";
    case "checkout":
      return "checkout";
    case "get_orders":
    case "get_order_details":
      return "orders";
    case "track_order":
      return "tracking";
    case "report_error":
      return "support";
    default:
      return "generic";
  }
}

function summarizeSnapshot(snapshot: InstamartSnapshot): string {
  const status = snapshot.success ? "succeeded" : "failed";
  return `Swiggy Instamart ${snapshot.toolName} ${status}.${snapshot.message ? ` ${snapshot.message}` : ""}`;
}
