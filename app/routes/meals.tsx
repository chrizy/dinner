import { Form, useActionData } from "react-router";
import type { Route } from "./+types/meals";
import {
  getDb,
  getMeals,
  createMeal,
  updateMeal,
  deleteMeal,
  getMealById,
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
    await deleteMeal(db, idNum);
    return { ok: true };
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
      <h2 className="text-xl font-semibold text-amber-900 dark:text-amber-100">
        Meals
      </h2>

      <Form
        method="post"
        encType="multipart/form-data"
        className="p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-stone-900 space-y-3"
      >
        <input type="hidden" name="intent" value="add" />
        <div>
          <label htmlFor="add-name" className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
            New meal name
          </label>
          <input
            id="add-name"
            name="name"
            type="text"
            required
            placeholder="e.g. Spaghetti Bolognese"
            className="w-full px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100"
          />
        </div>
        <div>
          <label htmlFor="add-description" className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
            Description (optional)
          </label>
          <textarea
            id="add-description"
            name="description"
            rows={2}
            placeholder="e.g. Classic family favourite"
            className="w-full px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 resize-y"
          />
        </div>
        <div>
          <label htmlFor="add-shopping" className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
            Shopping list (optional, one item per line)
          </label>
          <textarea
            id="add-shopping"
            name="shopping_list"
            rows={3}
            placeholder="e.g. mince, onions, tin of tomatoes (one per line)"
            className="w-full px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 resize-y font-mono text-sm"
          />
        </div>
        <div>
          <label htmlFor="add-photo" className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
            Photo (optional)
          </label>
          <input
            id="add-photo"
            name="photo"
            type="file"
            accept="image/*"
            className="w-full text-sm text-stone-600 dark:text-stone-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-amber-100 file:text-amber-900 dark:file:bg-amber-900/30 dark:file:text-amber-100"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-700"
        >
          Add meal
        </button>
      </Form>

      {actionData?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{actionData.error}</p>
      )}

      <ul className="space-y-3">
        {meals.map((meal) => (
          <MealRow key={meal.id} meal={meal} />
        ))}
      </ul>
      {meals.length === 0 && (
        <p className="text-stone-500 dark:text-stone-400">No meals yet. Add one above.</p>
      )}
    </div>
  );
}

function MealRow({ meal }: { meal: Meal }) {
  const photoUrl = meal.photo_key
    ? `/api/meal-photo/${encodeURIComponent(meal.photo_key)}`
    : null;
  const shoppingItems = meal.shopping_list
    ? meal.shopping_list.split(/\r?\n/).filter(Boolean)
    : [];

  return (
    <li className="p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-stone-900 space-y-3">
      <div className="flex items-start gap-4">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt=""
            className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-amber-100 dark:bg-stone-700 flex items-center justify-center text-amber-600 dark:text-amber-400 text-2xl flex-shrink-0">
            🍽
          </div>
        )}
        <Form
          method="post"
          encType="multipart/form-data"
          className="flex flex-1 flex-col gap-2 min-w-0"
        >
          <input type="hidden" name="intent" value="edit" />
          <input type="hidden" name="id" value={meal.id} />
          <div className="flex flex-wrap items-center gap-2">
            <input
              name="name"
              type="text"
              defaultValue={meal.name}
              required
              className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-medium"
            />
            <input
              name="photo"
              type="file"
              accept="image/*"
              className="text-sm text-stone-600 dark:text-stone-400 file:mr-1 file:py-1 file:px-2 file:rounded file:border-0 file:bg-amber-100 file:text-amber-900 dark:file:bg-amber-900/30 dark:file:text-amber-100"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-sm hover:bg-amber-700"
            >
              Save
            </button>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-0.5">
              Description
            </label>
            <textarea
              name="description"
              rows={2}
              defaultValue={meal.description ?? ""}
              placeholder="Optional"
              className="w-full px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm resize-y"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-0.5">
              Shopping list (one per line)
            </label>
            <textarea
              name="shopping_list"
              rows={3}
              defaultValue={meal.shopping_list ?? ""}
              placeholder="Optional"
              className="w-full px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm resize-y font-mono"
            />
          </div>
        </Form>
        <Form method="post">
          <input type="hidden" name="intent" value="delete" />
          <input type="hidden" name="id" value={meal.id} />
          <button
            type="submit"
            className="px-3 py-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm"
          >
            Remove
          </button>
        </Form>
      </div>
      {(meal.description || shoppingItems.length > 0) && (
        <div className="flex flex-col gap-2 pt-2 border-t border-amber-100 dark:border-stone-800 text-sm">
          {meal.description && (
            <p className="text-stone-600 dark:text-stone-400">{meal.description}</p>
          )}
          {shoppingItems.length > 0 && (
            <div>
              <span className="font-medium text-stone-500 dark:text-stone-400">
                Shopping:
              </span>{" "}
              <ul className="list-disc list-inside mt-0.5 text-stone-600 dark:text-stone-400">
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
