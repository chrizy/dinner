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
    <div className="min-h-screen bg-slate-950">
      <header className="sticky top-0 z-10 border-b border-slate-700/50 bg-slate-900/90 backdrop-blur-xl shadow-lg shadow-black/10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight text-white">
            Who&apos;s for Dinner
          </h1>
          <nav className="flex items-center gap-2">
            <a
              href="/"
              className="rounded-full px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
            >
              Dinners
            </a>
            <a
              href="/meals"
              className="rounded-full px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
            >
              Meals
            </a>
          </nav>
        </div>
      </header>
      <main className="max-w-4xl mx-auto p-4 md:p-6">
        <Outlet />
      </main>
      <footer className="max-w-4xl mx-auto px-4 pb-6 flex justify-end">
        <Form method="post" action="/logout">
          <button
            type="submit"
            className="rounded-full px-4 py-2 text-sm font-semibold text-slate-400 hover:bg-slate-700 hover:text-slate-200 border border-slate-700/70 bg-slate-900/70 backdrop-blur-sm transition-colors"
          >
            Log out
          </button>
        </Form>
      </footer>
    </div>
  );
}
