import { Form, useActionData, useSubmit } from "react-router";
import type { Route } from "./+types/meals";
import {
  getDb,
  getMeals,
  createMeal,
  updateMeal,
  deleteMeal,
  getMealById,
  isMealUsed,
  archiveMeal,
  restoreMeal,
} from "~/lib/db.server";
import type { Meal } from "~/lib/types";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Meals | Who's for Dinner" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const db = getDb(context.cloudflare.env);
  const meals = await getMeals(db);
  return { meals };
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const db = getDb(env);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    const id = formData.get("id");
    const idNum = id ? Number.parseInt(String(id), 10) : Number.NaN;
    if (Number.isNaN(idNum)) return { error: "Invalid id" };
    const inUse = await isMealUsed(db, idNum);
    if (inUse) {
      await archiveMeal(db, idNum);
      return { ok: true, archived: true };
    }
    await deleteMeal(db, idNum);
    return { ok: true };
  }

  if (intent === "restore") {
    const id = formData.get("id");
    const idNum = id ? Number.parseInt(String(id), 10) : Number.NaN;
    if (Number.isNaN(idNum)) return { error: "Invalid id" };
    await restoreMeal(db, idNum);
    return { ok: true, restored: true };
  }

  if (intent === "add" || intent === "edit") {
    const name = formData.get("name");
    const nameStr = typeof name === "string" ? name.trim() : "";
    if (!nameStr) return { error: "Name is required" };

    const descriptionRaw = formData.get("description");
    const descriptionStr =
      typeof descriptionRaw === "string" ? descriptionRaw.trim() || null : null;
    const shoppingListRaw = formData.get("shopping_list");
    const shoppingListStr =
      typeof shoppingListRaw === "string" ? shoppingListRaw.trim() || null : null;

    const file = formData.get("photo") as File | null;
    const hasFile = file && file.size > 0 && file.name;

    if (intent === "add") {
      const meal = await createMeal(db, nameStr, null, descriptionStr, shoppingListStr);
      if (hasFile && env.MEAL_PHOTOS) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "webp";
        const key = `meal-${meal.id}-${crypto.randomUUID()}.${ext}`;
        await env.MEAL_PHOTOS.put(key, file.stream(), {
          httpMetadata: { contentType: file.type || "image/jpeg" },
        });
        await db
          .prepare("UPDATE meals SET photo_key = ? WHERE id = ?")
          .bind(key, meal.id)
          .run();
      }
      return { ok: true };
    }

    if (intent === "edit") {
      const id = formData.get("id");
      const idNum = id ? Number.parseInt(String(id), 10) : Number.NaN;
      if (Number.isNaN(idNum)) return { error: "Invalid id" };
      const existing = await getMealById(db, idNum);
      if (!existing) return { error: "Meal not found" };

      let photoKey: string | null = existing.photo_key;
      if (hasFile && env.MEAL_PHOTOS) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "webp";
        const key = `meal-${idNum}-${crypto.randomUUID()}.${ext}`;
        await env.MEAL_PHOTOS.put(key, file.stream(), {
          httpMetadata: { contentType: file.type || "image/jpeg" },
        });
        photoKey = key;
      }
      await updateMeal(db, idNum, nameStr, photoKey, descriptionStr, shoppingListStr);
      return { ok: true };
    }
  }

  return { error: "Unknown action" };
}

export default function Meals({ loaderData }: Route.ComponentProps) {
  const { meals } = loaderData;
  const actionData = useActionData<typeof action>();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white tracking-tight">
        Meals
      </h2>

      <Form
        method="post"
        encType="multipart/form-data"
        className="p-6 rounded-2xl border border-slate-700/50 bg-slate-900/80 shadow-xl shadow-black/20 space-y-4"
      >
        <input type="hidden" name="intent" value="add" />
        <div>
          <label htmlFor="add-name" className="block text-sm font-semibold text-slate-300 mb-1">
            New meal name
          </label>
          <input
            id="add-name"
            name="name"
            type="text"
            required
            placeholder="e.g. Spaghetti Bolognese"
            className="w-full px-4 py-3 rounded-xl border border-slate-600 bg-slate-800 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
          />
        </div>
        <div>
          <label htmlFor="add-description" className="block text-sm font-semibold text-slate-300 mb-1">
            Description (optional)
          </label>
          <textarea
            id="add-description"
            name="description"
            rows={2}
            placeholder="e.g. Classic family favourite"
            className="w-full px-4 py-3 rounded-xl border border-slate-600 bg-slate-800 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-y"
          />
        </div>
        <div>
          <label htmlFor="add-shopping" className="block text-sm font-semibold text-slate-300 mb-1">
            Shopping list (optional, one item per line)
          </label>
          <textarea
            id="add-shopping"
            name="shopping_list"
            rows={3}
            placeholder="e.g. mince, onions, tin of tomatoes (one per line)"
            className="w-full px-4 py-3 rounded-xl border border-slate-600 bg-slate-800 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-y font-mono text-sm"
          />
        </div>
        <div>
          <label htmlFor="add-photo" className="block text-sm font-semibold text-slate-300 mb-1">
            Photo (optional)
          </label>
          <input
            id="add-photo"
            name="photo"
            type="file"
            accept="image/*"
            className="w-full text-sm text-slate-400 file:mr-2 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-amber-500 file:text-slate-950 file:font-semibold"
          />
        </div>
        <button
          type="submit"
          className="px-6 py-3 rounded-2xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-slate-900 transition-colors"
        >
          Add meal
        </button>
      </Form>

      {actionData?.error && (
        <p className="text-sm font-semibold text-red-400">{actionData.error}</p>
      )}
      {actionData?.archived && (
        <p className="text-sm font-semibold text-amber-400">
          Meal is used in past plans, so it was archived. It still appears at the bottom of the meal list and in dropdowns.
        </p>
      )}
      {actionData?.restored && (
        <p className="text-sm font-semibold text-green-400">Meal restored.</p>
      )}

      <ul className="space-y-4">
        {meals.map((meal) => (
          <MealRow key={meal.id} meal={meal} />
        ))}
      </ul>
      {meals.length === 0 && (
        <p className="text-slate-400 font-medium">No meals yet. Add one above.</p>
      )}
    </div>
  );
}

