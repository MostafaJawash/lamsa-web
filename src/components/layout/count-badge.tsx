/**
 * Prototype `.badge` (cart / favorites counts on icons and tabs). Renders nothing for
 * 0; not used until the cart and favorites features exist.
 */
export function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return <i className="lm-badge">{count > 99 ? "99+" : count}</i>;
}
