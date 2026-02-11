import { redirect } from "react-router";
import type { Route } from "./+types/logout";
import {
  getSessionTokenFromRequest,
  destroySession,
  sessionCookieHeader,
} from "~/lib/auth.server";

export function loader() {
  return redirect("/");
}

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  const env = context.cloudflare.env;
  const token = getSessionTokenFromRequest(request);
  if (token) {
    await destroySession(env.DB, token);
  }
  const secure = new URL(request.url).protocol === "https:";
  const headers = new Headers();
  headers.append("Set-Cookie", sessionCookieHeader("", "", "clear", { secure }));
  throw redirect("/login", { headers });
}

export default function Logout(_props: Route.ComponentProps) {
  return null;
}
