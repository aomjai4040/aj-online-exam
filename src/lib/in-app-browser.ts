/**
 * in-app-browser.ts — ตรวจจับ webview ของแอปอื่น (LINE, Facebook ฯลฯ)
 *
 * Google บล็อก OAuth ใน embedded webview ตามนโยบาย "Use secure browsers"
 * (Error 403: disallowed_useragent) — แก้ฝั่งเราไม่ได้ ต้องพาผู้ใช้ออกไป
 * เบราว์เซอร์จริงก่อนเริ่ม login
 *
 * LINE: รองรับพารามิเตอร์ทางการ `openExternalBrowser=1`
 *       → นำทางไป URL ที่มี param นี้ LINE จะเปิด Safari/Chrome ให้อัตโนมัติ
 * Facebook / Instagram / Messenger: ไม่มีทางหนีอัตโนมัติ
 *       → ต้องแสดงวิธีให้ผู้ใช้กดเปิดในเบราว์เซอร์เอง
 */

export type InAppBrowser = "line" | "facebook" | "instagram" | "messenger";

export function getInAppBrowser(): InAppBrowser | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  if (/Line\//i.test(ua))               return "line";
  if (/FBAN|FBAV|FB_IAB/i.test(ua))     return "facebook";
  if (/Instagram/i.test(ua))            return "instagram";
  if (/Messenger/i.test(ua))            return "messenger";
  return null;
}

/** URL ปัจจุบัน + openExternalBrowser=1 สำหรับสั่ง LINE เปิดเบราว์เซอร์ภายนอก */
export function lineExternalBrowserUrl(): string {
  const url = new URL(window.location.href);
  url.searchParams.set("openExternalBrowser", "1");
  return url.toString();
}

/** พยายามหนีออกจาก in-app browser — คืน true ถ้าจัดการให้อัตโนมัติได้ (LINE) */
export function escapeInAppBrowser(): boolean {
  if (getInAppBrowser() === "line") {
    window.location.href = lineExternalBrowserUrl();
    return true;
  }
  return false;
}
