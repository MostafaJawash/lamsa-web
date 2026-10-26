import { Wordmark } from "@/components/shared/wordmark";

/**
 * Top of the prototype `.auth` block: the big logo (`.logo` at 40px), the title
 * (`.auth h2`, an h1 here) and the muted line (`.auth>p.muted`).
 */
export function AuthHeader({ title, lead }: { title: string; lead: string }) {
  return (
    <>
      <span className="lm-logo" style={{ fontSize: 40 }}>
        <Wordmark />
      </span>
      <h1>{title}</h1>
      <p className="lm-muted">{lead}</p>
    </>
  );
}
