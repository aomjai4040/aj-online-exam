/**
 * device-session.ts — จำกัดจำนวนอุปกรณ์ต่อบัญชี (ไม่ใช่ single-session)
 *
 * นโยบาย (Aj 2026-07-11): ผู้เรียนใช้หลายเครื่องได้ตามสะดวก (มือถือ+iPad+คอม)
 * → อนุญาตสูงสุด MAX_DEVICES เครื่อง · ไม่มีการเตะกลางคันขณะใช้งาน
 * → ตรวจเฉพาะตอนเปิดแอปบน "เครื่องใหม่" ที่เกินโควตา
 *
 * ENFORCE_DEVICE_LIMIT=false (โหมด log-only) — เก็บข้อมูลก่อน
 * เปิดบังคับ = เปลี่ยนเป็น true: เครื่องที่ 4 ขึ้นไปจะเข้าไม่ได้
 * พร้อมข้อความให้ติดต่อแอดมิน (แอดมินล้างรายการเครื่องได้ใน /admin/users)
 */

import {
  collection, doc, getDocs, setDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

export const ENFORCE_DEVICE_LIMIT = false; // ← เปิดบังคับเมื่อ Aj สั่ง
export const MAX_DEVICES = 3;

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
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "iPad";
  if (/Android/.test(ua))      return "Android";
  if (/Windows/.test(ua))      return "Windows";
  if (/Macintosh/.test(ua))    return "Mac";
  return "อื่น ๆ";
}

/**
 * เรียกหลัง auth พร้อม — ลงทะเบียน/อัปเดตอุปกรณ์นี้
 * ถ้าเป็นเครื่องใหม่ที่เกินโควตาและเปิดบังคับ → เรียก onBlocked (ให้ sign out)
 */
export async function registerDevice(
  uid:       string,
  onBlocked: (max: number) => void,
): Promise<void> {
  const deviceId = getDeviceId();
  try {
    const snap = await getDocs(collection(db, "users", uid, "devices"));
    const known = snap.docs.some((d) => d.id === deviceId);

    if (!known && snap.size >= MAX_DEVICES && ENFORCE_DEVICE_LIMIT) {
      onBlocked(MAX_DEVICES);
      return; // ไม่ลงทะเบียนเครื่องเกินโควตา
    }

    // เครื่องที่รู้จักแล้ว = อัปเดตเวลา | เครื่องใหม่ในโควตา (หรือโหมด log) = ลงทะเบียน
    await setDoc(doc(db, "users", uid, "devices", deviceId), {
      label:      deviceLabel(),
      ua:         navigator.userAgent.slice(0, 200),
      lastSeenAt: serverTimestamp(),
    }, { merge: true });
  } catch {
    // เก็บ log ไม่ได้ (เช่น network) — ไม่ขวางการใช้งาน
  }
}
