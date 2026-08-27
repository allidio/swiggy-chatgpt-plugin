# Swiggy Instamart ChatGPT App

Interactive-decoupled ChatGPT Apps SDK facade for Swiggy Instamart.

## Architecture

- `server/`: Node.js MCP facade exposed at `/mcp`.
- `web/`: React MCP Apps widget bundled into a single HTML resource.
- Upstream: `https://mcp.swiggy.com/im`.

The facade forwards ChatGPT's Swiggy OAuth bearer token to the upstream Instamart MCP server, fetches upstream `tools/list` when a token is present, registers the documented Instamart tool surface, and attaches `ui://swiggy-instamart/widget.html` to each UI-capable tool.

## Run

```bash
npm run build
npm run start
```

For local iteration:

```bash
npm run dev
```

The MCP endpoint is:

```text
http://localhost:3001/mcp
```

Expose it with an HTTPS tunnel for ChatGPT Developer Mode, then add the tunneled URL with `/mcp`.

## OAuth

The app advertises Swiggy as the authorization server and defaults the OAuth resource to `https://mcp.swiggy.com/im` so the token can be forwarded upstream.

Override if needed:

```bash
OAUTH_RESOURCE=https://mcp.swiggy.com/im
PUBLIC_PROTECTED_RESOURCE_METADATA_URL=https://your-domain.example/.well-known/oauth-protected-resource
```

## Safety Notes

- The widget never receives the bearer token.
- `checkout` and `delete_address` are marked as confirmation-sensitive.
- `update_cart` replaces the full cart; callers must include every intended item.
- If upstream `tools/list` fails, the app falls back to the documented Instamart schemas in `server/src/swiggySchemas.ts`.
# swiggy-chatgpt-plugin
