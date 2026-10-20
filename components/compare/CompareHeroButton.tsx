import Link from "next/link";

export function CompareHeroButton() {
  return (
    <Link
      href="/pricing#how-access-works"
      data-public-primary-action
      className="inline-flex rounded-xl px-8 py-3.5 text-base font-bold no-underline transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
      style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
    >
      Understand Pilot Access →
    </Link>
  );
}
