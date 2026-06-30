"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, CheckSquare, BookOpen, BookMarked, Bookmark, Users,
  Bell, ChevronDown, LogOut, User as UserIcon, Menu, X, Settings,
} from "lucide-react";
import { computeInitials } from "@/lib/utils";
import type { User } from "@/types";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useProject } from "@/context/ProjectContext";
import Toast from "@/components/ui/Toast";
import Avatar from "@/components/ui/Avatar";
import CanopyLogo from "@/components/ui/CanopyLogo";
const NAV_ITEMS = [
  { href: "/",            label: "Dashboard",  icon: LayoutDashboard },
  { href: "/tasks",       label: "Tasks",      icon: CheckSquare     },
  { href: "/journal",     label: "Journal",    icon: BookOpen        },
  { href: "/literature",  label: "Literature", icon: BookMarked      },
  { href: "/bookmarks",   label: "Bookmarks",  icon: Bookmark        },
  { href: "/team",        label: "Team",       icon: Users           },
];


function NotifDot({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span
      className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center pointer-events-none"
      style={{ backgroundColor: "#C0392B", fontSize: 10, fontWeight: 700, color: "#fff" }}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

function relTime(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Shared sidebar nav body ───────────────────────────────────────────────────

function SidebarBody({
  isActive,
  onLinkClick,
  showCloseButton,
  onClose,
  team,
  currentUserId,
}: {
  isActive: (href: string) => boolean;
  onLinkClick?: () => void;
  showCloseButton?: boolean;
  onClose?: () => void;
  team: User[];
  currentUserId: string;
}) {
  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "var(--color-sidebar)" }}>
      {/* Wordmark row */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <span style={{ fontFamily: "var(--font-lora)", fontWeight: 700, fontSize: 18, color: "var(--color-navy)" }}>
          Canopy
        </span>
        {showCloseButton && (
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-lg transition-colors hover:bg-[rgba(27,46,75,0.06)]"
            style={{ width: 44, height: 44 }}
            aria-label="Close navigation"
          >
            <X size={18} color="var(--color-secondary)" />
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto" aria-label="Main navigation">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onLinkClick}
              className="flex items-center gap-2.5 px-3 rounded-lg transition-colors"
              style={{
                backgroundColor: active ? "var(--color-navy)" : undefined,
                color: active ? "#fff" : "var(--color-body)",
                fontWeight: active ? 600 : 400,
                fontSize: 14,
                borderRadius: 8,
                textDecoration: "none",
                minHeight: 44,
                display: "flex",
                alignItems: "center",
              }}
              aria-current={active ? "page" : undefined}
              onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(27,46,75,0.06)"; }}
              onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = ""; }}
            >
              <Icon size={16} strokeWidth={active ? 2.5 : 2} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Team section */}
      <div className="px-3 py-3 shrink-0" style={{ borderTop: "1px solid var(--color-border)" }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-secondary)", paddingBottom: 8, paddingLeft: 4 }}>
          Team
        </p>
        <div className="max-h-48 overflow-y-auto space-y-0.5">
          {team.length === 0 && (
            <p style={{ fontSize: 12, color: "var(--color-secondary)", padding: "2px 4px" }}>No teammates yet.</p>
          )}
          {team.map((user) => (
            <div key={user.id} className="flex items-center gap-2 px-1 py-1" style={{ minHeight: 32 }}>
              <Avatar user={user} size={22} />
              <span style={{
                fontSize: 13,
                color: user.id === currentUserId ? "var(--color-navy)" : "var(--color-body)",
                fontWeight: user.id === currentUserId ? 600 : 400,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {user.role === "pi" ? user.name : user.name.split(" ")[0]}
                {user.role === "pi" && <span style={{ fontSize: 10, marginLeft: 4, color: "var(--color-secondary)", fontWeight: 400 }}>PI</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Notification panel ────────────────────────────────────────────────────────

type SupabaseNotif = {
  id: string;
  type: string;
  title: string;
  body?: string;
  read: boolean;
  created_at: string;
};

function NotifPanel({ onClose, notifications }: { onClose: () => void; notifications: SupabaseNotif[] }) {
  return (
    <div
      className="absolute right-0 top-full mt-2 animate-fade-in"
      style={{ width: 320, maxWidth: "calc(100vw - 24px)", backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10, boxShadow: "var(--shadow-card)", zIndex: 100 }}
      role="dialog" aria-label="Notifications"
    >
      <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <span style={{ fontFamily: "var(--font-lora)", fontWeight: 600, fontSize: 15, color: "var(--color-navy)" }}>Notifications</span>
        <button onClick={onClose} style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }} aria-label="Close">
          <X size={16} color="var(--color-secondary)" />
        </button>
      </div>
      <div style={{ maxHeight: 320, overflowY: "auto" }}>
        {notifications.length === 0 ? (
          <p className="px-4 py-6 text-center" style={{ color: "var(--color-secondary)", fontSize: 13 }}>No notifications</p>
        ) : (
          notifications.map((n) => (
            <div key={n.id} className="px-4 py-3" style={{ backgroundColor: n.read ? undefined : "rgba(27,46,75,0.03)", borderBottom: "1px solid var(--color-border)" }}>
              <p style={{ fontSize: 13, color: "var(--color-body)" }}>
                {!n.read && <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: "var(--color-navy)", verticalAlign: "middle" }} />}
                {n.title}{n.body ? ` — ${n.body}` : ""}
              </p>
              <p style={{ fontSize: 11, color: "var(--color-secondary)", marginTop: 2 }}>{relTime(n.created_at)}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Profile menu ──────────────────────────────────────────────────────────────

function ProfileMenu({ user, onClose, onSignOut, onNavigateProfile, onNavigateSettings }: {
  user: Pick<User, "name" | "email">;
  onClose: () => void;
  onSignOut: () => void;
  onNavigateProfile: () => void;
  onNavigateSettings: () => void;
}) {
  return (
    <div
      className="absolute right-0 top-full mt-2 animate-fade-in"
      style={{ width: 200, backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10, boxShadow: "var(--shadow-card)", zIndex: 100 }}
    >
      <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <p style={{ fontWeight: 600, fontSize: 13, color: "var(--color-body)" }}>{user.name}</p>
        <p style={{ fontSize: 11, color: "var(--color-secondary)", marginTop: 1 }}>{user.email}</p>
      </div>
      <div className="py-1">
        <button
          onClick={() => { onNavigateProfile(); onClose(); }}
          className="w-full flex items-center gap-2.5 px-4 text-left transition-colors hover:bg-[rgba(27,46,75,0.06)]"
          style={{ fontSize: 13, color: "var(--color-body)", minHeight: 44 }}
        >
          <UserIcon size={14} /> Profile
        </button>
        <button
          onClick={() => { onNavigateSettings(); onClose(); }}
          className="w-full flex items-center gap-2.5 px-4 text-left transition-colors hover:bg-[rgba(27,46,75,0.06)]"
          style={{ fontSize: 13, color: "var(--color-body)", minHeight: 44 }}
        >
          <Settings size={14} /> Settings
        </button>
        <div style={{ borderTop: "1px solid var(--color-border)", marginTop: 4, paddingTop: 4 }}>
          <button onClick={onSignOut} className="w-full flex items-center gap-2.5 px-4 text-left transition-colors hover:bg-[rgba(27,46,75,0.06)]" style={{ fontSize: 13, color: "var(--color-error)", minHeight: 44 }}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AppShell ──────────────────────────────────────────────────────────────────

function projectInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { projectId } = useProject();
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [project, setProject] = useState<any>(null);
  const [team, setTeam] = useState<User[]>([]);
  const [notifications, setNotifications] = useState<SupabaseNotif[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const hasFetched = useRef(false);

  // ── Auth gate + notifications ─────────────────────────────────────────────
  useEffect(() => {
    let notifChannel: ReturnType<typeof supabase.channel> | null = null;

    async function init() {
      // ── Prototype (no Supabase) path ──────────────────────────────────────
      if (!isSupabaseConfigured) {
        if (localStorage.getItem("canopy_authed") !== "true") {
          router.replace("/login");
          return;
        }
        try {
          const stored = localStorage.getItem("canopy_user");
          if (stored) setProfile(JSON.parse(stored));
        } catch { /* use null profile */ }
        setAuthed(true);
        return;
      }

      // ── Supabase path ─────────────────────────────────────────────────────
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user ?? null;
        if (!user) { router.replace("/login"); return; }

        const { data: prof } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        // Fetch notifications
        const { data: notifs, error: notifError } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        if (notifError) console.error("[AppShell] notifications error:", notifError);
        if (notifs) {
          setNotifications(notifs as SupabaseNotif[]);
          setUnreadCount(notifs.filter((n) => !n.read).length);
        }

        // Realtime subscription for new notifications
        notifChannel = supabase
          .channel(`notifications:${user.id}`)
          .on("postgres_changes", {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          }, (payload) => {
            setNotifications((prev) => [payload.new as SupabaseNotif, ...prev]);
            setUnreadCount((prev) => prev + 1);
          })
          .subscribe();

        setProfile(prof);
        setAuthed(true);
      } catch (err) {
        console.error("[AppShell] init error:", err);
        router.replace("/login");
      }
    }

    if (!hasFetched.current) {
      hasFetched.current = true;
      init();
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/login");
    });

    return () => {
      subscription.unsubscribe();
      notifChannel?.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Project data + team — driven by projectId from context ────────────────
  useEffect(() => {
    if (!projectId) return;
    let canceled = false;

    async function loadProjectData() {
      const { data: proj } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .maybeSingle();
      if (!canceled) setProject(proj);

      const { data: members } = await supabase
        .from("team_members")
        .select("*, user_profiles(name, avatar_color, avatar_initials, avatar_url)")
        .eq("project_id", projectId);

      if (!canceled && members) {
        setTeam(members.map((row) => {
          const profiles = row.user_profiles as unknown as Record<string, string>[] | null;
          const p = Array.isArray(profiles) ? profiles[0] : (profiles as Record<string, string> | null);
          return {
            id: row.user_id as string,
            name: p?.name ?? "Unknown",
            email: "",
            role: row.role as User["role"],
            avatarColor: p?.avatar_color ?? "#B4D4E3",
            avatarInitials: computeInitials(p?.name ?? "") || (p?.avatar_initials ?? "??"),
            avatarUrl: p?.avatar_url ?? undefined,
          };
        }));
      }
    }

    loadProjectData();
    return () => { canceled = true; };
  }, [projectId]);

  useEffect(() => { setMobileNavOpen(false); setNotifOpen(false); setProfileOpen(false); }, [pathname]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setMobileNavOpen(false); setNotifOpen(false); setProfileOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileNavOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileNavOpen]);

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    localStorage.clear();
    router.push("/login");
  }

  if (!authed) {
    return (
      <div className="flex h-full items-center justify-center" style={{ backgroundColor: "var(--color-canvas)" }}>
        <div style={{ width: 32, height: 32, border: "3px solid var(--color-border)", borderTopColor: "var(--color-navy)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <>
    <div className="flex h-full" style={{ fontFamily: "var(--font-roboto)" }}>

      {/* Mobile nav backdrop */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-20 md:hidden"
          style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Layer 1: 40px icon strip — desktop only ── */}
      <div
        className="hidden md:flex flex-col items-center pt-3 pb-3 gap-3 shrink-0"
        style={{ width: 40, backgroundColor: "var(--color-strip)", borderRight: "1px solid var(--color-border)", position: "relative", zIndex: 35 }}
      >
        <div className="w-8 h-8 flex items-center justify-center mb-1"><CanopyLogo size={28} /></div>
        <button aria-label={profile?.name ?? "Your profile"} title={profile?.name ?? "Your profile"}>
          <div className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ backgroundColor: "var(--color-navy)", color: "#fff", fontSize: 12, fontWeight: 700 }}>
            {computeInitials(profile?.name ?? "") || (profile?.avatar_initials ?? "??")}
          </div>
        </button>
      </div>

      {/* ── Layer 2: Nav sidebar — static on desktop, hidden on mobile ── */}
      <div
        className="hidden md:flex flex-col shrink-0"
        style={{ width: 210, borderRight: "1px solid var(--color-border)", position: "relative", zIndex: 35 }}
      >
        <SidebarBody isActive={isActive} team={team} currentUserId={profile?.id ?? ""} />
      </div>

      {/* ── Mobile nav drawer — fixed overlay, slide in/out ── */}
      <div
        className="md:hidden fixed top-0 left-0 h-full z-30"
        style={{
          width: 210,
          transform: mobileNavOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.22s ease-out",
          borderRight: "1px solid var(--color-border)",
        }}
        aria-hidden={!mobileNavOpen}
        role="navigation"
        aria-label="Main navigation"
      >
        <SidebarBody
          isActive={isActive}
          onLinkClick={() => setMobileNavOpen(false)}
          showCloseButton
          onClose={() => setMobileNavOpen(false)}
          team={team}
          currentUserId={profile?.id ?? ""}
        />
      </div>

      {/* ── Layer 3: Main content ── */}
      <div className="flex flex-col flex-1 min-w-0" style={{ backgroundColor: "var(--color-canvas)" }}>

        {/* Top bar */}
        <header
          className="flex items-center gap-2 px-3 md:px-6"
          style={{ backgroundColor: "var(--color-surface)", borderBottom: "1px solid var(--color-border)", height: 52, minHeight: 52 }}
        >
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMobileNavOpen(true)}
            className="md:hidden flex items-center justify-center rounded-lg transition-colors hover:bg-[rgba(27,46,75,0.06)] shrink-0"
            style={{ width: 44, height: 44 }}
            aria-label="Open navigation"
            aria-expanded={mobileNavOpen}
          >
            <Menu size={20} color="var(--color-navy)" />
          </button>

          {/* Mobile wordmark + logo */}
          <div className="md:hidden flex items-center gap-2">
            <CanopyLogo size={24} />
            <span style={{ fontFamily: "var(--font-lora)", fontWeight: 700, fontSize: 17, color: "var(--color-navy)" }}>
              Canopy
            </span>
          </div>

          {/* Desktop: lab name */}
          <div className="hidden md:flex items-center min-w-0">
            {project?.name && (
              <span style={{ fontSize: 12, color: "var(--color-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200 }}>
                {project.name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Institution badge — sm and up */}
            {project?.institution && (
              <span className="hidden sm:inline-block px-3 py-1 shrink-0"
                style={{ backgroundColor: "var(--color-navy)", color: "#fff", borderRadius: 20, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
                {project.institution}
              </span>
            )}

            {/* Notification bell */}
            <div className="relative">
              <button
                onClick={() => {
                  const opening = !notifOpen;
                  setNotifOpen(opening);
                  setProfileOpen(false);
                  if (opening && unreadCount > 0 && profile?.id) {
                    supabase
                      .from("notifications")
                      .update({ read: true })
                      .eq("user_id", profile.id)
                      .eq("read", false)
                      .then(({ error }) => {
                        if (!error) {
                          setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
                          setUnreadCount(0);
                        }
                      });
                  }
                }}
                className="relative flex items-center justify-center rounded-lg transition-colors hover:bg-[rgba(27,46,75,0.06)]"
                style={{ width: 44, height: 44 }}
                aria-label={`Notifications, ${unreadCount} unread`}
              >
                <Bell size={18} color="var(--color-body)" />
                <NotifDot count={unreadCount} />
              </button>
              {notifOpen && <NotifPanel onClose={() => setNotifOpen(false)} notifications={notifications} />}
            </div>

            {/* User avatar */}
            <div className="relative">
              <button
                onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
                className="flex items-center gap-1.5 rounded-lg px-1 transition-colors hover:bg-[rgba(27,46,75,0.06)]"
                style={{ minHeight: 44 }}
                aria-label="Profile menu"
              >
                <Avatar
                  user={{
                    name: profile?.name ?? "",
                    avatarColor: profile?.avatar_color ?? "#B4D4E3",
                    avatarInitials: computeInitials(profile?.name ?? "") || (profile?.avatar_initials ?? "??"),
                    avatarUrl: profile?.avatar_url ?? undefined,
                  }}
                  size={28}
                />
                <ChevronDown size={14} color="var(--color-secondary)" className="hidden sm:block" />
              </button>
              {profileOpen && (
                <ProfileMenu
                  user={{ name: profile?.name ?? "", email: profile?.email ?? "" }}
                  onClose={() => setProfileOpen(false)}
                  onSignOut={handleSignOut}
                  onNavigateProfile={() => router.push("/profile")}
                  onNavigateSettings={() => router.push("/settings")}
                />
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto min-h-0">{children}</main>
      </div>
    </div>
    <Toast />
    </>
  );
}
