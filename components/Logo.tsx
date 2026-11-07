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
  const box = size === "sm" ? "h-6 w-6 rounded-[6px]" : "h-7 w-7 rounded-[7px]";
  const glyph = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  const content = (
    <span className="flex items-center gap-2">
      <span className={`grid ${box} place-items-center bg-brand`}>
        <svg viewBox="0 0 24 24" className={glyph} fill="none" aria-hidden="true">
          <path d="M5 8h6v3H5z" fill="#302B28" />
          <path d="M13 8h6v3h-6z" fill="#302B28" opacity="0.55" />
          <path d="M5 13h14v3H5z" fill="#302B28" />
        </svg>
      </span>
      {showWordmark ? (
        <span className="text-[19px] font-medium tracking-[-0.05em] text-ink">openmi</span>
      ) : null}
    </span>
  );

  if (!href) return content;

  return (
    <Link href={href} className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40" aria-label="Openmi home">
      {content}
    </Link>
  );
}
