/**
 * stat-game.ts — เกมเลือกสถิติ: เดิน decision tree จากโจทย์สถานการณ์ → สถิติที่ใช้
 *
 * โครงต้นไม้ (ตามหลักการเลือกสถิติมาตรฐานที่ใช้สอน วิจัย/ชีวสถิติ สธ.):
 *   ขั้น 1 วัตถุประสงค์: เปรียบเทียบ / หาความสัมพันธ์ / ทำนาย
 *   ขั้น 2 ชนิดข้อมูล (parametric / non-parametric / แจงนับ)
 *   ขั้น 3 ลักษณะกลุ่ม (1 กลุ่ม / 2 อิสระ / คู่ก่อน-หลัง / ≥3 กลุ่ม)
 *
 * การตัดสินถูก-ผิด: เทียบ "สถิติปลายทาง" ไม่ใช่เส้นทาง — บางสถิติไปถึงได้
 * หลายทางที่ถูกทั้งคู่ (เช่น Chi-square มองเป็นเปรียบเทียบสัดส่วน หรือ
 * ความสัมพันธ์ของตัวแปรแจงนับก็ได้) เฉลยจะโชว์เส้นทางแนะนำ + จุดสังเกตในโจทย์
 */

export interface StatInfo {
  id:   string;
  name: string;      // ชื่อที่ใช้เรียกในข้อสอบ
  hint: string;      // จุดสังเกต/เงื่อนไขการใช้ แบบย่อ
}

export const STATS: Record<string, StatInfo> = {
  "one-t":    { id: "one-t",    name: "One-sample t-test",
    hint: "เทียบค่าเฉลี่ย 1 กลุ่ม กับค่ามาตรฐาน/ค่าอ้างอิง · ข้อมูลต่อเนื่องแจกแจงปกติ" },
  "ind-t":    { id: "ind-t",    name: "Independent t-test",
    hint: "เทียบค่าเฉลี่ย 2 กลุ่มที่เป็นอิสระต่อกัน · ข้อมูลต่อเนื่องแจกแจงปกติ" },
  "paired-t": { id: "paired-t", name: "Paired t-test",
    hint: "เทียบค่าเฉลี่ยก่อน-หลังในคนกลุ่มเดียวกัน (ข้อมูลจับคู่) · แจกแจงปกติ" },
  "anova":    { id: "anova",    name: "One-way ANOVA",
    hint: "เทียบค่าเฉลี่ยตั้งแต่ 3 กลุ่มขึ้นไปที่อิสระต่อกัน · แจกแจงปกติ" },
  "mann":     { id: "mann",     name: "Mann-Whitney U test",
    hint: "คู่เทียบของ Independent t-test เมื่อข้อมูลไม่แจกแจงปกติ/เป็นอันดับ" },
  "wilcoxon": { id: "wilcoxon", name: "Wilcoxon signed-rank test",
    hint: "คู่เทียบของ Paired t-test เมื่อข้อมูลไม่แจกแจงปกติ/กลุ่มเล็ก" },
  "kruskal":  { id: "kruskal",  name: "Kruskal-Wallis test",
    hint: "คู่เทียบของ ANOVA (≥3 กลุ่มอิสระ) เมื่อข้อมูลไม่แจกแจงปกติ" },
  "chi":      { id: "chi",      name: "Chi-square test",
    hint: "ข้อมูลแจงนับ (ความถี่/สัดส่วน) — เทียบสัดส่วนระหว่างกลุ่ม หรือทดสอบความสัมพันธ์ของตัวแปรแจงนับ" },
  "pearson":  { id: "pearson",  name: "Pearson correlation",
    hint: "ความสัมพันธ์ของตัวแปรต่อเนื่อง 2 ตัว · แจกแจงปกติ · ได้ค่า r" },
  "spearman": { id: "spearman", name: "Spearman rank correlation",
    hint: "ความสัมพันธ์เมื่อข้อมูลเป็นอันดับ (เช่น Likert) หรือไม่แจกแจงปกติ" },
  "linreg":   { id: "linreg",   name: "Linear regression",
    hint: "สร้างสมการทำนายตัวแปรตามที่เป็นค่าต่อเนื่อง" },
  "logreg":   { id: "logreg",   name: "Logistic regression",
    hint: "ทำนายผลลัพธ์ 2 ค่า (เป็น/ไม่เป็นโรค) · ได้ Odds Ratio" },
};

