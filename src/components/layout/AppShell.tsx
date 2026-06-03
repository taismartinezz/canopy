"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, CheckSquare, BookOpen, BookMarked, Users,
  Bell, ChevronDown, LogOut, Settings, User,
} from "lucide-react";
import { USERS, NOTIFICATIONS, PROJECT, CURRENT_USER_ID } from "@/lib/mock-data";
import Avatar from "@/components/ui/Avatar";
import { getUser } from "@/lib/mock-data";

const NAV_ITEMS = [
  { href: "/",            label: "Dashboard",  icon: LayoutDashboard },
  { href: "/tasks",       label: "Tasks",      icon: CheckSquare     },
  { href: "/journal",     label: "Journal",    icon: BookOpen        },
  { href: "/literature",  label: "Literature", icon: BookMarked      },
  { href: "/team",        label: "Team",       icon: Users           },
];

// Canopy tree SVG icon for the strip
function CanopyIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 2C9 2 6 5 6 8C6 10 7 11.5 8 12.5C6.5 13 5 14.5 5 16.5C5 18.5 6.5 20 8.5 20H12V22H14V20H15.5C17.5 20 19 18.5 19 16.5C19 14.5 17.5 13 16 12.5C17 11.5 18 10 18 8C18 5 15 2 12 2Z" fill="#1B2E4B"/>
    </svg>
  );
}

// Project icon for the strip
function ProjectDot({ active, color }: { active: boolean; color: string }) {
  return (
    <div
      style={{ backgroundColor: color }}
      className="w-9 h-9 rounded-[10px] flex items-center justify-center text-white text-xs font-roboto font-700 transition-all"
      title={PROJECT.name}
      aria-current={active ? "page" : undefined}
    >
      MI
    </div>
  );
}

