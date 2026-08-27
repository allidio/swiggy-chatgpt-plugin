import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import cors from "cors";
import type { Request, Response } from "express";
import { MCP_PATH, OAUTH_RESOURCE, PORT, SWIGGY_AUTH_ISSUER } from "./config.js";
import { createServer } from "./server.js";

function absoluteMetadataUrl(req: Request) {
  const configured = process.env.PUBLIC_PROTECTED_RESOURCE_METADATA_URL;
  if (configured?.startsWith("https://")) return configured;
  const proto = req.get("x-forwarded-proto") ?? req.protocol;
  return `${proto}://${req.get("host")}/.well-known/oauth-protected-resource`;
}

function hasBearerToken(req: Request) {
  return req.get("authorization")?.toLowerCase().startsWith("bearer ");
}

async function handleMcpRequest(req: Request, res: Response, create: () => Promise<McpServer>) {
  const server = await create();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined
  });

  res.on("close", () => {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}

async function main() {
  const app = createMcpExpressApp({ host: "0.0.0.0" });
  app.use(
    cors({
      origin: "*",
      exposedHeaders: ["Mcp-Session-Id", "WWW-Authenticate"],
      allowedHeaders: ["Content-Type", "Authorization", "Mcp-Session-Id", "mcp-protocol-version"]
    })
  );

  app.get("/", (_req, res) => {
    res.type("text/plain").send("Swiggy Instamart ChatGPT Apps SDK facade");
  });

  app.get("/.well-known/oauth-protected-resource", (req, res) => {
    res.json({
      resource: OAUTH_RESOURCE,
      authorization_servers: [SWIGGY_AUTH_ISSUER],
      scopes_supported: ["mcp:tools", "mcp:resources", "mcp:prompts"],
      bearer_methods_supported: ["header"],
      resource_documentation: "https://mcp.swiggy.com/builders/docs/reference/instamart/index.md"
    });
  });

  app.get("/.well-known/oauth-authorization-server", async (_req, res) => {
    const response = await fetch("https://mcp.swiggy.com/.well-known/oauth-authorization-server");
    res.status(response.status);
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== "content-encoding") res.setHeader(key, value);
    });
    res.send(await response.text());
  });

  app.all(MCP_PATH, async (req: Request, res: Response) => {
    if (!hasBearerToken(req)) {
      res
        .status(401)
        .setHeader(
          "WWW-Authenticate",
          `Bearer realm="mcp", resource_metadata="${absoluteMetadataUrl(req)}", scope="mcp:tools"`
        )
        .json({ error: "Authentication required" });
      return;
    }

    try {
      await handleMcpRequest(req, res, () => createServer(req.get("authorization")));
    } catch (error) {
      console.error("MCP request failed:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null
        });
      }
    }
  });

  app.listen(PORT, (error) => {
    if (error) {
      console.error("Failed to start server:", error);
      process.exit(1);
    }
    console.log(`MCP server listening on http://localhost:${PORT}${MCP_PATH}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
