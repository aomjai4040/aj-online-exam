/**
 * firebase-admin.ts — Firebase Admin SDK (ฝั่ง server เท่านั้น)
 *
 * ⚠️ ห้าม import ไฟล์นี้จาก component ฝั่ง client เด็ดขาด —
 *    ใช้ได้เฉพาะใน API routes (src/app/api/**) และสคริปต์
 *
 * ลำดับการหา credential:
 *   1. env FIREBASE_SERVICE_ACCOUNT (Vercel — เนื้อหา JSON ทั้งไฟล์)
 *   2. ไฟล์ในเครื่อง Aj: C:\Users\UNS_CT\.secrets\aj-online-exam-sa.json (dev เท่านั้น)
 */

import "server-only";
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { existsSync, readFileSync } from "fs";

const LOCAL_KEY_PATH = "C:\\Users\\UNS_CT\\.secrets\\aj-online-exam-sa.json";

function loadServiceAccount(): Record<string, string> {
  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (fromEnv) return JSON.parse(fromEnv);

  // fallback สำหรับรันในเครื่อง Aj เท่านั้น (path นี้ไม่มีบน Vercel)
  if (existsSync(LOCAL_KEY_PATH)) {
    return JSON.parse(readFileSync(LOCAL_KEY_PATH, "utf8"));
  }
  throw new Error(
    "FIREBASE_SERVICE_ACCOUNT is not configured (Vercel env var หรือไฟล์ .secrets ในเครื่อง)"
  );
}

function getAdminApp(): App {
  const existing = getApps().find((a) => a.name === "admin");
  if (existing) return existing;
  return initializeApp({ credential: cert(loadServiceAccount()) }, "admin");
}

export function adminDb() {
  return getFirestore(getAdminApp());
}

export function adminAuth() {
  return getAuth(getAdminApp());
}

/**
 * ตรวจ Firebase ID token จาก Authorization: Bearer <token>
 * คืน uid + email หรือ null ถ้าไม่ถูกต้อง — ทุก API ที่ต้องรู้ตัวตนใช้ตัวนี้
 */
export async function verifyBearer(
  authorization: string | null
): Promise<{ uid: string; email: string } | null> {
  if (!authorization?.startsWith("Bearer ")) return null;
  try {
    const decoded = await adminAuth().verifyIdToken(authorization.slice(7));
    return { uid: decoded.uid, email: decoded.email ?? "" };
  } catch {
    return null;
  }
}
