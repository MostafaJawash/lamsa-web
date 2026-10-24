import { describe, expect, it } from "vitest";

import lamsaImageLoader, {
  buildImageUrl,
  pickImageUrl,
  sizeForWidth,
} from "@/lib/images";

const MEDIA = "https://media.test/media";
const KEY = "products/42/3f9ce1";

describe("sizeForWidth", () => {
  it("maps widths to the backend sizes", () => {
    expect(sizeForWidth(16)).toBe("thumb");
    expect(sizeForWidth(300)).toBe("thumb");
    expect(sizeForWidth(301)).toBe("medium");
    expect(sizeForWidth(800)).toBe("medium");
    expect(sizeForWidth(801)).toBe("large");
    expect(sizeForWidth(3840)).toBe("large");
  });
});

describe("buildImageUrl", () => {
  it("builds the size URL from a base key", () => {
    expect(buildImageUrl(KEY, "medium")).toBe(`${MEDIA}/${KEY}_medium.webp`);
  });

  it("accepts a key with a leading slash or a size suffix", () => {
    expect(buildImageUrl(`/${KEY}`, "thumb")).toBe(
      `${MEDIA}/${KEY}_thumb.webp`,
    );
    expect(buildImageUrl(`${KEY}_large.webp`, "thumb")).toBe(
      `${MEDIA}/${KEY}_thumb.webp`,
    );
  });
});

describe("lamsaImageLoader", () => {
  it("picks the size for a base key", () => {
    expect(lamsaImageLoader({ src: KEY, width: 256 })).toBe(
      `${MEDIA}/${KEY}_thumb.webp`,
    );
    expect(lamsaImageLoader({ src: KEY, width: 640 })).toBe(
      `${MEDIA}/${KEY}_medium.webp`,
    );
    expect(lamsaImageLoader({ src: KEY, width: 1080 })).toBe(
      `${MEDIA}/${KEY}_large.webp`,
    );
  });

  it("swaps the size of a URL the backend returned", () => {
    const medium = `http://127.0.0.1:8000/media/${KEY}_medium.webp`;
    expect(lamsaImageLoader({ src: medium, width: 1920 })).toBe(
      `http://127.0.0.1:8000/media/${KEY}_large.webp`,
    );
    expect(lamsaImageLoader({ src: medium, width: 200 })).toBe(
      `http://127.0.0.1:8000/media/${KEY}_thumb.webp`,
    );
  });

  it("leaves local and other absolute URLs unchanged", () => {
    expect(lamsaImageLoader({ src: "/favicon.ico", width: 64 })).toBe(
      "/favicon.ico",
    );
    expect(
      lamsaImageLoader({ src: "https://example.com/a.png", width: 64 }),
    ).toBe("https://example.com/a.png");
  });
});

describe("pickImageUrl", () => {
  it("picks from a backend {thumb, medium, large} object", () => {
    const urls = { thumb: "t.webp", medium: "m.webp", large: "l.webp" };
    expect(pickImageUrl(urls, 300)).toBe("t.webp");
    expect(pickImageUrl(urls, 500)).toBe("m.webp");
    expect(pickImageUrl(urls, 1200)).toBe("l.webp");
  });
});
