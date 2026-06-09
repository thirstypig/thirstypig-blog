import { describe, it, expect } from "vitest";
import { isSafeSrc } from "./image-validation";

describe("isSafeSrc", () => {
  // ── Safe paths ──────────────────────────────────────────────────────────────

  it("allows empty string (no image set)", () => {
    expect(isSafeSrc("")).toBe(true);
  });

  it("allows relative path starting with /", () => {
    expect(isSafeSrc("/images/posts/slug/01.jpg")).toBe(true);
  });

  it("allows same-origin absolute URL", () => {
    expect(isSafeSrc("https://thirstypig.com/images/posts/slug/01.jpg")).toBe(true);
  });

  // ── Blocked: data: URIs ─────────────────────────────────────────────────────

  it("blocks data: URI (SVG with potential scripting)", () => {
    expect(isSafeSrc("data:image/svg+xml,<svg><script>alert(1)</script></svg>")).toBe(false);
  });

  it("blocks data: URI (plain image)", () => {
    expect(isSafeSrc("data:image/png;base64,iVBOR...")).toBe(false);
  });

  // ── Blocked: javascript: URIs ───────────────────────────────────────────────

  it("blocks javascript: URI", () => {
    expect(isSafeSrc("javascript:alert(document.cookie)")).toBe(false);
  });

  // ── Blocked: arbitrary external hosts ──────────────────────────────────────

  it("blocks arbitrary https host (DNS/timing oracle + potential exfil)", () => {
    expect(isSafeSrc("https://evil.com/tracker.gif")).toBe(false);
  });

  it("blocks http: URL", () => {
    expect(isSafeSrc("http://thirstypig.com/image.jpg")).toBe(false);
  });

  it("blocks blob: URI", () => {
    expect(isSafeSrc("blob:https://thirstypig.com/some-uuid")).toBe(false);
  });

  // ── Edge cases ──────────────────────────────────────────────────────────────

  it("does not allow a URL that merely contains thirstypig.com as a subdomain of another host", () => {
    expect(isSafeSrc("https://thirstypig.com.evil.com/x.jpg")).toBe(false);
  });
});
