import { createRequestHandler } from "react-router";

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}

/** Require Accept-Language to include en-GB; otherwise return 406 and no UI. */
function acceptsEnGB(request: Request): boolean {
  const raw = request.headers.get("Accept-Language");
  if (!raw) return false;
  const parts = raw.split(",").map((p) => p.split(";")[0].trim().toLowerCase());
  return parts.some((lang) => lang === "en-gb" || lang.startsWith("en-gb-"));
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
);

export default {
  async fetch(request, env, ctx) {
    if (!acceptsEnGB(request)) {
      return new Response("Not accepted", {
        status: 406,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    return requestHandler(request, {
      cloudflare: { env, ctx },
    });
  },
} satisfies ExportedHandler<Env>;
