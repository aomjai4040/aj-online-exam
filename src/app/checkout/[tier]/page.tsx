"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { useLoginGuard } from "@/lib/use-login-guard";
import { tierPlan, type OrderTier } from "@/lib/order-types";
import { BRAND } from "@/lib/subjects";
import { DCD_INTAKE, intakeComplete, type IntakeAnswers } from "@/lib/dcd-intake";
import AccessGuardSpinner from "@/components/AccessGuardSpinner";
import CourseResources from "@/components/CourseResources";
import LineJoinButton from "@/components/LineJoinButton";
import DriveFilesButton from "@/components/DriveFilesButton";

// ─── /checkout/[tier] — จ่ายเงินในเว็บ (PromptPay + อัปสลิป → ตรวจอัตโนมัติ) ────

type Phase = "loading" | "intake" | "qr" | "verifying" | "success" | "owned" | "error";

const TIERS: OrderTier[] = ["app", "review", "full", "upgrade", "up-review", "up-full2", "dcd", "dcd-app", "up-dcd"];

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result)); // data:image/...;base64,....
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function CheckoutPage() {
  const guard    = useLoginGuard();
  const { user } = useAuth();
  const router   = useRouter();
  const { tier } = useParams<{ tier: string }>();
  const fileRef  = useRef<HTMLInputElement>(null);

  const [phase,   setPhase]   = useState<Phase>("loading");
  const [order,   setOrder]   = useState<{
    orderId: string; amount: number; qr: string; courseName: string;
    fullAmount?: number; discountAmount?: number; discountCode?: string;
  } | null>(null);
  const [error,   setError]   = useState("");
  const [okName,  setOkName]  = useState("");

  // โค้ดส่วนลด (ได้จากการทำแบบประเมินที่ /feedback)
  const [codeInput, setCodeInput] = useState("");
  const [codeBusy,  setCodeBusy]  = useState(false);
  const [codeErr,   setCodeErr]   = useState("");

  const validTier = TIERS.includes(tier as OrderTier);
  const plan = validTier ? tierPlan(tier as OrderTier) : null;

  // แบบสอบถามก่อนจ่าย (เฉพาะคอร์ส คร.)
  const [intake, setIntake] = useState<IntakeAnswers>({});

  const createOrderNow = useCallback(async (intakeAnswers?: IntakeAnswers) => {
    if (!user) return;
    setPhase("loading");
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tier, intake: intakeAnswers }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "สร้างคำสั่งซื้อไม่สำเร็จ"); setPhase("error"); return; }
      setOrder(data);
      setPhase("qr");
    } catch { setError("สร้างคำสั่งซื้อไม่สำเร็จ กรุณาลองใหม่"); setPhase("error"); }
  }, [user, tier]);

  // ถาม server ก่อนเสมอว่า "มีคอร์สแล้วหรือยัง / มีออเดอร์ค้างไหม"
  //
  // เดิมเช็คแค่ localStorage → คนที่จ่ายเงินไปแล้วเปิดหน้านี้อีกครั้ง
  // (หรือเปลี่ยนเครื่อง/ล้างแคช) โดนถามแบบสอบถามซ้ำ แล้วค่อยขึ้น error
  // ตอนกดต่อ — Aj แจ้งเคสนี้ 17 ส.ค. 69
  useEffect(() => {
    if (guard !== "allowed" || !user || !validTier) return;
    let cancelled = false;

    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/checkout?tier=${tier}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        const d = await res.json();

        if (res.ok && d.owned)   { setPhase("owned"); return; }
        if (res.ok && d.pending) { setOrder(d.pending); setPhase("qr"); return; }
        if (res.ok && (tier === "dcd" || tier === "dcd-app") && !d.intakeDone) { setPhase("intake"); return; }
      } catch { /* ถามไม่ได้ก็ไปทางเดิม ไม่บล็อกการขาย */ }
      if (!cancelled) createOrderNow();
    })();

    return () => { cancelled = true; };
  }, [guard, user, tier, validTier, createOrderNow]);

  function submitIntake() {
    if (!intakeComplete(intake)) return;
    createOrderNow(intake);
  }

  /** ใส่โค้ด → ยอดใหม่ + QR ใหม่ (ยอดฝังใน QR ต้องตรงกับยอดที่ต้องโอน) */
  async function applyCode() {
    if (!user || !order || codeBusy || !codeInput.trim()) return;
    setCodeBusy(true); setCodeErr("");
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/checkout/code", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId: order.orderId, code: codeInput }),
      });
      const d = await res.json();
      if (!res.ok) { setCodeErr(d.error ?? "ใช้โค้ดไม่สำเร็จ"); return; }
      setOrder({ ...order, amount: d.amount, qr: d.qr,
        fullAmount: d.fullAmount, discountAmount: d.discountAmount, discountCode: d.code });
      setCodeInput("");
    } catch { setCodeErr("ใช้โค้ดไม่สำเร็จ ลองใหม่อีกครั้ง"); }
    finally { setCodeBusy(false); }
  }

  async function removeCode() {
    if (!user || !order || codeBusy) return;
    setCodeBusy(true); setCodeErr("");
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/checkout/code", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId: order.orderId }),
      });
      const d = await res.json();
      if (!res.ok) { setCodeErr(d.error ?? "ยกเลิกโค้ดไม่สำเร็จ"); return; }
      setOrder({ ...order, amount: d.amount, qr: d.qr,
        fullAmount: undefined, discountAmount: undefined, discountCode: undefined });
    } catch { setCodeErr("ยกเลิกโค้ดไม่สำเร็จ"); }
    finally { setCodeBusy(false); }
  }

  // นับครั้งที่สลิปไม่ผ่าน → เปิดทางส่งให้แอดมินตรวจเอง (กันคนคิดว่าจ่ายพลาดแล้วโอนซ้ำ)
  const [failCount,  setFailCount]  = useState(0);
  const [manualSent, setManualSent] = useState(false);
  const [manualBusy, setManualBusy] = useState(false);

  async function handleSlip(file: File) {
    if (!user || !order) return;
    setPhase("verifying");
    setError("");
    try {
      const slip  = await fileToBase64(file);
      const token = await user.getIdToken();
      const res = await fetch("/api/submit-slip", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId: order.orderId, slip }),
      });
      const data = await res.json();
      if (data.ok) { setOkName(data.courseName); setPhase("success"); }
      else {
        setError(data.reason ?? "ตรวจสลิปไม่ผ่าน");
        setFailCount((c) => c + 1);
        setPhase("qr");
      }
    } catch { setError("เกิดข้อผิดพลาด กรุณาลองใหม่"); setPhase("qr"); }
  }

  /** โอนแล้วจริงแต่ระบบตรวจไม่ผ่าน → ส่งเรื่องให้พี่อ้อมตรวจเอง (สลิปถึงมือแล้ว) */
  async function requestManualReview() {
    if (!user || !order || manualBusy) return;
    setManualBusy(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/manual-review", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId: order.orderId }),
      });
      if (res.ok) { setManualSent(true); setError(""); }
    } catch {}
    finally { setManualBusy(false); }
  }

  if (guard !== "allowed") return <AccessGuardSpinner />;

  if (!validTier) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-5 text-center">
        <p className="text-[15px] font-semibold text-gray-800">ไม่พบแพ็กเกจนี้</p>
        <Link href="/packages" className="btn-primary text-sm px-6 py-2.5">← ดูแพ็กเกจ</Link>
      </div>
    );
  }

  // ── มีคอร์สนี้อยู่แล้ว ────────────────────────────────────────────────────
  // จ่ายไปแล้วแต่เผลอกดเข้ามาอีก — พาเข้าคอร์สเลย ไม่ต้องถามแบบสอบถามซ้ำ
  // และห้ามให้จ่ายซ้ำเด็ดขาด
  if (phase === "owned") {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-5 text-center">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ backgroundColor: "#EBF5F3" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke={BRAND.primary}
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className="text-[22px] font-bold text-gray-900 mb-2">น้องมีคอร์สนี้แล้ว</h1>
        <p className="text-[14px] mb-1" style={{ color: "#A8A8A6" }}>
          ชำระเงินเรียบร้อยแล้ว ไม่ต้องจ่ายซ้ำนะคะ
        </p>
        <p className="text-[16px] font-bold mb-6" style={{ color: BRAND.primary }}>
          {plan?.courseName ?? ""}
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {tier === "dcd" && (
            <>
              <LineJoinButton field="dcd" label="เข้ากลุ่ม LINE คอร์ส คร." />
              <DriveFilesButton field="dcd" />
            </>
          )}
          <button onClick={() => router.push("/")}
            className="btn-primary w-full py-3 text-[14px]">เข้าหน้าเรียน</button>
          <button onClick={() => router.push("/exams")}
            className="btn-secondary w-full py-3 text-[14px]">ทำข้อสอบ</button>
        </div>
      </div>
    );
  }

  // ── สำเร็จ ────────────────────────────────────────────────────────────────
  if (phase === "success") {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-5 text-center">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ backgroundColor: "#EBF5F3" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke={BRAND.primary}
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className="text-[22px] font-bold text-gray-900 mb-2">ชำระเงินสำเร็จ!</h1>
        <p className="text-[14px] mb-1" style={{ color: "#A8A8A6" }}>ปลดล็อกเรียบร้อยแล้ว</p>
        <p className="text-[16px] font-bold mb-6" style={{ color: BRAND.primary }}>{okName}</p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {tier === "dcd" || tier === "up-dcd" ? (
            <>
              {/* คร. ติวเข้ม — เข้ากลุ่ม LINE ก่อน (ประกาศทุกอย่างอยู่ที่นั่น) แล้วค่อยเริ่มทำข้อสอบ */}
              <LineJoinButton field="dcd" label="เข้ากลุ่ม LINE คอร์ส คร. เลย" />
              <DriveFilesButton field="dcd" />
              <button onClick={() => router.push("/course/dcd")}
                className="btn-secondary w-full py-3 text-[14px]">เข้าหน้าคอร์ส</button>
              <p className="text-[12.5px] leading-relaxed mt-1" style={{ color: "#A8A8A6" }}>
                คลิปและข้อสอบเฉพาะสนามกรมควบคุมโรค พี่อ้อมจะทยอยเพิ่มให้
                มีของใหม่เมื่อไหร่แจ้งในกลุ่ม LINE ทุกครั้งนะคะ
              </p>
            </>
          ) : tier === "dcd-app" ? (
            <>
              {/* App Only คร. — ไม่มีกลุ่ม LINE/เอกสาร พาเข้าคอร์สเลย */}
              <button onClick={() => router.push("/course/dcd")}
                className="btn-primary w-full py-3 text-[14px]">เข้าหน้าคอร์ส — เริ่มทำข้อสอบ</button>
              <p className="text-[12.5px] leading-relaxed mt-1" style={{ color: "#A8A8A6" }}>
                แพ็กนี้ฝึกข้อสอบในแอปอย่างเดียว — อยากได้คลิปติว + กลุ่ม LINE
                อัปเกรดเป็นติวเข้มได้ทีหลัง จ่ายแค่ส่วนต่าง
              </p>
            </>
          ) : tier === "review" || tier === "up-review" ? (
            <>
              {/* แพ็กติวทบทวน: พาไปแผน 14 วัน + คลิปโค้งสุดท้าย (ไม่มีชีท/กลุ่ม LINE) */}
              <button onClick={() => router.push("/final-review")}
                className="btn-primary w-full py-3 text-[14px]">เข้าติวโค้งสุดท้าย 14 วัน</button>
              <button onClick={() => router.push("/exams")}
                className="btn-secondary w-full py-3 text-[14px]">ทำข้อสอบ</button>
            </>
          ) : tier !== "app" ? (
            <>
              <button onClick={() => router.push("/videos")}
                className="btn-primary w-full py-3 text-[14px]">ไปดูคอร์สวิดีโอ</button>
              <button onClick={() => router.push("/exams")}
                className="btn-secondary w-full py-3 text-[14px]">ทำข้อสอบ</button>
              {/* ชีทสรุป + กลุ่ม LINE สำหรับคอร์สเต็ม */}
              <div className="pt-2"><CourseResources compact /></div>
            </>
          ) : (
            <button onClick={() => router.push("/exams")}
              className="btn-primary w-full py-3 text-[14px]">เริ่มทำข้อสอบเลย</button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-16">
      <div className="max-w-lg mx-auto px-5 pt-8">
        <Link href="/packages" className="inline-flex items-center gap-1.5 text-[13px] mb-6"
          style={{ color: "#A8A8A6" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
            strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          แพ็กเกจ
        </Link>

        <h1 className="text-[20px] font-bold text-gray-900 mb-1">ชำระเงิน</h1>
        <p className="text-[13.5px] mb-6" style={{ color: "#A8A8A6" }}>
          {plan!.courseName} · <span className="font-bold" style={{ color: BRAND.primary }}>฿{plan!.amount}</span>
        </p>

        {phase === "intake" && (
          <>
            <div className="rounded-2xl px-4 py-3.5 mb-4"
              style={{ backgroundColor: "#EBF5F3", border: "1.5px solid #C3E5DE" }}>
              <p className="text-[13.5px] font-bold" style={{ color: "#0B4F48" }}>
                ก่อนชำระเงิน ขอถาม 4 ข้อสั้น ๆ (30 วินาที)
              </p>
              <p className="text-[12.5px] mt-0.5" style={{ color: "#0B6E65" }}>
                พี่อ้อมจะใช้จัดลำดับว่าติวเรื่องไหนก่อน ให้ตรงกับที่น้องกังวลที่สุด
              </p>
            </div>

            {DCD_INTAKE.map((q) => {
              const cur = intake[q.id];
              return (
                <div key={q.id} className="card-elev px-4 py-4 mb-3">
                  <p className="text-[14.5px] font-bold text-gray-900 leading-snug mb-0.5">
                    {q.title}
                  </p>
                  {q.sub && (
                    <p className="text-[12.5px] mb-2.5" style={{ color: "#A8A8A6" }}>{q.sub}</p>
                  )}
                  {!q.sub && <div className="mb-2.5" />}
                  <div className="space-y-2">
                    {q.choices.map((c) => {
                      const sel = q.multi
                        ? Array.isArray(cur) && cur.includes(c.value)
                        : cur === c.value;
                      return (
                        <button key={c.value} type="button"
                          onClick={() => setIntake((a) => {
                            if (!q.multi) return { ...a, [q.id]: c.value };
                            const arr = Array.isArray(a[q.id]) ? (a[q.id] as string[]) : [];
                            if (arr.includes(c.value))
                              return { ...a, [q.id]: arr.filter((x) => x !== c.value) };
                            if (q.max && arr.length >= q.max) return a;
                            return { ...a, [q.id]: [...arr, c.value] };
                          })}
                          className="w-full text-left rounded-xl px-4 py-3 transition-colors"
                          style={{
                            backgroundColor: sel ? "#EBF5F3" : "#FAFAF8",
                            border: `2px solid ${sel ? BRAND.primary : "#EBEBEA"}`,
                          }}>
                          <span className="text-[14.5px] leading-snug"
                            style={{ color: sel ? BRAND.primary : "#374151",
                                     fontWeight: sel ? 600 : 400 }}>
                            {c.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <button onClick={submitIntake} disabled={!intakeComplete(intake)}
              className="btn-primary w-full py-4 text-[15.5px] disabled:opacity-35">
              ไปหน้าชำระเงิน →
            </button>
            {!intakeComplete(intake) && (
              <p className="text-center text-[12.5px] mt-2" style={{ color: "#A8A8A6" }}>
                ตอบครบทุกข้อแล้วปุ่มจะกดได้เลย
              </p>
            )}
          </>
        )}

        {(phase === "loading") && (
          <div className="flex flex-col items-center gap-3 py-16">
            <div className="w-8 h-8 rounded-full border-2 animate-spin"
              style={{ borderColor: "#D0EDE9", borderTopColor: BRAND.primary }} />
            <p className="text-[13px]" style={{ color: "#A8A8A6" }}>กำลังสร้าง QR...</p>
          </div>
        )}

        {phase === "error" && (
          <div className="text-center py-16">
            <p className="text-[15px] font-semibold text-gray-800 mb-4">{error}</p>
            <button onClick={() => location.reload()} className="btn-primary text-sm px-6 py-2.5">ลองใหม่</button>
          </div>
        )}

        {order && (phase === "qr" || phase === "verifying") && (
          <>
            {/* QR */}
            <div className="card-elev p-6 text-center mb-4">
              <p className="text-[13px] font-semibold mb-3" style={{ color: "#0B6E65" }}>
                สแกนจ่ายด้วยแอปธนาคาร (พร้อมเพย์)
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={order.qr} alt="PromptPay QR" width={240} height={240}
                className="mx-auto rounded-xl" style={{ border: "1px solid #F3F2F0" }} />
              {order.discountCode ? (
                <>
                  <p className="text-[15px] mt-3 line-through" style={{ color: "#A8A8A6" }}>
                    ฿{order.fullAmount}
                  </p>
                  <p className="text-[26px] font-extrabold leading-tight" style={{ color: BRAND.primary }}>
                    ฿{order.amount}
                  </p>
                  <p className="text-[12.5px] font-semibold mt-0.5" style={{ color: "#15803D" }}>
                    ใช้โค้ด {order.discountCode} ลดไป ฿{order.discountAmount}
                  </p>
                </>
              ) : (
                <p className="text-[26px] font-extrabold mt-3" style={{ color: BRAND.primary }}>
                  ฿{order.amount}
                </p>
              )}
              <p className="text-[12px] mt-1" style={{ color: "#A8A8A6" }}>
                ยอดเงินถูกฝังใน QR แล้ว — สแกนแล้วโอนได้เลย
              </p>
            </div>

            {/* ── โค้ดส่วนลด ─────────────────────────────────────────────── */}
            <div className="card-elev px-4 py-4 mb-4">
              {order.discountCode ? (
                <div className="flex items-center gap-3">
                  <span className="text-[20px]">🎁</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-bold" style={{ color: "#15803D" }}>
                      ใช้โค้ด {order.discountCode} แล้ว
                    </p>
                    <p className="text-[12px]" style={{ color: "#A8A8A6" }}>
                      ลด ฿{order.discountAmount} · QR ด้านบนเป็นยอดใหม่แล้ว
                    </p>
                  </div>
                  <button onClick={removeCode} disabled={codeBusy}
                    className="text-[12.5px] font-medium px-3 py-1.5 rounded-lg flex-shrink-0"
                    style={{ backgroundColor: "#F5F5F3", color: "#A8A8A6" }}>
                    ยกเลิก
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-[13.5px] font-bold text-gray-800 mb-2">
                    มีโค้ดส่วนลดไหม
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={codeInput}
                      onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                      placeholder="เช่น AJ100-XXXXX"
                      autoCapitalize="characters" autoCorrect="off" spellCheck={false}
                      className="flex-1 min-w-0 rounded-xl px-3.5 py-3 text-[16px] tracking-wider"
                      style={{ border: "1.5px solid #EBEBEA", backgroundColor: "#FAFAF8" }} />
                    <button onClick={applyCode} disabled={codeBusy || !codeInput.trim()}
                      className="btn-primary px-5 text-[14.5px] disabled:opacity-40 flex-shrink-0">
                      {codeBusy ? "…" : "ใช้โค้ด"}
                    </button>
                  </div>
                  {codeErr && (
                    <p className="text-[12.5px] mt-2" style={{ color: "#DC2626" }}>{codeErr}</p>
                  )}
                  <p className="text-[12px] mt-2" style={{ color: "#A8A8A6" }}>
                    โค้ดจากการทำแบบประเมิน ดูได้ที่หน้า{" "}
                    <Link href="/feedback" className="underline">แบบประเมิน</Link>
                  </p>
                </>
              )}
            </div>

            {/* ขั้นตอน */}
            <div className="rounded-2xl px-4 py-3.5 mb-4 text-[12.5px] leading-relaxed"
              style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A", color: "#92400E" }}>
              <span className="font-bold">ขั้นตอน:</span> ① สแกน QR จ่ายเงิน → ② บันทึกภาพสลิป →
              ③ กดปุ่มด้านล่างเพื่ออัปสลิป — ระบบตรวจอัตโนมัติและปลดล็อกทันที
            </div>

            {manualSent ? (
              <div className="rounded-xl px-4 py-3.5 mb-4"
                style={{ backgroundColor: "#F0FDF4", border: "1.5px solid #BBF7D0" }}>
                <p className="text-[13.5px] font-bold mb-1" style={{ color: "#15803D" }}>
                  ✓ ส่งเรื่องถึงพี่อ้อมแล้ว — ไม่ต้องโอนซ้ำนะคะ
                </p>
                <p className="text-[12.5px] leading-relaxed" style={{ color: "#166534" }}>
                  สลิปที่อัปโหลดไว้ถึงมือพี่อ้อมเรียบร้อย พี่อ้อมตรวจแล้วจะปลดล็อกคอร์สให้เลย
                  (ปกติภายในไม่กี่ชั่วโมง) — เข้าแอปมาเช็คได้ ปลดล็อกแล้วเมนูจะเปิดเอง
                </p>
              </div>
            ) : error && (
              <div className="rounded-xl px-4 py-3.5 mb-4"
                style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA" }}>
                <p className="text-[13px] font-bold mb-1.5" style={{ color: "#DC2626" }}>{error}</p>
                <ul className="text-[12.5px] leading-relaxed space-y-1" style={{ color: "#B91C1C" }}>
                  <li>• ใช้รูปสลิปเต็มใบที่บันทึกจากแอปธนาคาร (ไม่ใช่ภาพถ่ายหน้าจอที่ถูกครอป)</li>
                  <li>• ยอดโอนต้องตรง ฿{order.amount} พอดี — ถ้าจะใส่โค้ดส่วนลด ต้องใส่ก่อนสแกนโอน</li>
                  <li>• สลิป 1 ใบใช้ได้ครั้งเดียว ใช้ซ้ำจากออเดอร์อื่นไม่ได้</li>
                </ul>
                {failCount >= 1 && (
                  <button onClick={requestManualReview} disabled={manualBusy}
                    className="mt-3 w-full py-2.5 rounded-xl text-[13.5px] font-bold disabled:opacity-60"
                    style={{ backgroundColor: "white", border: "1.5px solid #DC2626", color: "#DC2626" }}>
                    {manualBusy ? "กำลังส่งเรื่อง…" : "โอนเงินแล้วแน่นอน → ส่งให้พี่อ้อมตรวจเอง"}
                  </button>
                )}
              </div>
            )}

            <input ref={fileRef} type="file" accept="image/*" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSlip(f); }} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={phase === "verifying"}
              className="btn-primary w-full py-3.5 text-[15px] flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {phase === "verifying" ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  กำลังตรวจสลิป…
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
                    strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  อัปโหลดสลิป → ตรวจอัตโนมัติ
                </>
              )}
            </button>

            <p className="text-center text-[11.5px] mt-4" style={{ color: "#C4C4C0" }}>
              จ่ายไม่สำเร็จ? ทัก LINE แอดมินได้ที่หน้าแพ็กเกจ
            </p>
          </>
        )}
      </div>
    </div>
  );
}
