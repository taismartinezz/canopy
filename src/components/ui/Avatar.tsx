import type { User } from "@/types";

interface AvatarProps {
  user: Pick<User, "avatarColor" | "avatarInitials" | "name">;
  size?: number;
  className?: string;
}

export default function Avatar({ user, size = 28, className = "" }: AvatarProps) {
  const fontSize = Math.max(10, Math.round(size * 0.38));
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
