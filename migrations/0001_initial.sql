-- Meals: reusable meal names and optional R2 photo key
CREATE TABLE IF NOT EXISTS meals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  photo_key TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Dinners: one row per calendar day, optional meal
CREATE TABLE IF NOT EXISTS dinners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  meal_id INTEGER REFERENCES meals(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dinners_date ON dinners(date);

-- Attendance: who is coming to each dinner (Mum, Dad, Jade, Lewis)
CREATE TABLE IF NOT EXISTS attendance (
  dinner_id INTEGER NOT NULL REFERENCES dinners(id) ON DELETE CASCADE,
  member TEXT NOT NULL CHECK (member IN ('Mum', 'Dad', 'Jade', 'Lewis')),
  PRIMARY KEY (dinner_id, member)
);

CREATE INDEX IF NOT EXISTS idx_attendance_dinner_id ON attendance(dinner_id);

-- Sessions: PIN login session tokens (2-week expiry)
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL
);
