export type Member = "Mum" | "Dad" | "Jade" | "Lewis";

export interface Meal {
  id: number;
  name: string;
  description: string | null;
  shopping_list: string | null;
  photo_key: string | null;
  created_at: string;
  deleted: number;
}

export interface Dinner {
  id: number;
  date: string;
  meal_id: number | null;
  created_at: string;
  meal?: Meal | null;
  attendance: Member[];
}

export const MEMBERS: Member[] = ["Mum", "Dad", "Jade", "Lewis"];
export const PARENTS: Member[] = ["Mum", "Dad"];
export const KIDS: Member[] = ["Jade", "Lewis"];
