/** Prototype `empty()` / `.empty-st`: round icon, title, optional text and action. */
export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  text?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="lm-empty-st">
      <div className="e-ic">{icon}</div>
      <h3>{title}</h3>
      {text ? <p>{text}</p> : null}
      {action}
    </div>
  );
}