export interface TreeOption { label: string; next?: string; stat?: string }
export interface TreeNode   { id: string; question: string; options: TreeOption[] }

export const TREE: Record<string, TreeNode> = {
  start: {
    id: "start",
    question: "โจทย์ต้องการทำอะไร?",
    options: [
      { label: "เปรียบเทียบความแตกต่าง (ค่าเฉลี่ย/สัดส่วน ระหว่างกลุ่มหรือกับค่ามาตรฐาน)", next: "cmp-data" },
      { label: "หาความสัมพันธ์ระหว่างตัวแปร 2 ตัว", next: "rel-data" },
      { label: "สร้างสมการทำนาย/หาปัจจัยที่มีผลต่อผลลัพธ์", next: "pre-data" },
    ],
  },
  "cmp-data": {
    id: "cmp-data",
    question: "ตัวแปรที่วัดผล (ตัวแปรตาม) เป็นข้อมูลแบบไหน?",
    options: [
      { label: "ต่อเนื่อง และแจกแจงปกติ (parametric)", next: "cmp-para" },
      { label: "ต่อเนื่อง/อันดับ แต่ไม่แจกแจงปกติ หรือกลุ่มเล็ก (non-parametric)", next: "cmp-nonpara" },
      { label: "แจงนับ — นับจำนวนคน/ความถี่/สัดส่วน", stat: "chi" },
    ],
  },
  "cmp-para": {
    id: "cmp-para",
    question: "เปรียบเทียบแบบไหน?",
    options: [
      { label: "1 กลุ่ม เทียบกับค่ามาตรฐาน/ค่าอ้างอิง", stat: "one-t" },
      { label: "2 กลุ่มที่อิสระต่อกัน", stat: "ind-t" },
      { label: "ก่อน-หลัง ในคนกลุ่มเดียวกัน (จับคู่)", stat: "paired-t" },
      { label: "3 กลุ่มขึ้นไปที่อิสระต่อกัน", stat: "anova" },
    ],
  },
  "cmp-nonpara": {
    id: "cmp-nonpara",
    question: "เปรียบเทียบแบบไหน?",
    options: [
      { label: "2 กลุ่มที่อิสระต่อกัน", stat: "mann" },
      { label: "ก่อน-หลัง ในคนกลุ่มเดียวกัน (จับคู่)", stat: "wilcoxon" },
      { label: "3 กลุ่มขึ้นไปที่อิสระต่อกัน", stat: "kruskal" },
    ],
  },
  "rel-data": {
    id: "rel-data",
    question: "ตัวแปรทั้งสองเป็นข้อมูลแบบไหน?",
    options: [
      { label: "ต่อเนื่องทั้งคู่ และแจกแจงปกติ", stat: "pearson" },
      { label: "เป็นอันดับ (เช่น Likert) หรือไม่แจกแจงปกติ", stat: "spearman" },
      { label: "แจงนับทั้งคู่ (เช่น เพศ × การสูบบุหรี่)", stat: "chi" },
    ],
  },
  "pre-data": {
    id: "pre-data",
    question: "ผลลัพธ์ที่ต้องการทำนายเป็นแบบไหน?",
    options: [
      { label: "ค่าต่อเนื่อง (เช่น น้ำหนัก ระดับน้ำตาล)", stat: "linreg" },
      { label: "2 ค่า — เป็น/ไม่เป็น เกิด/ไม่เกิด", stat: "logreg" },
    ],
  },
};

export interface Scenario {
  id:      string;
  text:    string;     // โจทย์สถานการณ์
  answer:  string;     // stat id ที่ถูก
  route:   number[];   // ลำดับ index ตัวเลือกจาก start ถึงสถิติ (ป้ายดึงจาก TREE — ไม่ drift)
  clue:    string;     // จุดสังเกตในโจทย์
}

