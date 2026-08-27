import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
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
export declare function mergeToolDescription(local: ToolDefinition, upstream?: Tool): string;
export declare function toToolResult(tool: ToolDefinition, upstreamResult: unknown): CallToolResult;
export declare function toErrorToolResult(tool: ToolDefinition, error: unknown): CallToolResult;
