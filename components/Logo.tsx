import Link from "next/link";

export function Logo({
  href = "/",
  showWordmark = true,
  size = "md",
}: {
  href?: string | null;
  showWordmark?: boolean;
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "h-8 w-8 rounded-lg" : "h-9 w-9 rounded-xl";
  const icon = size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]";

  const content = (
    <span className="flex items-center gap-2.5">
      <span
        className={`relative grid ${box} place-items-center overflow-hidden bg-gradient-to-br from-emerald-300 to-teal-500 text-emerald-950 shadow-glow`}
      >
        <svg viewBox="0 0 24 24" fill="none" className={icon} aria-hidden="true">
          <path
            d="M12 3.2l1.9 4.7 4.7 1.9-4.7 1.9L12 16.4l-1.9-4.7L5.4 9.8l4.7-1.9L12 3.2z"
            fill="currentColor"
          />
          <path d="M17.8 15.2l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1z" fill="currentColor" opacity="0.7" />
        </svg>
      </span>
      {showWordmark ? (
        <span className="text-[17px] font-semibold tracking-tight text-white">
          open<span className="text-emerald-300">mi</span>
        </span>
      ) : null}
    </span>
  );

  if (!href) return content;

  return (
    <Link href={href} className="focus-ring rounded-xl" aria-label="Openmi home">
      {content}
    </Link>
  );
}
