import { Container } from "./container";

/** Placeholder page body: just the page's title. Replace with real content per feature. */
export function PageTitle({ children }: { children: React.ReactNode }) {
  return (
    <Container className="py-10">
      <h1 className="text-3xl font-semibold text-ink">{children}</h1>
    </Container>
  );
}
