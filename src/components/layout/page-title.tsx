/** Placeholder page body: the page title as the prototype `.list-head h2`. */
export function PageTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="lm-list-head">
      <h1>{children}</h1>
    </div>
  );
}
