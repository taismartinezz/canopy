import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

// ── Client ────────────────────────────────────────────────────────────────────

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SEED_EMAILS = [
  "dgergle@gmail.com",
  "taismartinez2028.1@u.northwestern.edu",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getOrCreateUser(email: string, password: string, name: string): Promise<User> {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (!error) {
    console.log(`  ✓ created  ${email}`);
    return data.user;
  }

  // Already exists — look up by email
  console.log(`  · already exists, looking up ${email}…`);
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) throw listErr;

  const existing = list.users.find((u) => u.email === email);
  if (!existing) throw new Error(`Could not find existing user for ${email} (original error: ${error.message})`);

  console.log(`  ✓ found    ${email} (${existing.id})`);
  return existing;
}

// ── Reset ─────────────────────────────────────────────────────────────────────

async function reset() {
  console.log("\n── Canopy reset ─────────────────────────────────────────\n");

  // Find the seeded auth accounts
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) throw listErr;

  const seededUsers = list.users.filter((u) => SEED_EMAILS.includes(u.email ?? ""));

  if (seededUsers.length === 0) {
    console.log("  · No seeded accounts found — nothing to reset.\n");
    return;
  }

  const userIds = seededUsers.map((u) => u.id);
  console.log(`  Found ${seededUsers.length} seeded account(s):`, seededUsers.map((u) => u.email).join(", "));

  // 1. Find projects owned by any seeded user
  const { data: projects } = await supabase
    .from("projects")
    .select("id")
    .in("owner_id", userIds);

  const projectIds = (projects ?? []).map((p: { id: string }) => p.id);

  // 2. Delete team_members
  if (projectIds.length > 0) {
    const { error } = await supabase.from("team_members").delete().in("project_id", projectIds);
    if (error) console.warn("  ⚠ team_members delete:", error.message);
    else console.log("  ✓ team_members deleted");
  }

  // 3. Delete user_profiles
  const { error: profileErr } = await supabase.from("user_profiles").delete().in("id", userIds);
  if (profileErr) console.warn("  ⚠ user_profiles delete:", profileErr.message);
  else console.log("  ✓ user_profiles deleted");

  // 4. Delete projects
  if (projectIds.length > 0) {
    const { error } = await supabase.from("projects").delete().in("id", projectIds);
    if (error) console.warn("  ⚠ projects delete:", error.message);
    else console.log(`  ✓ projects deleted (${projectIds.length})`);
  }

  // 5. Delete auth accounts
  for (const user of seededUsers) {
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) console.warn(`  ⚠ delete auth ${user.email}:`, error.message);
    else console.log(`  ✓ deleted auth account  ${user.email}`);
  }

  console.log("\n── Reset complete ───────────────────────────────────────\n");
}

// ── Seed ──────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("\n── Canopy seed ─────────────────────────────────────────\n");

  // 1. Auth accounts
  console.log("1/4  Auth accounts");
  const darren = await getOrCreateUser(
    "dgergle@gmail.com",
    "Canopy2024!",
    "Darren Gergle",
  );
  const tais = await getOrCreateUser(
    "taismartinez2028.1@u.northwestern.edu",
    "Canopy2024!",
    "Tais Martinez",
  );

  // 2. Project
  console.log("\n2/4  Project");
  const { data: project, error: projectErr } = await supabase
    .from("projects")
    .insert({
      name: "4Chan MWG",
      institution: "Northwestern University",
      owner_id: darren.id,
    })
    .select()
    .single();

  if (projectErr) throw projectErr;
  console.log(`  ✓ "${project.name}" (${project.id})`);

  // 3. User profiles
  console.log("\n3/4  User profiles");
  const { error: profileErr } = await supabase.from("user_profiles").upsert(
    [
      {
        id: darren.id,
        name: "Darren Gergle",
        role: "pi",
        institution: "Northwestern University",
        avatar_initials: "DG",
        avatar_color: "#C5B4E3",
        project_id: project.id,
      },
      {
        id: tais.id,
        name: "Tais Martinez",
        role: "researcher",
        institution: "Northwestern University",
        avatar_initials: "TM",
        avatar_color: "#B4D4E3",
        project_id: project.id,
      },
    ],
    { onConflict: "id" },
  );
  if (profileErr) throw profileErr;
  console.log("  ✓ Darren Gergle  (pi)");
  console.log("  ✓ Tais Martinez  (researcher)");

  // 4. Team members
  console.log("\n4/4  Team members");
  const { error: memberErr } = await supabase.from("team_members").upsert(
    [
      { project_id: project.id, user_id: darren.id, role: "pi" },
      { project_id: project.id, user_id: tais.id, role: "researcher" },
    ],
    { onConflict: "project_id,user_id" },
  );
  if (memberErr) throw memberErr;
  console.log("  ✓ Both added to project");

  // Summary
  console.log("\n── Done ─────────────────────────────────────────────────");
  console.log(`\n  Project:    4Chan MWG  (${project.id})`);
  console.log(`  PI:         Darren Gergle  (${darren.id})`);
  console.log(`  Researcher: Tais Martinez  (${tais.id})\n`);
}

// ── Entry point ───────────────────────────────────────────────────────────────

const isReset = process.argv.includes("--reset");

(isReset ? reset() : seed()).catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("\n✗ Failed:", msg);
  process.exit(1);
});
