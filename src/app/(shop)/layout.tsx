/** Shop pages: the prototype `.pg` content box (the chrome comes from the root layout). */
export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="lm-pg">{children}</div>;
}
