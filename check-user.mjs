// ตรวจสถานะน้องรายคน: บัญชี auth + ออเดอร์ + สิทธิ์ userCourses
// ใช้: node check-user.mjs <email>
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const email = (process.argv[2] ?? "").trim().toLowerCase();
if (!email) { console.error("ใส่อีเมล: node check-user.mjs <email>"); process.exit(1); }

const sa = JSON.parse(readFileSync("C:/Users/UNS_CT/.secrets/aj-online-exam-sa.json", "utf8"));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const fmt = (ts) => ts?._seconds ? new Date(ts._seconds * 1000).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }) : String(ts ?? "-");

// ── บัญชี ──
let user = null;
try { user = await getAuth().getUserByEmail(email); }
catch (e) { if (e.code !== "auth/user-not-found") throw e; }
if (!user) {
  console.log(`❌ ไม่พบบัญชี ${email} ใน Firebase Auth — น้องยังไม่เคย login (หรือ login ด้วยอีเมลอื่น)`);
} else {
  console.log(`บัญชี: ${user.email} | uid ${user.uid}`);
  console.log(`  สมัคร ${user.metadata.creationTime} | login ล่าสุด ${user.metadata.lastSignInTime}`);
}

// ── ออเดอร์ (ค้นด้วยอีเมล เผื่อ login คนละบัญชีกับที่จ่าย) ──
const orders = await db.collection("orders").where("email", "==", email).get();
console.log(`\nออเดอร์ของอีเมลนี้: ${orders.size} รายการ`);
orders.docs
  .sort((a, b) => (a.data().createdAt?._seconds ?? 0) - (b.data().createdAt?._seconds ?? 0))
  .forEach((d) => {
    const o = d.data();
    console.log(`  [${o.status}] ${o.courseId} ฿${o.amount} | สร้าง ${fmt(o.createdAt)} | จ่าย ${fmt(o.paidAt)} | order ${d.id}` +
      (o.lastFailReason ? ` | fail: ${o.lastFailReason}` : "") +
      (o.manualReview ? " | 🙋 ขอตรวจมือ" : "") +
      (o.uid ? ` | uid ${o.uid}` : ""));
  });

// ── สิทธิ์ (ทั้งจาก uid และจากอีเมล เผื่อสิทธิ์ไปอยู่คนละบัญชี) ──
const byEmail = await db.collection("userCourses").where("email", "==", email).get();
const byUid = user ? await db.collection("userCourses").where("userId", "==", user.uid).get() : { docs: [] };
const seen = new Set();
console.log(`\nสิทธิ์ userCourses:`);
let any = false;
for (const d of [...byUid.docs, ...byEmail.docs]) {
  if (seen.has(d.id)) continue;
  seen.add(d.id);
  any = true;
  const c = d.data();
  const mismatch = user && c.userId !== user.uid ? "  ⚠️ uid ไม่ตรงกับบัญชีที่ login!" : "";
  console.log(`  ${c.courseId} (${c.source ?? "?"} · ${c.activationCode ?? "-"}) เปิด ${fmt(c.activatedAt)} | userId ${c.userId}${mismatch}`);
}
if (!any) console.log("  (ไม่มีเลย)");
process.exit(0);