// Notification badge dot
function NotifDot({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span
      className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-white"
      style={{ backgroundColor: "#C0392B", fontSize: "10px", fontFamily: "var(--font-roboto)", fontWeight: 700 }}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const currentUser = getUser(CURRENT_USER_ID)!;
  const teamMembers = USERS.filter((u) => u.role === "researcher");
  const unreadCount = NOTIFICATIONS.filter((n) => !n.read && n.recipientId === CURRENT_USER_ID).length;

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <div className="flex h-full" style={{ fontFamily: "var(--font-roboto)" }}>

      {/* ── Layer 1: 40px icon strip ── */}
      <div
        className="flex flex-col items-center pt-3 pb-3 gap-3"
        style={{
          width: 40,
          minWidth: 40,
          backgroundColor: "var(--color-strip)",
          borderRight: "1px solid var(--color-border)",
          zIndex: 10,
        }}
      >
        {/* Canopy logo icon */}
        <div className="w-8 h-8 flex items-center justify-center mb-1">
          <CanopyIcon />
        </div>

        {/* Project switcher */}
        <button
          className="relative focus-visible:outline-navy"
          aria-label={`Switch to ${PROJECT.name}`}
        >
          <ProjectDot active color="#1B2E4B" />
        </button>
      </div>

      {/* ── Layer 2: 210px navigation sidebar ── */}
      <div
        className="flex flex-col"
        style={{
          width: 210,
          minWidth: 210,
          backgroundColor: "var(--color-sidebar)",
          borderRight: "1px solid var(--color-border)",
        }}
      >
        {/* Wordmark */}
        <div className="px-4 pt-4 pb-3">
          <span
            style={{
              fontFamily: "var(--font-lora)",
              fontWeight: 700,
              fontSize: 18,
              color: "var(--color-navy)",
              letterSpacing: "-0.01em",
            }}
          >
            Canopy
          </span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-2 space-y-0.5" aria-label="Main navigation">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors min-h-[44px]"
                style={{
                  backgroundColor: active ? "var(--color-navy)" : undefined,
                  color: active ? "#ffffff" : "var(--color-body)",
                  fontWeight: active ? 600 : 400,
                  fontSize: 14,
                  fontFamily: "var(--font-roboto)",
                  borderRadius: 8,
                  textDecoration: "none",
                }}
                aria-current={active ? "page" : undefined}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(27,46,75,0.06)";
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = "";
                }}
              >
                <Icon size={16} strokeWidth={active ? 2.5 : 2} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Team section */}
        <div
          className="px-3 py-3"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <p
            className="px-1 pb-2 uppercase"
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.06em",
              color: "var(--color-secondary)",
              fontFamily: "var(--font-roboto)",
            }}
          >
            Team
          </p>
          <div className="space-y-0.5 max-h-52 overflow-y-auto">
            {USERS.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-2 px-1 py-1 rounded"
                style={{ minHeight: 32 }}
              >
                <Avatar user={user} size={22} />
                <span
                  style={{
                    fontSize: 13,
                    color: user.id === CURRENT_USER_ID ? "var(--color-navy)" : "var(--color-body)",
                    fontWeight: user.id === CURRENT_USER_ID ? 600 : 400,
                    fontFamily: "var(--font-roboto)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {user.role === "pi" ? `${user.name}` : user.name.split(" ")[0]}
                  {user.role === "pi" && (
                    <span
                      style={{
                        fontSize: 10,
                        marginLeft: 4,
                        color: "var(--color-secondary)",
                        fontWeight: 400,
                      }}
                    >
                      PI
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Layer 3: Main content area ── */}
      <div className="flex flex-col flex-1 min-w-0" style={{ backgroundColor: "var(--color-canvas)" }}>

        {/* Top bar */}
        <header
          className="flex items-center justify-between px-6 py-3"
          style={{
            backgroundColor: "var(--color-surface)",
            borderBottom: "1px solid var(--color-border)",
            height: 52,
            minHeight: 52,
          }}
        >
          {/* Project name */}
          <span
            style={{
              fontSize: 13,
              color: "var(--color-secondary)",
              fontFamily: "var(--font-roboto)",
            }}
          >
            {PROJECT.name}
          </span>

          <div className="flex items-center gap-3">
            {/* Institution badge */}
            <span
              className="px-3 py-1"
              style={{
                backgroundColor: "var(--color-navy)",
                color: "#fff",
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 600,
                fontFamily: "var(--font-roboto)",
                whiteSpace: "nowrap",
              }}
            >
              {PROJECT.institution}
            </span>

            {/* Notification bell */}
            <div className="relative">
              <button
                onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); }}
                className="relative w-9 h-9 flex items-center justify-center rounded-lg transition-colors hover:bg-[rgba(27,46,75,0.06)]"
                aria-label={`Notifications (${unreadCount} unread)`}
                style={{ minWidth: 44, minHeight: 44 }}
              >
                <Bell size={18} color="var(--color-body)" />
                <NotifDot count={unreadCount} />
              </button>

              {notifOpen && (
                <NotifPanel
                  onClose={() => setNotifOpen(false)}
                  userId={CURRENT_USER_ID}
                />
              )}
            </div>

            {/* User avatar / profile */}
            <div className="relative">
              <button
                onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
                className="flex items-center gap-2 rounded-lg px-1 py-1 transition-colors hover:bg-[rgba(27,46,75,0.06)]"
                aria-label="Profile menu"
                style={{ minHeight: 44 }}
              >
                <Avatar user={currentUser} size={28} />
                <ChevronDown size={14} color="var(--color-secondary)" />
              </button>

              {profileOpen && (
                <ProfileMenu user={currentUser} onClose={() => setProfileOpen(false)} />
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

// ── Notification panel ────────────────────────────────────────────────────────

function NotifPanel({ onClose, userId }: { onClose: () => void; userId: string }) {
  const userNotifs = NOTIFICATIONS.filter((n) => n.recipientId === userId);

  return (
    <div
      className="absolute right-0 top-full mt-2 animate-fade-in"
      style={{
        width: 320,
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: 10,
        boxShadow: "var(--shadow-card)",
        zIndex: 100,
      }}
      role="dialog"
      aria-label="Notifications"
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <span style={{ fontFamily: "var(--font-lora)", fontWeight: 600, fontSize: 15, color: "var(--color-navy)" }}>
          Notifications
        </span>
        <button onClick={onClose} className="text-secondary hover:text-body" aria-label="Close notifications">
          <span style={{ fontSize: 18, color: "var(--color-secondary)", lineHeight: 1 }}>×</span>
        </button>
      </div>
      <div className="divide-y" style={{ maxHeight: 320, overflowY: "auto" }}>
        {userNotifs.length === 0 ? (
          <p className="px-4 py-6 text-center" style={{ color: "var(--color-secondary)", fontSize: 13 }}>
            No notifications
          </p>
        ) : (
          userNotifs.map((n) => (
            <div
              key={n.id}
              className="px-4 py-3"
              style={{
                backgroundColor: n.read ? undefined : "rgba(27,46,75,0.03)",
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              <p style={{ fontSize: 13, color: "var(--color-body)" }}>
                {!n.read && (
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-2"
                    style={{ backgroundColor: "var(--color-navy)", verticalAlign: "middle" }}
                  />
                )}
                {n.message}
              </p>
              <p style={{ fontSize: 11, color: "var(--color-secondary)", marginTop: 2 }}>
                {formatRelativeTime(n.createdAt)}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Profile menu ──────────────────────────────────────────────────────────────

function ProfileMenu({ user, onClose }: { user: ReturnType<typeof getUser>; onClose: () => void }) {
  if (!user) return null;
  return (
    <div
      className="absolute right-0 top-full mt-2 animate-fade-in"
      style={{
        width: 200,
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: 10,
        boxShadow: "var(--shadow-card)",
        zIndex: 100,
      }}
    >
      <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <p style={{ fontWeight: 600, fontSize: 13, color: "var(--color-body)" }}>{user.name}</p>
        <p style={{ fontSize: 11, color: "var(--color-secondary)", marginTop: 1 }}>{user.email}</p>
      </div>
      <div className="py-1">
        {[
          { label: "Profile", icon: User },
          { label: "Settings", icon: Settings },
        ].map(({ label, icon: Icon }) => (
          <button
            key={label}
            onClick={onClose}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-[rgba(27,46,75,0.06)]"
            style={{ fontSize: 13, color: "var(--color-body)", minHeight: 44 }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
        <div style={{ borderTop: "1px solid var(--color-border)", marginTop: 4, paddingTop: 4 }}>
          <button
            onClick={onClose}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-[rgba(27,46,75,0.06)]"
            style={{ fontSize: 13, color: "var(--color-error)", minHeight: 44 }}
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
