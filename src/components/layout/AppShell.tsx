"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, CheckSquare, BookOpen, BookMarked, Users,
  Bell, ChevronDown, LogOut, Settings, User, Menu, X,
} from "lucide-react";
import { USERS, NOTIFICATIONS, PROJECT, CURRENT_USER_ID, getUser } from "@/lib/mock-data";
import Avatar from "@/components/ui/Avatar";

const NAV_ITEMS = [
  { href: "/",           label: "Dashboard",  icon: LayoutDashboard },
  { href: "/tasks",      label: "Tasks",      icon: CheckSquare     },
  { href: "/journal",    label: "Journal",    icon: BookOpen        },
  { href: "/literature", label: "Literature", icon: BookMarked      },
  { href: "/team",       label: "Team",       icon: Users           },
];

function CanopyIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2C9 2 6 5 6 8C6 10 7 11.5 8 12.5C6.5 13 5 14.5 5 16.5C5 18.5 6.5 20 8.5 20H12V22H14V20H15.5C17.5 20 19 18.5 19 16.5C19 14.5 17.5 13 16 12.5C17 11.5 18 10 18 8C18 5 15 2 12 2Z" fill="#1B2E4B"/>
    </svg>
  );
}

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
}: {
  isActive: (href: string) => boolean;
  onLinkClick?: () => void;
  showCloseButton?: boolean;
  onClose?: () => void;
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
          {USERS.map((user) => (
            <div key={user.id} className="flex items-center gap-2 px-1 py-1" style={{ minHeight: 32 }}>
              <Avatar user={user} size={22} />
              <span style={{
                fontSize: 13,
                color: user.id === CURRENT_USER_ID ? "var(--color-navy)" : "var(--color-body)",
                fontWeight: user.id === CURRENT_USER_ID ? 600 : 400,
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

function NotifPanel({ onClose, userId }: { onClose: () => void; userId: string }) {
  const notifs = NOTIFICATIONS.filter((n) => n.recipientId === userId);
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
        {notifs.length === 0 ? (
          <p className="px-4 py-6 text-center" style={{ color: "var(--color-secondary)", fontSize: 13 }}>No notifications</p>
        ) : (
          notifs.map((n) => (
            <div key={n.id} className="px-4 py-3" style={{ backgroundColor: n.read ? undefined : "rgba(27,46,75,0.03)", borderBottom: "1px solid var(--color-border)" }}>
              <p style={{ fontSize: 13, color: "var(--color-body)" }}>
                {!n.read && <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: "var(--color-navy)", verticalAlign: "middle" }} />}
                {n.message}
              </p>
              <p style={{ fontSize: 11, color: "var(--color-secondary)", marginTop: 2 }}>{relTime(n.createdAt)}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Profile menu ──────────────────────────────────────────────────────────────

function ProfileMenu({ user, onClose }: { user: ReturnType<typeof getUser>; onClose: () => void }) {
  if (!user) return null;
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
        {[{ label: "Profile", icon: User }, { label: "Settings", icon: Settings }].map(({ label, icon: Icon }) => (
          <button key={label} onClick={onClose} className="w-full flex items-center gap-2.5 px-4 text-left transition-colors hover:bg-[rgba(27,46,75,0.06)]" style={{ fontSize: 13, color: "var(--color-body)", minHeight: 44 }}>
            <Icon size={14} /> {label}
          </button>
        ))}
        <div style={{ borderTop: "1px solid var(--color-border)", marginTop: 4, paddingTop: 4 }}>
          <button onClick={onClose} className="w-full flex items-center gap-2.5 px-4 text-left transition-colors hover:bg-[rgba(27,46,75,0.06)]" style={{ fontSize: 13, color: "var(--color-error)", minHeight: 44 }}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AppShell ──────────────────────────────────────────────────────────────────

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const currentUser = getUser(CURRENT_USER_ID)!;
  const unreadCount = NOTIFICATIONS.filter((n) => !n.read && n.recipientId === CURRENT_USER_ID).length;

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

  return (
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
        style={{ width: 40, backgroundColor: "var(--color-strip)", borderRight: "1px solid var(--color-border)", zIndex: 10 }}
      >
        <div className="w-8 h-8 flex items-center justify-center mb-1"><CanopyIcon /></div>
        <button aria-label={PROJECT.name} title={PROJECT.name}>
          <div className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ backgroundColor: "var(--color-navy)", color: "#fff", fontSize: 12, fontWeight: 700 }}>MI</div>
        </button>
      </div>

      {/* ── Layer 2: Nav sidebar — static on desktop, hidden on mobile ── */}
      <div
        className="hidden md:flex flex-col shrink-0"
        style={{ width: 210, borderRight: "1px solid var(--color-border)" }}
      >
        <SidebarBody isActive={isActive} />
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

          {/* Mobile wordmark */}
          <span className="md:hidden" style={{ fontFamily: "var(--font-lora)", fontWeight: 700, fontSize: 17, color: "var(--color-navy)" }}>
            Canopy
          </span>

          {/* Desktop project name */}
          <span className="hidden md:block" style={{ fontSize: 13, color: "var(--color-secondary)" }}>
            {PROJECT.name}
          </span>

          <div className="flex items-center gap-2 ml-auto">
            {/* Institution badge — sm and up */}
            <span className="hidden sm:inline-block px-3 py-1 shrink-0"
              style={{ backgroundColor: "var(--color-navy)", color: "#fff", borderRadius: 20, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
              {PROJECT.institution}
            </span>

            {/* Notification bell */}
            <div className="relative">
              <button
                onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); }}
                className="relative flex items-center justify-center rounded-lg transition-colors hover:bg-[rgba(27,46,75,0.06)]"
                style={{ width: 44, height: 44 }}
                aria-label={`Notifications, ${unreadCount} unread`}
              >
                <Bell size={18} color="var(--color-body)" />
                <NotifDot count={unreadCount} />
              </button>
              {notifOpen && <NotifPanel onClose={() => setNotifOpen(false)} userId={CURRENT_USER_ID} />}
            </div>

            {/* User avatar */}
            <div className="relative">
              <button
                onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
                className="flex items-center gap-1.5 rounded-lg px-1 transition-colors hover:bg-[rgba(27,46,75,0.06)]"
                style={{ minHeight: 44 }}
                aria-label="Profile menu"
              >
                <Avatar user={currentUser} size={28} />
                <ChevronDown size={14} color="var(--color-secondary)" className="hidden sm:block" />
              </button>
              {profileOpen && <ProfileMenu user={currentUser} onClose={() => setProfileOpen(false)} />}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto min-h-0">{children}</main>
      </div>
    </div>
  );
}
