/**
 * firebase-admin.ts — Firebase Admin (ฝั่ง server เท่านั้น)
 *
 * ⚠️ ห้าม import จาก component ฝั่ง client — ใช้ได้เฉพาะ API routes + สคริปต์
 *
 * ตั้งใจใช้ firebase-admin เฉพาะ Firestore (adminDb) — ไม่แตะ firebase-admin/auth
 * เพราะมันลาก jwks-rsa → jose (ESM) ที่ require() พังบน Vercel runtime
 * การตรวจ ID token จึงทำเองด้วย jose (Next รองรับ ESM ปกติ)
 *
 * credential: env FIREBASE_SERVICE_ACCOUNT (Vercel) หรือไฟล์ .secrets ในเครื่อง Aj
 */

import "server-only";
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { existsSync, readFileSync } from "fs";
import { createRemoteJWKSet, jwtVerify } from "jose";

const LOCAL_KEY_PATH = "C:\\Users\\UNS_CT\\.secrets\\aj-online-exam-sa.json";
const PROJECT_ID = "aj-online-exam";

function loadServiceAccount(): Record<string, string> {
  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (fromEnv) return JSON.parse(fromEnv);
  if (existsSync(LOCAL_KEY_PATH)) return JSON.parse(readFileSync(LOCAL_KEY_PATH, "utf8"));
  throw new Error("FIREBASE_SERVICE_ACCOUNT ไม่ได้ตั้งค่า (Vercel env หรือไฟล์ .secrets)");
}

function getAdminApp(): App {
  return getApps().find((a) => a.name === "admin")
    ?? initializeApp({ credential: cert(loadServiceAccount()) }, "admin");
}

export function adminDb() {
  return getFirestore(getAdminApp());
}

/** access token ของ service account (scope cloud-platform) — ใช้เรียก Google REST API
 *  เช่น Firestore export (ระบบ backup) ที่ Admin SDK ไม่มีเมธอดให้ */
export async function adminAccessToken(): Promise<string> {
  const cred = getAdminApp().options.credential;
  if (!cred) throw new Error("no admin credential");
  const { access_token } = await cred.getAccessToken();
  return access_token;
}

// ── ตรวจ Firebase ID token ด้วย jose (ไม่พึ่ง firebase-admin/auth) ─────────────

const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

/**
 * ตรวจ Authorization: Bearer <Firebase ID token>
 * คืน uid + email หรือ null ถ้าไม่ถูกต้อง
 */
export async function verifyBearer(
  authorization: string | null
): Promise<{ uid: string; email: string } | null> {
  if (!authorization?.startsWith("Bearer ")) return null;
  try {
    const { payload } = await jwtVerify(authorization.slice(7), JWKS, {
      issuer:   `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
    });
    const uid = String(payload.sub ?? "");
    if (!uid) return null;
    return { uid, email: String(payload.email ?? "") };
  } catch {
    return null;
  }
}
