import { Form, useSearchParams, useFetcher } from "react-router";
import { useEffect, useRef, useState } from "react";
import type { Route } from "./+types/_index";
import {
  getDb,
  getMeals,
  getDinnersWithDetails,
  ensureDinner,
  setDinnerMeal,
  setAttendance,
} from "~/lib/db.server";
import type { Dinner, Meal, Member } from "~/lib/types";
import { MEMBERS } from "~/lib/types";

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

function getDatesForWeek(weekStart: string): string[] {
  const start = new Date(weekStart + "T12:00:00");
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Upcoming Dinners | Who's for Dinner" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const db = getDb(context.cloudflare.env);
  const url = new URL(request.url);
  const weekParam = url.searchParams.get("week");
  const today = new Date().toISOString().slice(0, 10);
  const weekStart =
    weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)
      ? weekParam
      : today;
  const dates = getDatesForWeek(weekStart);

  for (const date of dates) {
    await ensureDinner(db, date);
  }
  const dinners = await getDinnersWithDetails(db, dates);
  const meals = await getMeals(db);

  return { weekStart, dates, dinners, meals };
}

export async function action({ request, context }: Route.ActionArgs) {
  const db = getDb(context.cloudflare.env);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "setMeal") {
    const date = formData.get("date");
    const mealIdRaw = formData.get("meal_id");
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { error: "Invalid date" };
    }
    const mealId =
      mealIdRaw === "" || mealIdRaw === "none"
        ? null
        : Number.parseInt(String(mealIdRaw), 10);
    if (mealIdRaw !== "" && mealIdRaw !== "none" && Number.isNaN(mealId)) {
      return { error: "Invalid meal" };
    }
    await setDinnerMeal(db, date, mealId);
    return { ok: true };
  }

  if (intent === "toggleAttendance") {
    const dinnerIdRaw = formData.get("dinner_id");
    const member = formData.get("member");
    const attending = formData.get("attending") === "1";
    const dinnerId = dinnerIdRaw ? Number.parseInt(String(dinnerIdRaw), 10) : Number.NaN;
    const allowedMembers: Member[] = ["Jade", "Lewis", "Mum", "Dad"];
    if (
      Number.isNaN(dinnerId) ||
      !member ||
      !allowedMembers.includes(String(member) as Member)
    ) {
      return { error: "Invalid input" };
    }
    await setAttendance(db, dinnerId, member as Member, attending);
    return { ok: true, member: member as Member, attending };
  }

  return { error: "Unknown action" };
}

const KID_MESSAGES: Record<string, string[]> = {
  jadeAdded: [
    "Jade's in! Dinner just got better.",
    "Jade's coming! The table wins.",
    "Jade said yes! 🎉",
  ],
  jadeRemoved: [
    "Jade bailed. We'll eat their share.",
    "Jade's out. More for us.",
    "Jade can't make it. Their loss.",
  ],
  lewisAdded: [
    "Lewis is coming! Table's complete.",
    "Lewis is in! Nice one.",
    "Lewis will be there! 👍",
  ],
  lewisRemoved: [
    "Lewis is out. More for us.",
    "Lewis bailed. Extra portions!",
    "Lewis can't make it. We'll save some.",
  ],
  mumAdded: [
    "Thank god, we're saved.",
    "Mum's back. Crisis averted.",
    "We're saved!",
  ],
  mumRemoved: [
    "We're screwed, who's cooking?",
    "Take away time.",
    "Who's burning dinner then?",
    "RIP dinner plans.",
    "Cereal for dinner?",
  ],
};

function pickMessage(key: keyof typeof KID_MESSAGES): string {
  const list = KID_MESSAGES[key];
  return list[Math.floor(Math.random() * list.length)];
}

