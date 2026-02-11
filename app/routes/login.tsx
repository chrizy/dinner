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
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-amber-50 dark:bg-stone-950">
      <div className="w-full max-w-xs space-y-6">
        <h1 className="text-2xl font-semibold text-center text-amber-900 dark:text-amber-100">
          Who&apos;s for Dinner
        </h1>
        <Form method="post" className="space-y-4">
          <label htmlFor="pin" className="block text-sm font-medium text-stone-700 dark:text-stone-300">
            Enter PIN
          </label>
          <input
            id="pin"
            name="pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            placeholder="000000"
            className="w-full px-4 py-3 text-center text-lg tracking-widest rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          {actionData?.error && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {actionData.error}
            </p>
          )}
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-amber-600 text-white font-medium hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
          >
            Log in
          </button>
        </Form>
      </div>
    </main>
  );
}
