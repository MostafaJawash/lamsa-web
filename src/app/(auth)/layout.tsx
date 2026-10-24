/** Auth pages inside the shop chrome, in the prototype narrow centered `.auth` block. */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="lm-pg">
      <div className="lm-auth">{children}</div>
    </div>
  );
}
