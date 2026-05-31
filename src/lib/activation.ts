import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, runTransaction,
  serverTimestamp, increment, Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActivationCode {
  id:         string;
  code:       string;
  courseId:   string;
  courseName: string;
  status:     "active" | "inactive";
  maxUses:    number;    // 0 = unlimited
  usedCount:  number;
  expiresAt:  Date | null;
  createdAt:  Date;
}

export interface UserCourse {
  id:             string;
  userId:         string;
  email:          string;
  courseId:       string;
  courseName:     string;
  activatedAt:    Date;
  activationCode: string;
}

export type ActivationError =
  | "INVALID_CODE"
  | "INACTIVE"
  | "EXPIRED"
  | "MAX_USES"
  | "ALREADY_ACTIVATED"
  | "UNKNOWN";

export interface ActivationResult {
  success:     boolean;
  courseId?:   string;
  courseName?: string;
  error?:      ActivationError;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDate(v: unknown): Date {
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date)      return v;
  if (typeof v === "string")  return new Date(v);
  return new Date();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCode(id: string, d: Record<string, any>): ActivationCode {
  return {
    id,
    code:       String(d.code       ?? ""),
    courseId:   String(d.courseId   ?? ""),
    courseName: String(d.courseName ?? ""),
    status:     (d.status as "active" | "inactive") ?? "inactive",
    maxUses:    Number(d.maxUses    ?? 0),
    usedCount:  Number(d.usedCount  ?? 0),
    expiresAt:  d.expiresAt ? toDate(d.expiresAt) : null,
    createdAt:  toDate(d.createdAt),
  };
}

// ─── User-facing ──────────────────────────────────────────────────────────────

/**
 * Attempt to activate a code for the user.
 * Uses a Firestore transaction to atomically:
 *   1. Validate the code (re-checked inside tx)
 *   2. Create the userCourse document
 *   3. Increment usedCount on the code
 */
export async function activateCode(
  uid:   string,
  email: string,
  input: string
): Promise<ActivationResult> {
  const code = input.trim().toUpperCase();
  if (!code) return { success: false, error: "INVALID_CODE" };

  // ── Look up the code ───────────────────────────────────────────────────────
  const q    = query(collection(db, "activationCodes"), where("code", "==", code), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return { success: false, error: "INVALID_CODE" };

  const codeDocRef = snap.docs[0].ref;
  const codeData   = toCode(snap.docs[0].id, snap.docs[0].data());

  // ── Pre-checks (outside transaction, for fast UX feedback) ────────────────
  if (codeData.status !== "active")
    return { success: false, error: "INACTIVE" };
  if (codeData.expiresAt && codeData.expiresAt < new Date())
    return { success: false, error: "EXPIRED" };
  if (codeData.maxUses > 0 && codeData.usedCount >= codeData.maxUses)
    return { success: false, error: "MAX_USES" };

  // ── Check duplicate: has user already activated this courseId? ────────────
  const dupQ    = query(
    collection(db, "userCourses"),
    where("userId",   "==", uid),
    where("courseId", "==", codeData.courseId),
    limit(1)
  );
  const dupSnap = await getDocs(dupQ);
  if (!dupSnap.empty) return { success: false, error: "ALREADY_ACTIVATED" };

  // ── Atomic transaction ────────────────────────────────────────────────────
  const newCourseRef = doc(collection(db, "userCourses")); // pre-allocate ID

  try {
    await runTransaction(db, async (tx) => {
      // Re-read code inside transaction to prevent race conditions
      const freshSnap = await tx.get(codeDocRef);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fresh = freshSnap.data() as Record<string, any>;

      if ((fresh.status as string) !== "active")              throw new Error("INACTIVE");
      if ((fresh.maxUses as number) > 0 &&
          (fresh.usedCount as number) >= (fresh.maxUses as number))
        throw new Error("MAX_USES");

      tx.set(newCourseRef, {
        userId:         uid,
        email,
        courseId:       codeData.courseId,
        courseName:     codeData.courseName,
        activatedAt:    serverTimestamp(),
        activationCode: code,
      });
      tx.update(codeDocRef, { usedCount: increment(1) });
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "INACTIVE")  return { success: false, error: "INACTIVE" };
    if (msg === "MAX_USES")  return { success: false, error: "MAX_USES" };
    return { success: false, error: "UNKNOWN" };
  }

  return {
    success:    true,
    courseId:   codeData.courseId,
    courseName: codeData.courseName,
  };
}

/** Get all courses the user has activated. */
export async function getUserCourses(uid: string): Promise<UserCourse[]> {
  const q    = query(collection(db, "userCourses"), where("userId", "==", uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id:             d.id,
    ...(d.data() as Omit<UserCourse, "id" | "activatedAt">),
    activatedAt:    toDate(d.data().activatedAt),
  }));
}

/** Quick check: does user have at least one activated course? */
export async function checkUserHasAnyAccess(uid: string): Promise<boolean> {
  const q    = query(collection(db, "userCourses"), where("userId", "==", uid), limit(1));
  const snap = await getDocs(q);
  return !snap.empty;
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function getAllCodes(): Promise<ActivationCode[]> {
  const q    = query(collection(db, "activationCodes"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toCode(d.id, d.data()));
}

export interface CreateCodeInput {
  code:       string;
  courseId:   string;
  courseName: string;
  maxUses:    number;
  expiresAt:  Date | null;
}

export async function createCode(data: CreateCodeInput): Promise<string> {
  const code = data.code.trim().toUpperCase();
  if (!code) throw new Error("EMPTY_CODE");

  // Uniqueness check
  const dup = await getDocs(
    query(collection(db, "activationCodes"), where("code", "==", code), limit(1))
  );
  if (!dup.empty) throw new Error("CODE_EXISTS");

  const ref = await addDoc(collection(db, "activationCodes"), {
    code,
    courseId:   data.courseId.trim(),
    courseName: data.courseName.trim(),
    status:     "active",
    maxUses:    data.maxUses,
    usedCount:  0,
    expiresAt:  data.expiresAt ?? null,
    createdAt:  serverTimestamp(),
  });
  return ref.id;
}

export async function setCodeStatus(codeId: string, status: "active" | "inactive"): Promise<void> {
  await updateDoc(doc(db, "activationCodes", codeId), { status });
}

export async function deleteCode(codeId: string): Promise<void> {
  await deleteDoc(doc(db, "activationCodes", codeId));
}

/** Get users who activated a specific code (by codeId). */
export async function getCodeUsers(code: string): Promise<UserCourse[]> {
  const q    = query(collection(db, "userCourses"), where("activationCode", "==", code));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id:             d.id,
    ...(d.data() as Omit<UserCourse, "id" | "activatedAt">),
    activatedAt:    toDate(d.data().activatedAt),
  }));
}

/** Get a single activation code document by Firestore ID. */
export async function getCode(codeId: string): Promise<ActivationCode | null> {
  const snap = await getDoc(doc(db, "activationCodes", codeId));
  if (!snap.exists()) return null;
  return toCode(snap.id, snap.data());
}
