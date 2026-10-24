import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";

/** Checkout layout. TODO: a reduced header (logo + steps) once checkout is built. */
export default function CheckoutLayout({ children }: LayoutProps<"/checkout">) {
  return (
    <>
      <Header />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </>
  );
}
