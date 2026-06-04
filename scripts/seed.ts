import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

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

// ── Step 1: Delete existing seed data ────────────────────────────────────────

async function reset() {
  console.log("\n── Resetting existing seed data ─────────────────────────\n");

  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) throw listErr;

  const seeded = list.users.filter((u) => SEED_EMAILS.includes(u.email ?? ""));
  if (seeded.length === 0) {
    console.log("  · No existing seed accounts found — skipping reset.");
    return;
  }

  const userIds = seeded.map((u) => u.id);
  console.log("  Found:", seeded.map((u) => u.email).join(", "));

  // Find projects owned by seeded users
  const { data: projects } = await supabase
    .from("projects")
    .select("id")
    .in("owner_id", userIds);
  const projectIds = (projects ?? []).map((p: { id: string }) => p.id);

  // Delete in dependency order
  if (projectIds.length > 0) {
    await supabase.from("team_members").delete().in("project_id", projectIds);
    console.log("  ✓ team_members deleted");
  }

  await supabase.from("user_profiles").delete().in("id", userIds);
  console.log("  ✓ user_profiles deleted");

  if (projectIds.length > 0) {
    await supabase.from("projects").delete().in("id", projectIds);
    console.log(`  ✓ projects deleted (${projectIds.length})`);
  }

  for (const user of seeded) {
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) console.warn(`  ⚠ could not delete auth ${user.email}:`, error.message);
    else console.log(`  ✓ deleted auth account  ${user.email}`);
  }
}

// ── Step 2: Create fresh seed data ───────────────────────────────────────────

async function seed() {
  console.log("\n── Seeding fresh data ───────────────────────────────────\n");

  // Auth accounts
  console.log("1/4  Auth accounts");
  const { data: darrenData, error: darrenErr } = await supabase.auth.admin.createUser({
    email: "dgergle@gmail.com",
    password: "Canopy2024!",
    email_confirm: true,
    user_metadata: { name: "Darren Gergle" },
  });
  if (darrenErr) throw darrenErr;
  const darren = darrenData.user;
  console.log(`  ✓ created  dgergle@gmail.com  (${darren.id})`);

  const { data: taisData, error: taisErr } = await supabase.auth.admin.createUser({
    email: "taismartinez2028.1@u.northwestern.edu",
    password: "Canopy2024!",
    email_confirm: true,
    user_metadata: { name: "Tais Martinez" },
  });
  if (taisErr) throw taisErr;
  const tais = taisData.user;
  console.log(`  ✓ created  taismartinez2028.1@u.northwestern.edu  (${tais.id})`);

  // Project
  console.log("\n2/4  Project");
  const { data: project, error: projectErr } = await supabase
    .from("projects")
    .insert({ name: "4Chan MWG", institution: "Northwestern University", owner_id: darren.id })
    .select()
    .single();
  if (projectErr) throw projectErr;
  console.log(`  ✓ "${project.name}"  (${project.id})`);

  // User profiles
  console.log("\n3/4  User profiles");
  const { error: profileErr } = await supabase.from("user_profiles").insert([
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
  ]);
  if (profileErr) throw profileErr;
  console.log("  ✓ Darren Gergle   (pi)");
  console.log("  ✓ Tais Martinez   (researcher)");

  // Team members
  console.log("\n4/4  Team members");
  const { error: memberErr } = await supabase.from("team_members").insert([
    { project_id: project.id, user_id: darren.id, role: "pi" },
    { project_id: project.id, user_id: tais.id, role: "researcher" },
  ]);
  if (memberErr) throw memberErr;
  console.log("  ✓ Both added to project");

  console.log("\n── Done ─────────────────────────────────────────────────");
  console.log(`\n  Project:    ${project.name}  (${project.id})`);
  console.log(`  PI:         Darren Gergle  (${darren.id})`);
  console.log(`  Researcher: Tais Martinez  (${tais.id})\n`);
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  await reset();
  await seed();
}

main().catch((err: unknown) => {
  console.error("\n✗ Failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