function MealRow({ meal }: { meal: Meal }) {
  const submit = useSubmit();
  const photoUrl = meal.photo_key
    ? `/api/meal-photo/${encodeURIComponent(meal.photo_key)}`
    : null;
  const shoppingItems = meal.shopping_list
    ? meal.shopping_list.split(/\r?\n/).filter(Boolean)
    : [];
  const isArchived = meal.deleted !== 0;

  const handleRemove = () => {
    if (
      !confirm(
        "Remove this meal? It will be permanently deleted if unused, or hidden from new plans (archived) if it has been used in past dinners."
      )
    )
      return;
    const formData = new FormData();
    formData.set("intent", "delete");
    formData.set("id", String(meal.id));
    submit(formData, { method: "post" });
  };

  return (
    <li
      className={`p-5 rounded-2xl border shadow-lg space-y-4 ${
        isArchived
          ? "border-slate-600/50 bg-slate-800/60 shadow-black/20 opacity-90"
          : "border-slate-700/50 bg-slate-900/80 shadow-black/20"
      }`}
    >
      <div className="flex items-start gap-4">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt=""
            className="w-20 h-20 object-cover rounded-xl flex-shrink-0 ring-2 ring-slate-600/50"
          />
        ) : (
          <div className="w-20 h-20 rounded-xl bg-slate-700 flex items-center justify-center text-3xl flex-shrink-0">
            🍽
          </div>
        )}
        <Form
          method="post"
          encType="multipart/form-data"
          className="flex flex-1 flex-col gap-3 min-w-0"
        >
          <input type="hidden" name="intent" value="edit" />
          <input type="hidden" name="id" value={meal.id} />
          <div className="flex flex-wrap items-center gap-2">
            <input
              name="name"
              type="text"
              defaultValue={meal.name}
              required
              className="flex-1 min-w-0 px-4 py-2 rounded-xl border border-slate-600 bg-slate-800 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            {isArchived && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-600 text-slate-300">
                Archived
              </span>
            )}
            <input
              name="photo"
              type="file"
              accept="image/*"
              className="text-sm text-slate-400 file:mr-1 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-amber-500 file:text-slate-950 file:font-semibold"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-sm hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
            >
              Save
            </button>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Description
            </label>
            <textarea
              name="description"
              rows={2}
              defaultValue={meal.description ?? ""}
              placeholder="Optional"
              className="w-full px-4 py-2 rounded-xl border border-slate-600 bg-slate-800 text-slate-100 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Shopping list (one per line)
            </label>
            <textarea
              name="shopping_list"
              rows={3}
              defaultValue={meal.shopping_list ?? ""}
              placeholder="Optional"
              className="w-full px-4 py-2 rounded-xl border border-slate-600 bg-slate-800 text-slate-100 text-sm resize-y font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </Form>
        {isArchived ? (
          <Form method="post">
            <input type="hidden" name="intent" value="restore" />
            <input type="hidden" name="id" value={meal.id} />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-slate-600 text-white hover:bg-slate-500 font-semibold text-sm transition-colors border border-slate-500"
            >
              Restore
            </button>
          </Form>
        ) : (
          <button
            type="button"
            onClick={handleRemove}
            className="px-4 py-2 rounded-xl text-red-400 hover:bg-red-500/20 font-semibold text-sm transition-colors border border-slate-600 hover:border-red-500/50"
          >
            Remove
          </button>
        )}
      </div>
      {(meal.description || shoppingItems.length > 0) && (
        <div className="flex flex-col gap-2 pt-4 border-t border-slate-700 text-sm">
          {meal.description && (
            <p className="text-slate-400 font-medium">{meal.description}</p>
          )}
          {shoppingItems.length > 0 && (
            <div>
              <span className="font-bold text-slate-400">Shopping:</span>{" "}
              <ul className="list-disc list-inside mt-1 text-slate-400 space-y-0.5">
                {shoppingItems.map((item, i) => (
                  <li key={i}>{item.trim()}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
