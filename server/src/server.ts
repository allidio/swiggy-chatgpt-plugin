import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ReadResourceResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs/promises";
import path from "node:path";
import { WIDGET_RESOURCE_URI } from "./config.js";
import { mergeToolDescription, toErrorToolResult, toToolResult } from "./normalize.js";
import { genericOutputSchema, instamartTools } from "./swiggySchemas.js";
import { callSwiggyTool, listSwiggyTools } from "./upstream.js";

const DIST_DIR = import.meta.filename.endsWith(".ts")
  ? path.resolve(import.meta.dirname, "..", "dist", "widget")
  : path.resolve(import.meta.dirname, "widget");

const WIDGET_CSP = {
  connectDomains: [],
  resourceDomains: ["https://media-assets.swiggy.com", "https://*.swiggy.com"]
};

export async function createServer(authorizationHeader?: string): Promise<McpServer> {
  const server = new McpServer({
    name: "Swiggy Instamart Apps SDK Facade",
    version: "0.1.0"
  });

  const upstreamTools = await tryListUpstreamTools(authorizationHeader);
  const upstreamByName = new Map(upstreamTools.map((tool) => [tool.name, tool]));

  for (const tool of instamartTools) {
    const upstream = upstreamByName.get(tool.name);
    registerAppTool(
      server,
      tool.name,
      {
        title: upstream?.title || tool.title,
        description: mergeToolDescription(tool, upstream),
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema ?? genericOutputSchema,
        annotations: {
          readOnlyHint: tool.readOnly,
          destructiveHint: Boolean(tool.destructive),
          idempotentHint: tool.name !== "checkout",
          openWorldHint: true
        },
        _meta: {
          ui: { resourceUri: WIDGET_RESOURCE_URI },
          "openai/toolInvocation/invoking": `Calling Swiggy Instamart ${tool.title}...`,
          "openai/toolInvocation/invoked": `Swiggy Instamart ${tool.title} finished`
        }
      },
      async (args): Promise<CallToolResult> => {
        try {
          const result =
            tool.name === "search_products_bulk"
              ? await callBulkSearch(authorizationHeader, (args ?? {}) as Record<string, unknown>)
              : await callSwiggyTool(
                  authorizationHeader,
                  tool.name,
                  (args ?? {}) as Record<string, unknown>
                );
          return toToolResult(tool, result);
        } catch (error) {
          return toErrorToolResult(tool, error);
        }
      }
    );
  }

  registerAppResource(
    server,
    "Swiggy Instamart Widget",
    WIDGET_RESOURCE_URI,
    {
      mimeType: RESOURCE_MIME_TYPE,
      _meta: {
        ui: {
          prefersBorder: true,
          csp: WIDGET_CSP
        },
        "openai/widgetDescription":
          "An interactive Swiggy Instamart shopping surface for addresses, products, cart review, checkout, and tracking."
      }
    },
    async (): Promise<ReadResourceResult> => {
      const html = await fs.readFile(path.join(DIST_DIR, "mcp-app.html"), "utf-8");
      return {
        contents: [
          {
            uri: WIDGET_RESOURCE_URI,
            mimeType: RESOURCE_MIME_TYPE,
            text: html,
            _meta: {
              ui: {
                prefersBorder: true,
                csp: WIDGET_CSP
              },
              "openai/widgetDescription":
                "An interactive Swiggy Instamart shopping surface for addresses, products, cart review, checkout, and tracking."
            }
          }
        ]
      };
    }
  );

  return server;
}

async function tryListUpstreamTools(authorizationHeader?: string): Promise<Tool[]> {
  if (!authorizationHeader) return [];
  try {
    return await listSwiggyTools(authorizationHeader);
  } catch (error) {
    console.warn("Falling back to documented Instamart schemas; upstream tools/list failed.", error);
    return [];
  }
}

async function callBulkSearch(authorizationHeader: string | undefined, args: Record<string, unknown>) {
  const addressId = String(args.addressId ?? "").trim();
  const offset = typeof args.offset === "number" ? args.offset : undefined;
  const queries = String(args.queries ?? "")
    .split(",")
    .map((query) => query.trim())
    .filter(Boolean);

  if (!addressId) {
    throw new Error("addressId is required for search_products_bulk");
  }

  if (!queries.length) {
    throw new Error("queries must include at least one comma-separated keyword");
  }

  const groups = [];
  for (const query of queries) {
    try {
      const result = await callSwiggyTool(authorizationHeader, "search_products", {
        addressId,
        query,
        ...(offset === undefined ? {} : { offset })
      });
      const data = extractToolData(result);
      const products = extractProducts(data);
      groups.push({
        query,
        success: true,
        products,
        productCount: products.length,
        nextOffset: readField(data, "nextOffset"),
        message: extractToolMessage(result)
      });
    } catch (error) {
      groups.push({
        query,
        success: false,
        error: error instanceof Error ? error.message : "Unknown search_products error"
      });
    }
  }

  const failedCount = groups.filter((group) => !group.success).length;
  return {
    structuredContent: {
      addressId,
      queries,
      groups,
      totalQueries: queries.length,
      failedCount
    },
    content: [
      {
        type: "text",
        text:
          failedCount > 0
            ? `Searched ${queries.length} keywords. ${failedCount} search${failedCount === 1 ? "" : "es"} failed.`
            : `Searched ${queries.length} keywords and grouped the results.`
      }
    ]
  };
}

function extractToolData(result: unknown): unknown {
  if (!result || typeof result !== "object") return result;
  if ("structuredContent" in result) return (result as { structuredContent: unknown }).structuredContent;
  if ("data" in result) return (result as { data: unknown }).data;
  return result;
}

function extractProducts(data: unknown): unknown[] {
  if (!data || typeof data !== "object") return [];
  for (const key of ["products", "items", "results"]) {
    const value = (data as Record<string, unknown>)[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function extractToolMessage(result: unknown): string | undefined {
  if (!result || typeof result !== "object") return undefined;
  const content = (result as { content?: Array<{ type?: string; text?: unknown }> }).content;
  const text = content?.find((item) => item.type === "text" && typeof item.text === "string")?.text;
  if (typeof text !== "string") return undefined;
  return text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("DISPLAY INSTRUCTIONS") && !line.startsWith("IMPORTANT"));
}

function readField(data: unknown, key: string): unknown {
  if (!data || typeof data !== "object") return undefined;
  return (data as Record<string, unknown>)[key];
}
