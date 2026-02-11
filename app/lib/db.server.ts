import type { Meal, Dinner, Member } from "./types";

export function getDb(env: { DB: D1Database }) {
  return env.DB;
}

export async function getMeals(db: D1Database): Promise<Meal[]> {
  const stmt = db.prepare(
    "SELECT id, name, description, shopping_list, photo_key, created_at, deleted FROM meals ORDER BY deleted ASC, name ASC"
  );
  const { results } = await stmt.all<Meal>();
  return results ?? [];
}

export async function getMealById(
  db: D1Database,
  id: number
): Promise<Meal | null> {
  const stmt = db.prepare(
    "SELECT id, name, description, shopping_list, photo_key, created_at, deleted FROM meals WHERE id = ?"
  );
  const row = await stmt.bind(id).first<Meal>();
  return row ?? null;
}

export async function isMealUsed(db: D1Database, mealId: number): Promise<boolean> {
  const row = await db
    .prepare("SELECT 1 FROM dinners WHERE meal_id = ? LIMIT 1")
    .bind(mealId)
    .first<{ "1": number }>();
  return !!row;
}

export async function archiveMeal(db: D1Database, id: number): Promise<void> {
  await db.prepare("UPDATE meals SET deleted = 1 WHERE id = ?").bind(id).run();
}

export async function restoreMeal(db: D1Database, id: number): Promise<void> {
  await db.prepare("UPDATE meals SET deleted = 0 WHERE id = ?").bind(id).run();
}

export async function createMeal(
  db: D1Database,
  name: string,
  photoKey: string | null = null,
  description: string | null = null,
  shoppingList: string | null = null
): Promise<Meal> {
  const result = await db
    .prepare(
      "INSERT INTO meals (name, photo_key, description, shopping_list, deleted) VALUES (?, ?, ?, ?, 0) RETURNING id, name, description, shopping_list, photo_key, created_at, deleted"
    )
    .bind(name, photoKey, description, shoppingList)
    .first<Meal>();
  if (!result) throw new Error("Failed to create meal");
  return result;
}

export async function updateMeal(
  db: D1Database,
  id: number,
  name: string,
  photoKey: string | null,
  description: string | null,
  shoppingList: string | null
): Promise<void> {
  await db
    .prepare(
      "UPDATE meals SET name = ?, photo_key = ?, description = ?, shopping_list = ? WHERE id = ?"
    )
    .bind(name, photoKey, description, shoppingList, id)
    .run();
}

export async function deleteMeal(db: D1Database, id: number): Promise<void> {
  await db.prepare("DELETE FROM meals WHERE id = ?").bind(id).run();
}

export async function ensureDinner(
  db: D1Database,
  date: string
): Promise<{ id: number }> {
  let row = await db
    .prepare("SELECT id FROM dinners WHERE date = ?")
    .bind(date)
    .first<{ id: number }>();
  if (!row) {
    const result = await db
      .prepare("INSERT INTO dinners (date) VALUES (?) RETURNING id")
      .bind(date)
      .first<{ id: number }>();
    if (!result) throw new Error("Failed to create dinner");
    row = result;
    // Default attendance: Mum and Dad
    await db
      .prepare(
        "INSERT OR IGNORE INTO attendance (dinner_id, member) VALUES (?, 'Mum'), (?, 'Dad')"
      )
      .bind(row.id, row.id)
      .run();
  }
  return row;
}

