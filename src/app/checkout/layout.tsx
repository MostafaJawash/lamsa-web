/** Checkout pages. TODO: a reduced header (logo + steps) once checkout is built. */
export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="lm-pg">{children}</div>;
}