export const SCENARIOS: Scenario[] = [
  {
    id: "s01", route: [0, 0, 2], answer: "paired-t",
    text: "นักวิชาการสาธารณสุขวัดความดันโลหิตของกลุ่มเสี่ยง 40 คน ก่อนและหลังเข้าโปรแกรมปรับเปลี่ยนพฤติกรรม 3 เดือน ข้อมูลแจกแจงปกติ ต้องการทดสอบว่าความดันลดลงจริงหรือไม่",
    clue: "คำว่า \"ก่อนและหลัง...ในคนกลุ่มเดียวกัน\" = ข้อมูลจับคู่ + แจกแจงปกติ → Paired t-test",
  },
  {
    id: "s02", route: [0, 0, 1], answer: "ind-t",
    text: "เปรียบเทียบคะแนนความรู้เรื่องไข้เลือดออกระหว่างหมู่บ้านที่ได้รับสื่อสุขศึกษา กับหมู่บ้านควบคุมที่ไม่ได้รับ กลุ่มละ 50 คน คะแนนแจกแจงปกติ",
    clue: "สองกลุ่มคนละหมู่บ้าน ไม่เกี่ยวข้องกัน = กลุ่มอิสระ + คะแนนปกติ → Independent t-test",
  },
  {
    id: "s03", route: [0, 0, 0], answer: "one-t",
    text: "สำรวจ BMI เฉลี่ยของ อสม. 45 คนในตำบลหนึ่ง ได้ 24.8 ต้องการทดสอบว่าแตกต่างจากค่าอ้างอิงของประชากรไทย (22.9) หรือไม่ ข้อมูลแจกแจงปกติ",
    clue: "มีกลุ่มเดียว เทียบกับ \"ค่าอ้างอิง/ค่ามาตรฐาน\" → One-sample t-test",
  },
  {
    id: "s04", route: [0, 0, 3], answer: "anova",
    text: "เปรียบเทียบคะแนนความพึงพอใจต่อบริการเฉลี่ยของผู้รับบริการ รพ.สต. 3 แห่ง แห่งละ 60 คน ข้อมูลแจกแจงปกติ ความแปรปรวนเท่ากัน",
    clue: "เทียบค่าเฉลี่ย 3 กลุ่มอิสระ + ปกติ → One-way ANOVA (ห้ามใช้ t-test ทีละคู่ เพราะ type I error เฟ้อ)",
  },
  {
    id: "s05", route: [0, 1, 0], answer: "mann",
    text: "เปรียบเทียบคะแนนความเครียด (แบบวัด 0–100 แจกแจงเบ้ขวาชัดเจน) ระหว่างเจ้าหน้าที่ รพ.สต. 2 อำเภอ กลุ่มละ 18 คน",
    clue: "\"เบ้ขวา\" = ไม่ปกติ + 2 กลุ่มอิสระ → Mann-Whitney U (คู่เทียบ Independent t-test)",
  },
  {
    id: "s06", route: [0, 1, 1], answer: "wilcoxon",
    text: "วัดคะแนนความรู้ก่อน-หลังอบรมของแกนนำสุขภาพ 12 คน ข้อมูลไม่แจกแจงปกติเพราะกลุ่มเล็ก ต้องการทดสอบว่าคะแนนเพิ่มขึ้นหรือไม่",
    clue: "ก่อน-หลังกลุ่มเดียว (จับคู่) + ไม่ปกติ/n เล็ก → Wilcoxon signed-rank (คู่เทียบ Paired t-test)",
  },
  {
    id: "s07", route: [0, 1, 2], answer: "kruskal",
    text: "เปรียบเทียบระยะเวลารอคอยรับบริการ (นาที ข้อมูลเบ้ขวามาก) ของผู้ป่วย 4 แผนกใน รพ. แห่งหนึ่ง",
    clue: "≥3 กลุ่มอิสระ + ไม่ปกติ → Kruskal-Wallis (คู่เทียบ ANOVA)",
  },
  {
    id: "s08", route: [1, 2], answer: "chi",
    text: "ศึกษาว่าเพศ (ชาย/หญิง) มีความสัมพันธ์กับพฤติกรรมการสูบบุหรี่ (สูบ/ไม่สูบ) ของนักเรียนมัธยม 400 คนหรือไม่",
    clue: "ตัวแปรแจงนับ × แจงนับ (ตาราง 2×2 นับจำนวนคน) → Chi-square test of independence",
  },
  {
    id: "s09", route: [0, 2], answer: "chi",
    text: "เปรียบเทียบอัตราความครอบคลุมวัคซีนในเด็ก (ได้รับครบ/ไม่ครบ) ระหว่างตำบล A และตำบล B จากทะเบียน 800 ราย",
    clue: "เทียบ \"สัดส่วน\" ระหว่าง 2 กลุ่ม = ข้อมูลแจงนับ → Chi-square (ไม่ใช่ t-test เพราะไม่ใช่ค่าเฉลี่ย)",
  },
  {
    id: "s10", route: [1, 0], answer: "pearson",
    text: "ศึกษาความสัมพันธ์ระหว่างจำนวนชั่วโมงออกกำลังกายต่อสัปดาห์ กับระดับน้ำตาลในเลือด (FBS) ของกลุ่มเสี่ยงเบาหวาน 120 คน ทั้งสองตัวแปรแจกแจงปกติ",
    clue: "\"ความสัมพันธ์\" + ต่อเนื่องทั้งคู่ + ปกติ → Pearson correlation (ได้ค่า r)",
  },
  {
    id: "s11", route: [1, 1], answer: "spearman",
    text: "หาความสัมพันธ์ระหว่างระดับความพึงพอใจ (Likert 5 ระดับ) กับระดับการมีส่วนร่วมในชุมชน (มาก/กลาง/น้อย) ของประชาชน 90 คน",
    clue: "ทั้งคู่เป็นข้อมูล \"อันดับ\" (ordinal) → Spearman rank correlation",
  },
  {
    id: "s12", route: [2, 0], answer: "linreg",
    text: "ต้องการสร้างสมการทำนายน้ำหนักแรกเกิดของทารก (กรัม) จากอายุครรภ์ของมารดา (สัปดาห์)",
    clue: "\"สร้างสมการทำนาย\" + ผลลัพธ์เป็นค่าต่อเนื่อง (กรัม) → Linear regression",
  },
  {
    id: "s13", route: [2, 1], answer: "logreg",
    text: "ศึกษาปัจจัย (อายุ BMI ประวัติครอบครัว) ที่มีผลต่อ \"การเกิดโรคเบาหวาน (เป็น/ไม่เป็น)\" ของประชากรกลุ่มเสี่ยง 500 คน และรายงานผลเป็น Odds Ratio",
    clue: "ผลลัพธ์ 2 ค่า + รายงาน Odds Ratio → Logistic regression",
  },
  {
    id: "s14", route: [0, 0, 2], answer: "paired-t",
    text: "ชั่งน้ำหนักพนักงาน 35 คนก่อนเริ่มและหลังจบโครงการลดน้ำหนัก 8 สัปดาห์ ข้อมูลแจกแจงปกติ ทดสอบว่าโครงการได้ผลหรือไม่",
    clue: "วัดซ้ำในคนเดิมก่อน-หลัง + ปกติ → Paired t-test",
  },
  {
    id: "s15", route: [0, 0, 3], answer: "anova",
    text: "เปรียบเทียบระดับความรอบรู้ด้านสุขภาพเฉลี่ย (คะแนนต่อเนื่อง แจกแจงปกติ) ของประชาชน 3 กลุ่มอายุ: วัยทำงาน วัยกลางคน และผู้สูงอายุ",
    clue: "3 กลุ่มอายุ (อิสระ) + ค่าเฉลี่ย + ปกติ → One-way ANOVA",
  },
];

/** แปลง route เป็นป้ายตัวเลือก (ตัดคำขยายในวงเล็บ) — ใช้โชว์ "เส้นทางแนะนำ" ในเฉลย */
export function routeLabels(route: number[]): string[] {
  const labels: string[] = [];
  let node = TREE.start;
  for (const idx of route) {
    const opt = node.options[idx];
    if (!opt) break;
    labels.push(opt.label.split(" (")[0]);
    if (opt.next) node = TREE[opt.next];
    else break;
  }
  return labels;
}

/** สุ่มลำดับโจทย์ (Fisher–Yates) */
export function shuffleScenarios(list: Scenario[] = SCENARIOS): Scenario[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
