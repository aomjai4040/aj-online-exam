/**
 * device-session.ts — กันแชร์บัญชี (single-session)
 *
 * ทุกครั้งที่ login/เปิดแอป:
 *   1. ลงทะเบียนอุปกรณ์นี้ที่ users/{uid}/devices/{deviceId} (log สำหรับ admin ตรวจ)
 *   2. เขียน users/{uid}/session/current = อุปกรณ์นี้ (ประกาศตัวเป็น session ล่าสุด)
 *   3. เฝ้าดู session/current — ถ้าเครื่องอื่น login ทีหลัง:
 *        ENFORCE=false → เก็บ log เฉย ๆ (โหมดปัจจุบัน — สังเกตการณ์ก่อน)
 *        ENFORCE=true  → sign out เครื่องนี้พร้อมข้อความแจ้ง
 *
 * เปิดบังคับ = เปลี่ยน ENFORCE_SINGLE_SESSION เป็น true (ที่เดียว)
 */

import { doc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export const ENFORCE_SINGLE_SESSION = false; // ← เปิดบังคับเมื่อ Aj สั่ง

const DEVICE_KEY = "aj-device-id";

/** id ประจำเครื่อง (คงอยู่ใน localStorage — ล้าง browser = นับเป็นเครื่องใหม่) */
export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? `d-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return "unknown-device";
  }
}

function deviceLabel(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPod/.test(ua))  return "iPhone";
  if (/iPad|Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return "iPad";
  if (/Android/.test(ua))      return "Android";
  if (/Windows/.test(ua))      return "Windows";
  if (/Macintosh/.test(ua))    return "Mac";
  return "อื่น ๆ";
}

/**
 * เรียกหลัง auth พร้อม (uid ยืนยันแล้ว)
 * คืน unsubscribe function สำหรับหยุดเฝ้าดูตอน logout
 */
export function trackDeviceSession(
  uid:      string,
  onKicked: () => void,
): () => void {
  const deviceId = getDeviceId();

  // 1) log อุปกรณ์นี้ (admin ใช้ตรวจว่าบัญชีหนึ่งใช้กี่เครื่อง)
  setDoc(doc(db, "users", uid, "devices", deviceId), {
    label:      deviceLabel(),
    ua:         navigator.userAgent.slice(0, 200),
    lastSeenAt: serverTimestamp(),
  }, { merge: true }).catch(() => {});

  // 2) ประกาศตัวเป็น session ปัจจุบัน
  setDoc(doc(db, "users", uid, "session", "current"), {
    deviceId,
    label:     deviceLabel(),
    updatedAt: serverTimestamp(),
  }).catch(() => {});

  // 3) เฝ้าดู — เครื่องอื่นแย่ง session → ถูกเตะ (เมื่อเปิดบังคับ)
  const unsub = onSnapshot(
    doc(db, "users", uid, "session", "current"),
    (snap) => {
      const cur = snap.data()?.deviceId;
      if (cur && cur !== deviceId && ENFORCE_SINGLE_SESSION) {
        unsub();
        onKicked();
      }
    },
    () => {} // permission error ตอน sign out — เงียบไว้
  );
  return unsub;
}
