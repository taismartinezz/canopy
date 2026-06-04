import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const EMAILS = [
  "dgergle@gmail.com",
  "taismartinez2028.1@u.northwestern.edu",
];

async function main() {
  const { data: list, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;

  const seeded = list.users.filter((u) => EMAILS.includes(u.email ?? ""));
  if (!seeded.length) { console.log("No seed accounts found."); return; }

  const ids = seeded.map((u) => u.id);

  const { data: projects } = await supabase.from("projects").select("id").in("owner_id", ids);
  const pids = (projects ?? []).map((p: { id: string }) => p.id);

  if (pids.length) {
    await supabase.from("team_members").delete().in("project_id", pids);
    console.log("✓ team_members deleted");
  }
  await supabase.from("user_profiles").delete().in("id", ids);
  console.log("✓ user_profiles deleted");
  if (pids.length) {
    await supabase.from("projects").delete().in("id", pids);
    console.log(`✓ projects deleted (${pids.length})`);
  }

  for (const u of seeded) {
    const { error: delErr } = await supabase.auth.admin.deleteUser(u.id);
    if (delErr) console.warn(`⚠ ${u.email}: ${delErr.message}`);
    else console.log(`✓ deleted auth account  ${u.email}`);
  }

  console.log("\nDone — both accounts wiped.");
}

main().catch((err: unknown) => {
  console.error("✗", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
