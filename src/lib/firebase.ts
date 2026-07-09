import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, browserLocalPersistence, setPersistence } from "firebase/auth";

// authDomain: ใช้โดเมนของเว็บเอง (first-party) บน production
// เพื่อให้ signInWithRedirect ทำงานบน iOS Safari / LINE browser ได้
// (มี rewrite proxy /__/auth/* → firebaseapp.com ใน next.config.ts)
// ส่วน localhost ยังใช้ค่าจาก env (firebaseapp.com) เพราะ dev ไม่มี https
function resolveAuthDomain(): string | undefined {
  if (typeof window === "undefined") return process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  }
  return window.location.host;
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: resolveAuthDomain(),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db = getFirestore(app);
export const auth = getAuth(app);

// ตั้ง persistence ชัดเจนเพื่อให้ session คงอยู่ข้าม page reload
if (typeof window !== "undefined") {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
}