export async function getDinnersWithDetails(
  db: D1Database,
  dates: string[]
): Promise<Dinner[]> {
  if (dates.length === 0) return [];
  const placeholders = dates.map(() => "?").join(",");
  const dinnersStmt = db.prepare(
    `SELECT d.id, d.date, d.meal_id, d.created_at, d.notes, d.extra_guests, m.id as meal_id_ref, m.name as meal_name, m.description as meal_description, m.shopping_list as meal_shopping_list, m.photo_key as meal_photo_key, m.created_at as meal_created_at, m.deleted as meal_deleted
     FROM dinners d
     LEFT JOIN meals m ON d.meal_id = m.id
     WHERE d.date IN (${placeholders})
     ORDER BY d.date ASC`
  );
  const dinnersResult = await dinnersStmt.bind(...dates).all<{
    id: number;
    date: string;
    meal_id: number | null;
    created_at: string;
    notes: string | null;
    extra_guests: number | null;
    meal_id_ref: number | null;
    meal_name: string | null;
    meal_description: string | null;
    meal_shopping_list: string | null;
    meal_photo_key: string | null;
    meal_created_at: string | null;
    meal_deleted: number | null;
  }>();
  const dinners = dinnersResult.results ?? [];

  const dinnerIds = dinners.map((d) => d.id);
  if (dinnerIds.length === 0) return [];

  const attStmt = db.prepare(
    `SELECT dinner_id, member FROM attendance WHERE dinner_id IN (${dinnerIds.map(() => "?").join(",")})`
  );
  const attResult = await attStmt.bind(...dinnerIds).all<{ dinner_id: number; member: Member }>();
  const attendanceList = attResult.results ?? [];
  const attendanceByDinner = new Map<number, Member[]>();
  for (const a of attendanceList) {
    const list = attendanceByDinner.get(a.dinner_id) ?? [];
    list.push(a.member);
    attendanceByDinner.set(a.dinner_id, list);
  }

  return dinners.map((d) => ({
    id: d.id,
    date: d.date,
    meal_id: d.meal_id,
    created_at: d.created_at,
    notes: d.notes ?? null,
    extra_guests: d.extra_guests ?? 0,
    meal: d.meal_id_ref
      ? {
          id: d.meal_id_ref,
          name: d.meal_name!,
          description: d.meal_description ?? null,
          shopping_list: d.meal_shopping_list ?? null,
          photo_key: d.meal_photo_key,
          created_at: d.meal_created_at!,
          deleted: d.meal_deleted ?? 0,
        }
      : null,
    attendance: attendanceByDinner.get(d.id) ?? [],
  }));
}

export async function setDinnerMeal(
  db: D1Database,
  date: string,
  mealId: number | null
): Promise<void> {
  const { id } = await ensureDinner(db, date);
  await db
    .prepare("UPDATE dinners SET meal_id = ? WHERE id = ?")
    .bind(mealId, id)
    .run();
}

export async function setDinnerNotes(
  db: D1Database,
  dinnerId: number,
  notes: string | null
): Promise<void> {
  const value = (notes ?? "").trim() || null;
  await db
    .prepare("UPDATE dinners SET notes = ? WHERE id = ?")
    .bind(value, dinnerId)
    .run();
}

export async function setDinnerExtraGuests(
  db: D1Database,
  dinnerId: number,
  extraGuests: number
): Promise<void> {
  const n = Math.max(0, Math.min(99, extraGuests));
  await db
    .prepare("UPDATE dinners SET extra_guests = ? WHERE id = ?")
    .bind(n, dinnerId)
    .run();
}

export async function setAttendance(
  db: D1Database,
  dinnerId: number,
  member: Member,
  attending: boolean
): Promise<void> {
  if (attending) {
    await db
      .prepare("INSERT OR IGNORE INTO attendance (dinner_id, member) VALUES (?, ?)")
      .bind(dinnerId, member)
      .run();
  } else {
    await db
      .prepare("DELETE FROM attendance WHERE dinner_id = ? AND member = ?")
      .bind(dinnerId, member)
      .run();
  }
}

export async function getSession(
  db: D1Database,
  token: string
): Promise<{ expires_at: string } | null> {
  const row = await db
    .prepare("SELECT expires_at FROM sessions WHERE token = ?")
    .bind(token)
    .first<{ expires_at: string }>();
  return row ?? null;
}

export async function createSession(
  db: D1Database,
  token: string,
  expiresAt: string
): Promise<void> {
  await db
    .prepare("INSERT INTO sessions (token, expires_at) VALUES (?, ?)")
    .bind(token, expiresAt)
    .run();
}

export async function deleteSession(db: D1Database, token: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
}

export async function deleteExpiredSessions(db: D1Database): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
}
