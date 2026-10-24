import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";

/**
 * Shop layout: header, page, footer. Keep it static: session-dependent UI (account
 * menu, cart count, favorites) reads cookies and must render inside <Suspense>.
 */
export default function ShopLayout({ children }: LayoutProps<"/">) {
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
