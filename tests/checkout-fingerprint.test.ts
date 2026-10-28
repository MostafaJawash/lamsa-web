import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("API_BASE_URL", "http://127.0.0.1:8000/api/v1");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
  vi.stubEnv("NEXT_PUBLIC_MEDIA_BASE_URL", "http://127.0.0.1:8000/media");
  vi.stubEnv("CHECKOUT_SIGNING_SECRET", "a".repeat(48));
});

describe("checkout fingerprint", () => {
  it("round-trips a signed backend total snapshot", async () => {
    const { signCheckoutFingerprint, verifyCheckoutFingerprint } = await import(
      "@/features/checkout/fingerprint"
    );
    const value = {
      attempt: "123e4567-e89b-12d3-a456-426614174000",
      addressId: 7,
      deliveryMethodCode: "damascus_courier",
      totals: { SYP: "15000.00" },
    } as const;
    expect(verifyCheckoutFingerprint(signCheckoutFingerprint(value))).toEqual(value);
  });

  it("rejects a changed state without trusting it", async () => {
    const { signCheckoutFingerprint, verifyCheckoutFingerprint } = await import(
      "@/features/checkout/fingerprint"
    );
    const signed = signCheckoutFingerprint({
      attempt: "123e4567-e89b-12d3-a456-426614174000",
      addressId: 7,
      deliveryMethodCode: "damascus_courier",
      totals: { SYP: "15000.00" },
    });
    expect(verifyCheckoutFingerprint(`${signed}x`)).toBeNull();
  });
});