export default function UpcomingDinners({ loaderData }: Route.ComponentProps) {
  const { weekStart, dinners, meals } = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();
  const currentWeek = searchParams.get("week") ?? weekStart;
  const [toast, setToast] = useState<{ message: string; id: number } | null>(null);
  const toastIdRef = useRef(0);
  const attendanceFetcher = useFetcher<typeof action>();

  useEffect(() => {
    const d = attendanceFetcher.data as
      | { ok?: boolean; member?: "Jade" | "Lewis"; attending?: boolean }
      | undefined;
    if (
      attendanceFetcher.state === "idle" &&
      d?.ok &&
      d.member &&
      typeof d.attending === "boolean"
    ) {
      const key = `${String(d.member).toLowerCase()}${d.attending ? "Added" : "Removed"}` as keyof typeof KID_MESSAGES;
      if (!(key in KID_MESSAGES)) return;
      toastIdRef.current += 1;
      setToast({ message: pickMessage(key), id: toastIdRef.current });
    }
  }, [attendanceFetcher.state, attendanceFetcher.data]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const prevWeek = () => {
    const d = new Date(currentWeek + "T12:00:00");
    d.setDate(d.getDate() - 7);
    setSearchParams({ week: d.toISOString().slice(0, 10) });
  };
  const nextWeek = () => {
    const d = new Date(currentWeek + "T12:00:00");
    d.setDate(d.getDate() + 7);
    setSearchParams({ week: d.toISOString().slice(0, 10) });
  };
  const thisWeek = () => {
    setSearchParams({ week: getWeekStart(new Date()) });
  };

  const weekLabel = (() => {
    const start = new Date(currentWeek + "T12:00:00");
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    return `${fmt(start)} – ${fmt(end)}`;
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">
          Upcoming Dinners
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prevWeek}
            className="rounded-full px-4 py-2 text-sm font-semibold bg-slate-700 text-slate-200 hover:bg-slate-600 border border-slate-600 transition-colors"
          >
            Previous week
          </button>
          <button
            type="button"
            onClick={thisWeek}
            className="rounded-full px-4 py-2 text-sm font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors"
          >
            This week
          </button>
          <button
            type="button"
            onClick={nextWeek}
            className="rounded-full px-4 py-2 text-sm font-semibold bg-slate-700 text-slate-200 hover:bg-slate-600 border border-slate-600 transition-colors"
          >
            Next week
          </button>
        </div>
      </div>
      <p className="text-slate-400 text-sm font-medium">
        Week of {weekLabel}
        {" · "}
        <a href="/meals" className="text-amber-400 hover:text-amber-300 font-semibold transition-colors">
          Add meal to list
        </a>
      </p>

      {toast && (
        <div
          key={toast.id}
          className="fixed bottom-8 left-1/2 z-20 -translate-x-1/2 min-w-[300px] max-w-[90vw] px-8 py-5 rounded-2xl bg-slate-800 border border-amber-500/40 text-white text-center text-base font-semibold shadow-2xl shadow-black/40 ring-2 ring-amber-500/30 animate-toast-in"
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {dinners.map((dinner) => (
          <DayCard
            key={dinner.id}
            dinner={dinner}
            meals={meals}
            attendanceFetcher={attendanceFetcher}
          />
        ))}
      </div>
    </div>
  );
}

function DayCard({
  dinner,
  meals,
  attendanceFetcher,
}: {
  dinner: Dinner;
  meals: Meal[];
  attendanceFetcher: ReturnType<typeof useFetcher<typeof action>>;
}) {
  const dateLabel = new Date(dinner.date + "T12:00:00").toLocaleDateString(
    "en-GB",
    { weekday: "short", day: "numeric", month: "short" }
  );
  const isToday =
    dinner.date === new Date().toISOString().slice(0, 10);

  return (
    <div
      className={`p-5 rounded-2xl border shadow-lg transition-shadow ${isToday
          ? "border-amber-500/50 bg-slate-800/90 shadow-amber-500/10 ring-2 ring-amber-500/30"
          : "border-slate-700/50 bg-slate-900/80 shadow-black/20"
        }`}
    >
      <div className="flex items-baseline justify-between mb-3">
        <div className="font-bold text-white text-sm uppercase tracking-wide">
          {dateLabel}
        </div>
        {isToday && (
          <span className="ml-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-slate-950">
            Today
          </span>
        )}
      </div>
      <div className="mb-4 w-full min-w-0">
        <Form method="post" className="block w-full">
          <input type="hidden" name="intent" value="setMeal" />
          <input type="hidden" name="date" value={dinner.date} />
          <select
            name="meal_id"
            defaultValue={dinner.meal_id ?? "none"}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-600 bg-slate-800 text-slate-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 appearance-none bg-[length:1rem_1rem] bg-[right_0.5rem_center] bg-no-repeat pr-9"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")" }}
          >
            <option value="none">No plan</option>
            {meals.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.deleted ? " (archived)" : ""}
              </option>
            ))}
          </select>
        </Form>
      </div>
      <div className="flex flex-wrap gap-2">
        {MEMBERS.map((member) => (
          <AttendeeChip
            key={member}
            member={member}
            dinnerId={dinner.id}
            attending={dinner.attendance.includes(member)}
            fetcher={attendanceFetcher}
          />
        ))}
      </div>
    </div>
  );
}

function AttendeeChip({
  member,
  dinnerId,
  attending,
  fetcher,
}: {
  member: Member;
  dinnerId: number;
  attending: boolean;
  fetcher: ReturnType<typeof useFetcher<typeof action>>;
}) {
  return (
    <fetcher.Form method="post" className="inline">
      <input type="hidden" name="intent" value="toggleAttendance" />
      <input type="hidden" name="dinner_id" value={dinnerId} />
      <input type="hidden" name="member" value={member} />
      <input type="hidden" name="attending" value={attending ? "0" : "1"} />
      <button
        type="submit"
        disabled={fetcher.state !== "idle"}
        className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${attending
            ? "bg-amber-500 text-slate-950 hover:bg-amber-400 animate-attendee-in"
            : "bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-300 border border-slate-600"
          }`}
      >
        {member} {attending ? "✓" : "+"}
      </button>
    </fetcher.Form>
  );
}
