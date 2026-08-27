import type { Tool } from "@modelcontextprotocol/sdk/types.js";
export declare class UpstreamError extends Error {
    readonly status?: number | undefined;
    readonly body?: unknown | undefined;
    constructor(message: string, status?: number | undefined, body?: unknown | undefined);
}
export declare function callSwiggyMcp<T>(authorizationHeader: string | undefined, method: string, params?: Record<string, unknown>): Promise<T>;
export declare function listSwiggyTools(authorizationHeader: string | undefined): Promise<Tool[]>;
export declare function callSwiggyTool(authorizationHeader: string | undefined, name: string, args: Record<string, unknown>): Promise<unknown>;
