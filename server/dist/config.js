export const MCP_PATH = process.env.MCP_PATH ?? "/mcp";
export const PORT = Number(process.env.PORT ?? 3001);
export const SWIGGY_INSTAMART_MCP_URL = process.env.SWIGGY_INSTAMART_MCP_URL ?? "https://mcp.swiggy.com/im";
export const SWIGGY_AUTH_ISSUER = process.env.SWIGGY_AUTH_ISSUER ?? "https://mcp.swiggy.com/auth";
export const OAUTH_RESOURCE = process.env.OAUTH_RESOURCE ?? SWIGGY_INSTAMART_MCP_URL;
export const WIDGET_RESOURCE_URI = "ui://swiggy-instamart/widget.html";
//# sourceMappingURL=config.js.map