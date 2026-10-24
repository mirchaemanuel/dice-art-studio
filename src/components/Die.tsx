import { PIPS } from "../lib/engine";

export function Die({
  value = 5,
  size = 28,
  className = "",
}: {
  value?: number;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={`die-icon ${className}`}
      aria-label={`Faccia ${value}`}
      role="img"
    >
      <rect x="1" y="1" width="38" height="38" rx="7" fill="currentColor" />
      {PIPS[value].map(([x, y], i) => (
        <circle
          key={i}
          cx={3 + x * 34}
          cy={3 + y * 34}
          r="3.6"
          className="die-pip"
        />
      ))}
    </svg>
  );
}
