import type { User } from "@/types";

interface AvatarProps {
  user: Pick<User, "avatarColor" | "avatarInitials" | "name"> & { avatarUrl?: string };
  size?: number;
  className?: string;
}

export default function Avatar({ user, size = 28, className = "" }: AvatarProps) {
  const fontSize = Math.max(10, Math.round(size * 0.38));

  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatarUrl}
        alt={user.name}
        width={size}
        height={size}
        className={`rounded-full shrink-0 object-cover ${className}`}
        style={{ width: size, height: size }}
        onError={(e) => {
          // Fall back to initials on broken image
          const el = e.currentTarget;
          el.style.display = "none";
          const sibling = el.nextElementSibling as HTMLElement | null;
          if (sibling) sibling.style.display = "flex";
        }}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: user.avatarColor,
        fontSize,
        fontFamily: "var(--font-roboto)",
        fontWeight: 600,
        color: "#3a3a3a",
        userSelect: "none",
      }}
      title={user.name}
      aria-label={user.name}
    >
      {user.avatarInitials}
    </div>
  );
}
