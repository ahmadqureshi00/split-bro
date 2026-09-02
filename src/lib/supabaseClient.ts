import { createClient } from "@supabase/supabase-js";

/* ── Supabase types matching the DB schema ─────────────────────────── */
export interface Room {
  id: string;
  slug: string;
  name: string;
  currency: string;
  is_settled: boolean;
  created_at: string;
}

export interface Member {
  id: string;
  room_id: string;
  name: string;
  created_at: string;
}

export interface Expense {
  id: string;
  room_id: string;
  title: string;
  amount: number;
  paid_by: string; // member id
  created_at: string;
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  member_id: string;
  amount: number;
}

/* ── Environment variable validation ───────────────────────────────── */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || supabaseUrl.trim() === "") {
  console.error(
    "[Split Bro] ❌ NEXT_PUBLIC_SUPABASE_URL is missing or empty. " +
    "Please set it in your .env.local file. " +
    "Expected format: https://<project-ref>.supabase.co"
  );
}

if (!supabaseAnonKey || supabaseAnonKey.trim() === "") {
  console.error(
    "[Split Bro] ❌ NEXT_PUBLIC_SUPABASE_ANON_KEY is missing or empty. " +
    "Please set it in your .env.local file. " +
    "You can find it in your Supabase dashboard under Settings → API."
  );
}

/* ── Client singleton ──────────────────────────────────────────────── */
export const supabase = createClient(
  supabaseUrl ?? "",
  supabaseAnonKey ?? ""
);
