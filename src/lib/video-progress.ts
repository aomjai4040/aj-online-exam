/**
 * video-progress.ts — ความคืบหน้าการดูวิดีโอต่อผู้ใช้
 * users/{uid}/videoProgress/{videoId} (owner read/write ตาม rules subcol เดิม)
 *
 * completed = ดูถึง ≥90% หรือเล่นจนจบ — ติดแล้วไม่ถอดกลับ (ดูซ้ำไม่ทำให้กลับเป็นไม่จบ)
 */

import { collection, doc, getDocs, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export interface VideoProgress {
  seconds:   number;  // ตำแหน่งล่าสุด (วินาที)
  duration:  number;
  completed: boolean;
}

export async function getAllVideoProgress(uid: string): Promise<Map<string, VideoProgress>> {
  const snap = await getDocs(collection(db, "users", uid, "videoProgress"));
  const map = new Map<string, VideoProgress>();
  snap.docs.forEach((d) => {
    const x = d.data();
    map.set(d.id, {
      seconds:   Number(x.seconds ?? 0),
      duration:  Number(x.duration ?? 0),
      completed: Boolean(x.completed ?? false),
    });
  });
  return map;
}

export async function saveVideoProgress(
  uid: string, videoId: string,
  seconds: number, duration: number, completedNow: boolean,
): Promise<void> {
  const completed = completedNow || (duration > 0 && seconds / duration >= 0.9);
  await setDoc(doc(db, "users", uid, "videoProgress", videoId), {
    seconds:   Math.floor(seconds),
    duration:  Math.floor(duration),
    // merge:true + เงื่อนไขนี้ทำให้ completed ที่เคย true ไม่ถูกเขียนทับเป็น false
    ...(completed ? { completed: true } : {}),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}
