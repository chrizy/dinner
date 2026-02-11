import { Form, redirect } from "react-router";
import type { Route } from "./+types/login";
import { getDb } from "~/lib/db.server";
import {
  getSessionTokenFromRequest,
  validateSession,
  createSession,
  sessionCookieHeader,
} from "~/lib/auth.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const token = getSessionTokenFromRequest(request);
  if (token && (await validateSession(env.DB, token))) {
    throw redirect("/");
  }
  return {};
}

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") return { error: "Method not allowed" };
  const env = context.cloudflare.env;
  const formData = await request.formData();
  const pin = formData.get("pin");
  const pinStr = typeof pin === "string" ? pin.trim() : "";
  const expectedPin = String(env.PIN ?? "").trim();
  if (pinStr !== expectedPin) {
    return { error: "Wrong PIN", status: 401 };
  }
  const db = getDb(env);
  const { token, expiresAt } = await createSession(db);
  const headers = new Headers();
  headers.append(
    "Set-Cookie",
    sessionCookieHeader(token, expiresAt, "set")
  );
  throw redirect("/", { headers });
}

export default function Login({ actionData }: Route.ComponentProps) {
  return (
    <main
      className="min-h-screen flex flex-col items-center pt-[env(safe-area-inset-top)] pt-8 sm:pt-12 px-4 pb-6 bg-slate-950 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url(/login1.jpg)" }}
    >
      <div
        className="fixed inset-0 bg-slate-950/40 pointer-events-none"
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-[200px] rounded-2xl border border-white/20 bg-black/30 backdrop-blur-md px-4 py-3 shadow-xl">
        <Form method="post" className="space-y-2">
          <input
            id="pin"
            name="pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            placeholder="000000"
            aria-label="PIN"
            className="w-full px-3 py-2 text-center text-lg tracking-[0.3em] rounded-xl border border-white/30 bg-white/10 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          />
          {actionData?.error && (
            <p className="text-xs font-medium text-red-300 text-center">
              {actionData.error}
            </p>
          )}
          <button
            type="submit"
            className="w-full py-2 rounded-xl bg-amber-500/90 text-slate-950 font-bold text-sm hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
          >
            Log in
          </button>
        </Form>
      </div>
    </main>
  );
}
