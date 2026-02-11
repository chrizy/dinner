import type { Route } from "./+types/api.meal-photo.$key";
import {
  getSessionTokenFromRequest,
  validateSession,
} from "~/lib/auth.server";

// Only allow alphanumeric, hyphen, underscore, and one extension (e.g. .webp)
const SAFE_KEY = /^[a-zA-Z0-9_.-]+$/;

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const key = params.key;
  if (!key || !SAFE_KEY.test(key)) {
    return new Response("Invalid key", { status: 400 });
  }
  const env = context.cloudflare.env;
  const token = getSessionTokenFromRequest(request);
  if (!token || !(await validateSession(env.DB, token))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const object = await env.MEAL_PHOTOS.get(key);
  if (!object) {
    return new Response("Not found", { status: 404 });
  }
  const contentType = object.httpMetadata?.contentType ?? "image/jpeg";
  return new Response(object.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
