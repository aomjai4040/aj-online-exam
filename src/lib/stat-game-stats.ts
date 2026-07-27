/**
 * stat-game-stats.ts — สถิติสูงสุดของ "โหมดเกม" ต่อผู้ใช้
 * เก็บที่ users/{uid}/gameStats/stat-game (rules: เจ้าของอ่าน/เขียนได้อยู่แล้ว)
 */
import { doc, getDoc, setDoc, serverTimestamp, increment } from "firebase/firestore";
import { db } from "./firebase";

export interface StatGameBest {
  bestScore:  number;
  bestStreak: number;
}

function ref(uid: string) {
  return doc(db, "users", uid, "gameStats", "stat-game");
}

export async function getStatGameBest(uid: string): Promise<StatGameBest> {
  try {
    const snap = await getDoc(ref(uid));
    const x = snap.data() ?? {};
    return { bestScore: Number(x.bestScore ?? 0), bestStreak: Number(x.bestStreak ?? 0) };
  } catch {
    return { bestScore: 0, bestStreak: 0 };
  }
}

/** บันทึกจบเกม — อัปเดต best เฉพาะเมื่อทำได้ดีกว่าเดิม, นับจำนวนรอบที่เล่นเสมอ */
export async function saveStatGameRun(
  uid: string, score: number, streak: number, prev: StatGameBest
): Promise<void> {
  await setDoc(ref(uid), {
    bestScore:  Math.max(score, prev.bestScore),
    bestStreak: Math.max(streak, prev.bestStreak),
    plays:      increment(1),
    updatedAt:  serverTimestamp(),
  }, { merge: true }).catch(() => {});
}
