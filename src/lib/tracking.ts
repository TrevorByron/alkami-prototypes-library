import { isDemoMode } from "@/lib/demoMode";
import { recordDemoEasterEgg, recordDemoVisit } from "@/lib/demoStore";
import { supabase } from "@/lib/supabase";

// Small bits of member activity the Habits and Secrets awards are earned from
// (migration 20261112100000_member_tracking.sql). Every call fails quietly:
// until the migration is applied nothing is recorded and those awards stay
// locked, but nothing else in the app is affected.

export type EasterEggId = "contributors";

/** The member's local calendar date, "2026-11-12". */
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export async function recordVisit() {
  const day = localDay();
  if (isDemoMode) { recordDemoVisit(day); return; }
  if (!supabase) return;
  await supabase.rpc("record_visit", { p_day: day });
}

export async function recordEasterEgg(egg: EasterEggId) {
  if (isDemoMode) { recordDemoEasterEgg(egg); return; }
  if (!supabase) return;
  await supabase.rpc("record_easter_egg", { p_key: egg });
}
