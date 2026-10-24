import type { Route } from "next";
import Link from "next/link";

/** Prototype `section.sec` with its `.sec-h` header (title + optional "more" link). */
export function Section({
  title,
  more,
  children,
}: {
  title: string;
  more?: { href: Route; label: string } | null;
  children: React.ReactNode;
}) {
  return (
    <section className="lm-sec" aria-label={title}>
      <div className="lm-sec-h">
        <h2>{title}</h2>
        {more ? (
          <Link href={more.href} className="lm-more">
            {more.label}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}
