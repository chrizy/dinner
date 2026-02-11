import { Form, Outlet, redirect } from "react-router";
import type { Route } from "./+types/_layout";
import { getSessionTokenFromRequest, validateSession } from "~/lib/auth.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const token = getSessionTokenFromRequest(request);
  if (!token || !(await validateSession(env.DB, token))) {
    throw redirect("/login");
  }
  return {};
}

export default function Layout(_props: Route.ComponentProps) {
  return (
    <div className="min-h-screen bg-amber-50 dark:bg-stone-950">
      <header className="sticky top-0 z-10 border-b border-amber-200/60 dark:border-amber-800/60 bg-amber-100/80 dark:bg-stone-900/80 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
            Who&apos;s for Dinner
          </h1>
          <nav className="flex items-center gap-2">
            <a
              href="/"
              className="px-3 py-1.5 rounded-lg text-amber-800 dark:text-amber-200 hover:bg-amber-200/50 dark:hover:bg-stone-700"
            >
              Dinners
            </a>
            <a
              href="/meals"
              className="px-3 py-1.5 rounded-lg text-amber-800 dark:text-amber-200 hover:bg-amber-200/50 dark:hover:bg-stone-700"
            >
              Meals
            </a>
            <Form method="post" action="/logout">
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg text-stone-600 dark:text-stone-400 hover:bg-amber-200/50 dark:hover:bg-stone-700 text-sm"
              >
                Log out
              </button>
            </Form>
          </nav>
        </div>
      </header>
      <main className="max-w-4xl mx-auto p-4">
        <Outlet />
      </main>
    </div>
  );
}
