export default function CanopyLogo({ size = 32 }: { size?: number }) {
  const accent = "#1B2E4B";
  return (
    <svg viewBox="0 0 80 80" width={size} height={size} fill="none" aria-hidden="true">
      <path
        d="M8 58 Q8 12 40 12 Q72 12 72 58"
        stroke={accent} strokeWidth="1.5" strokeLinecap="round" opacity="0.28"
      />
      <path
        d="M16 58 Q16 20 40 20 Q64 20 64 58"
        stroke={accent} strokeWidth="2" strokeLinecap="round" opacity="0.58"
      />
      <path
        d="M24 58 Q24 28 40 28 Q56 28 56 58"
        stroke={accent} strokeWidth="2.5" strokeLinecap="round"
      />
      <line
        x1="8" y1="58" x2="72" y2="58"
        stroke={accent} strokeWidth="1.5" strokeLinecap="round" opacity="0.35"
      />
      <circle cx="40" cy="12" r="2"   fill={accent} opacity="0.28" />
      <circle cx="40" cy="20" r="2"   fill={accent} opacity="0.58" />
      <circle cx="40" cy="28" r="2.5" fill={accent} />
    </svg>
  );
}
