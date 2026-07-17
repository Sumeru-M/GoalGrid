/**
 * Platform adaptation. We tag <html data-platform="ios|android|web"> so the
 * stylesheet can switch corner radii, fonts, press feedback and tab-bar
 * treatment to match the host OS's conventions — the app should feel native on
 * both iPhone and Android, not like one design ported to the other.
 */
export type Platform = "ios" | "android" | "web";

export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "web";
  const ua = navigator.userAgent || "";
  const iOS = /iPhone|iPad|iPod/i.test(ua) ||
    // iPadOS 13+ reports as Mac; disambiguate via touch points.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (iOS) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "web";
}

/** Apply the platform attribute. Web falls back to iOS-style tokens (see CSS). */
export function applyPlatform(): Platform {
  const p = detectPlatform();
  document.documentElement.setAttribute("data-platform", p === "web" ? "ios" : p);
  document.documentElement.setAttribute("data-platform-raw", p);
  return p;
}
