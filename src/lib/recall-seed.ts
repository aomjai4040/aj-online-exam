/**
 * recall-seed.ts — ข้อสอบ สป.สธ. 2569 (สอบ 15 ส.ค. 2569) ฉบับความทรงจำ
 *
 * ที่มา: น้อง ๆ ในคอร์สช่วยกันจำมาให้หลังออกจากห้องสอบ (ไฟล์ "แนวข้อสอบสป สธ 69.pdf")
 * นี่ไม่ใช่ต้นฉบับข้อสอบ — เป็นการบันทึกจากความทรงจำ ยังไม่ผ่านการตรวจสอบ
 *
 * ใช้เป็นโครงตั้งต้นของหน้า /recall ให้สมาชิกช่วยกันเติมส่วนที่ยังขาด
 * (ตัวเลือกที่หายไป / เฉลยที่ยังไม่มี) ขณะที่ความจำยังสด
 *
 * เติมข้อใหม่ = เพิ่ม entry ท้าย RECALL_SEED (no เรียงต่อจากเดิม)
 */

import type { SubjectCode } from "./types";

/** สิ่งที่ยังขาดของข้อนั้น */
export type RecallGap = "stem" | "options" | "answer";

export const GAP_LABEL: Record<RecallGap, string> = {
  stem:    "ตัวโจทย์",
  options: "ตัวเลือก",
  answer:  "เฉลย",
};

export interface RecallSeedItem {
  no:       number;
  /** โจทย์เท่าที่จำกันได้ */
  text:     string;
  /** ตัวเลือกเท่าที่จำกันได้ — "" = ช่องที่ยังจำไม่ได้ */
  options:  string[];
  /** เฉลยเท่าที่จำกันได้ — "" = ยังไม่มี */
  answer:   string;
  subject:  SubjectCode;
  /** สิ่งที่ยังขาด — ว่าง = ข้อนี้ครบแล้ว */
  gaps:     RecallGap[];
  /** หมายเหตุของ Aj/ระบบ (เช่น ข้อซ้ำ) */
  note?:    string;
}

export const RECALL_SEED: RecallSeedItem[] = [
  { no: 1, subject: "BASIC", gaps: ["options", "answer"],
    text: "Prevalence Rate คืออะไร",
    options: ["ขนาดของปัญหา", "ความรุนแรง", "", ""], answer: "" },

  { no: 2, subject: "BASIC", gaps: ["options", "answer"],
    text: "อะไรคือความรุนแรง",
    options: ["", "Life Expectancy", "Relative Risk", "Case Fatality Rate"], answer: "" },

  { no: 3, subject: "LAWIT", gaps: ["answer"],
    text: "การใช้ AI แบบ Clinical Decision Support System (CDSS) คือข้อใด",
    options: ["ช่วยคิดเงินเดือนพนักงาน", "อ่าน x-ray ช่วยวินิจฉัยวัณโรค", "หุ่นยนต์ตรวจสอบสิทธิ", "แชทบอท"],
    answer: "" },

  { no: 4, subject: "BASIC", gaps: [],
    text: "สำรวจลูกน้ำยุงลาย บ้าน 20 หลัง สำรวจภาชนะ 40 ใบ พบลูกน้ำที่บ้าน 2 หลัง พบในภาชนะ 4 ใบ ถามหา HI และ CI",
    options: [], answer: "HI = 10, CI = 10" },

  { no: 5, subject: "CURRENT", gaps: [],
    text: "การเปลี่ยนมาจ่ายค่าบริการแบบ Co-payment ทำเพื่อแก้ปัญหาด้านใด",
    options: [], answer: "Moral Hazard" },

  { no: 6, subject: "APPLIED", gaps: ["options", "answer"],
    text: "นวก.สาสุข ต้องไปตรวจประจำปี แต่มีทรัพยากรและงบประมาณจำกัด ควรเลือกไปตรวจที่ไหน",
    options: [
      "ตรวจโรงน้ำแข็งที่เพิ่งได้รับอนุญาต",
      "ตรวจโรงอาหารที่ใช้อุณหภูมิต่ำ และส่งให้ผู้ป่วยใน รพ.",
      "โรงอาหารเด็กที่รีโนเวทใหม่ใน รร. ขนาดใหญ่",
      "",
    ], answer: "" },

  { no: 7, subject: "CURRENT", gaps: [],
    text: "QALY = Quality-Adjusted Life Year ใช้กับการวิเคราะห์แบบใด",
    options: [], answer: "CUA = Cost-Utility Analysis (การวิเคราะห์ต้นทุน-อรรถประโยชน์)" },

  { no: 8, subject: "APPLIED", gaps: ["answer"],
    text: "เมื่อพบผู้กินน้ำยาล้างห้องน้ำ ยังมีสติอยู่ จะทำสิ่งใดเป็นอันดับแรก",
    options: ["ส่งโรงพยาบาลทันที", "ดื่มน้ำ/นม", "ดื่มน้ำด่าง", "คนไข้ยังมีสติ ล้วงคอ"], answer: "" },

  { no: 9, subject: "APPLIED", gaps: [],
    text: "ตรวจคัดกรองสุขภาพ วัดความดันโลหิตได้ 120/80 mmHg ระดับน้ำตาลในเลือด 130 mg/dL ชายคนนี้มีภาวะเสี่ยงที่จะเกิดโรคอะไร",
    options: [], answer: "โรคเบาหวาน" },

  { no: 10, subject: "POLICY", gaps: ["options", "answer"],
    text: "ตามนโยบาย 30 บาท ครอบคลุมถึงอะไร",
    options: ["รักษาทุกโรค", "รักษาทุกที่", "", ""], answer: "" },

  { no: 11, subject: "CURRENT", gaps: [],
    text: "สินค้าสาธารณะ (Public goods) หมายถึงข้อใด",
    options: [], answer: "ไฟแสงสว่างสาธารณะ และการพ่นหมอกควันไล่ยุง (ข้ออื่นต้องเสียเงินซื้อบริการ)" },

  { no: 12, subject: "BASIC", gaps: [],
    text: "การกินหมูดิบ ทำให้เกิดโรคหูดับ ซึ่งเกิดจากเชื้ออะไร",
    options: [], answer: "Streptococcus suis" },

  { no: 13, subject: "APPLIED", gaps: [],
    text: "หากเกิดภาวะ Heat Stroke จะปฐมพยาบาลอย่างไร",
    options: [], answer: "ลดอุณหภูมิร่างกาย (ตัวเลือกอื่นมี 'เข้าห้องแอร์')" },

  { no: 14, subject: "CURRENT", gaps: [],
    text: "Super Aged Society คือข้อใด",
    options: [], answer: "ผู้มีอายุ 65 ปีขึ้นไป 20%" },

  { no: 15, subject: "MOPH", gaps: [],
    text: "นโยบายกระทรวงสาธารณสุข",
    options: [], answer: "MOPH Plus+" },

  { no: 16, subject: "BASIC", gaps: [],
    text: "ให้ระดับคะแนนการให้ความรู้ก่อนและหลังการอบรม ของผู้เข้าอบรม 10 คน ได้ 4,5,6,3,5,4,4,2,3,4 หาคะแนนเฉลี่ย",
    options: [], answer: "4 (รวม 40 คะแนน)" },

  { no: 17, subject: "BASIC", gaps: ["answer"],
    text: "ข้อใดไม่ใช่โรคจากการประกอบอาชีพ",
    options: [
      "พยาบาลติดวัณโรคจากผู้ป่วย",
      "คนเก็บของเก่าถูกแก้วบาด",
      "นักมวยมีปัญหาโรคระบบประสาท",
      "เป็นโรคกระเพาะจากการเข้ากะ",
    ], answer: "" },

  { no: 18, subject: "APPLIED", gaps: [],
    text: "โรงงานหนึ่งเครื่องปั่นไฟเกิดปัญหา วัดระดับเสียงได้เกิน 95 dBA มีพนักงานฝ่ายบรรจุสินค้าทำงานบริเวณนั้น 20 คน ควรดำเนินการอย่างไรเป็นลำดับแรก",
    options: [], answer: "ซ่อมแซมเครื่องจักร (ตัวเลือกอื่นควบคุมที่ตัวบุคคลกับทางผ่าน)" },

  { no: 19, subject: "LAWIT", gaps: ["options", "answer"],
    text: "ถ้าถูก Ransomware เรียกค่าไถ่ ขณะนั้นโรงพยาบาลไม่สามารถใช้ข้อมูลผู้ป่วยได้เลย คือความเสียหายด้านใด",
    options: ["Confidentiality", "Availability", "Authority", ""], answer: "" },

  { no: 20, subject: "APPLIED", gaps: ["answer"],
    text: "ตรวจประเมินตลาดนัดชุมชน พบแผงลอยจำหน่ายอาหารทะเลสดใช้สารฟอร์มาลีนแช่ปลาและปลาหมึก ทดสอบด้วย Test kit ได้ Positive ชัดเจน ท่านจะดำเนินมาตรการและใช้กฎหมายอย่างไร",
    options: [
      "อนุญาตให้จำหน่ายต่อไปได้ แต่ต้องล้างน้ำสะอาดหลาย ๆ ครั้งก่อนส่งมอบผู้บริโภค",
      "แนะนำให้ผู้ขายเปลี่ยนไปซื้ออาหารทะเลจากเจ้าอื่นแทนในวันพรุ่งนี้",
      "เขียนใบเตือนให้ปรับปรุงตัวภายใน 30 วัน หากตรวจซ้ำแล้วยังพบ จึงเริ่มดำเนินการยึดสินค้า",
      "ยึดทำลายสินค้าล็อตนั้นทันที สั่งห้ามจำหน่ายสินค้าแผงลอยดังกล่าว และประสานท้องถิ่น",
    ], answer: "" },

  { no: 21, subject: "APPLIED", gaps: ["answer"],
    text: "ร้านอาหารต้มน้ำกระท่อมขาย และนำกัญชาใส่ในก๋วยเตี๋ยวโดยไม่แจ้งผู้มารับประทาน นักเรียนที่ไปทานเกิดอาการข้างเคียง หัวใจเต้นเร็ว ใจสั่น จะมีมาตรการแก้ไขอย่างไร",
    options: [], answer: "" },

  { no: 22, subject: "BASIC", gaps: [],
    text: "หัวหน้าสั่งงานเกี่ยวกับการเก็บรักษาสารเคมี การปฐมพยาบาล และข้อมูลสารเคมี ต้องใช้เอกสารอะไร",
    options: [], answer: "SDS (Safety Data Sheet)" },

  { no: 23, subject: "APPLIED", gaps: ["options", "answer"],
    text: "ข้อใดคือการติดตาม และข้อใดคือการประเมินผล (ให้ตัวเลือกมาวิเคราะห์)",
    options: [], answer: "" },

  { no: 24, subject: "POLICY", gaps: [],
    text: "ข้อใดไม่เกี่ยวกับ Health for Wealth",
    options: [], answer: "สถานบริการสุขภาพ (ข้ออื่นเป็นสมุนไพร)" },

  { no: 25, subject: "LAWIT", gaps: [],
    text: "ระบบ 43 แฟ้ม มีวัตถุประสงค์อะไรในหน่วยงานปฐมภูมิ",
    options: [], answer: "บันทึกข้อมูลการดำเนินการสร้างเสริมสุขภาพ ป้องกันโรค ส่งข้อมูลออกระบบกลาง" },

  { no: 26, subject: "BASIC", gaps: ["answer"],
    text: "ส้วมใช้สารเคมีอะไร",
    options: ["H2SO4", "HCl", "NaOH", "NO2"], answer: "" },

  { no: 27, subject: "BASIC", gaps: ["options", "answer"],
    text: "กระบวนการนำเศษอาหารไปหมักทำปุ๋ย โดยทำเป็นระบบเปิด (ไม่ได้ปิดฝา) จะได้ก๊าซอะไรไปใช้ประโยชน์",
    options: ["CH4 ใช้เป็นเชื้อเพลิง", "CO2 ใช้เป็นเชื้อเพลิง", "H2S ใช้เป็นเชื้อเพลิง", ""], answer: "" },

  { no: 28, subject: "BASIC", gaps: [],
    text: "ให้เหตุการณ์มา น่าจะเป็นการกินอาหาร ให้หา RR — กิน: ป่วย 84 ไม่ป่วย 126 / ไม่กิน: ป่วย 28 ไม่ป่วย 172",
    options: [], answer: "3" },

  { no: 29, subject: "BASIC", gaps: ["answer"],
    text: "อาหารในข้อใดไม่ใช้ชุดตรวจ SI-2",
    options: ["ต้มยำ", "ผักสลัด", "ปลาทอด", "ผัดผักรวม"], answer: "" },

  { no: 30, subject: "BASIC", gaps: [],
    text: "ขั้นตอนการผลิตน้ำประปาเทศบาล",
    options: [], answer: "ตะแกรง / เติมสารเคมี / ตกตะกอน / ฆ่าเชื้อโรค (ข้ออื่นสลับไปมา มีการเติมอากาศ)" },

  { no: 31, subject: "LAWIT", gaps: [],
    text: "ข้อใดเป็นการกระทำที่ผิด พ.ร.บ. คอมพิวเตอร์ พ.ศ. 2550",
    options: [], answer: "แอบเข้าคอมพิวเตอร์ผู้อื่น แล้วแอบส่งข้อมูลเข้ามือถือ" },

  { no: 32, subject: "BASIC", gaps: [],
    text: "พบผู้ป่วยจากการสัมผัสสารเคมีกำจัดศัตรูพืช และป่วยเป็นโรคพาร์กินสัน มีการเลือกกลุ่มคนที่เป็นโรคพาร์กินสันมาแล้วศึกษาสาเหตุของการป่วย ซึ่งเป็นโรคหายาก ใช้รูปแบบการศึกษาอะไร",
    options: [], answer: "Case-Control" },

  { no: 33, subject: "APPLIED", gaps: [],
    text: "มาตรฐาน SAN Plus+ ต้องการปรับปรุงสิ่งใดเป็นอันดับแรก",
    options: [], answer: "ใช้จานจากชานอ้อย และจัดเตรียมอ่างล้างมือ" },

  { no: 34, subject: "MOPH", gaps: ["options", "answer"],
    text: "ข้อใดไม่ใช่วิสัยทัศน์ของปลัดกระทรวงสาธารณสุข",
    options: [], answer: "" },

  { no: 35, subject: "CURRENT", gaps: [],
    text: "หมอมีความไม่สมมาตรของข้อมูล (Information Asymmetry) กับคนป่วยทางการแพทย์ แบบนี้จะเกิดอะไรขึ้น",
    options: [], answer: "Supplier-Induced Demand (SID)" },

  { no: 36, subject: "MOPH", gaps: ["options", "answer"],
    text: "ข้อใดไม่ใช่พันธกิจของกระทรวงสาธารณสุข",
    options: [], answer: "" },

  { no: 37, subject: "POLICY", gaps: [],
    text: "โครงการของนายกอนุทิน",
    options: [], answer: "พยาบาลอาสา" },

  { no: 38, subject: "POLICY", gaps: [],
    text: "มีพยาบาลอาสาทำไม",
    options: [], answer: "ดูแลกลุ่มเปราะบาง ผู้สูงอายุ" },

  { no: 39, subject: "APPLIED", gaps: ["options", "answer"],
    text: "มีอาหารติดคอ ปฐมพยาบาลอย่างไร",
    options: [], answer: "" },

  { no: 40, subject: "APPLIED", gaps: ["answer"],
    text: "อาการใดที่ควรส่งต่อทันที",
    options: ["หายใจเร็ว", "ไอเจ็บหน้าอก", "เลือดไหลไม่หยุด", "หน้ามืด เป็นลม"], answer: "" },

  { no: 41, subject: "POLICY", gaps: ["options", "answer"],
    text: "นโยบายใดไม่เกี่ยวข้อง",
    options: ["วิ่งแลกแว่น", "โตไปไม่โกง", "นวดคลายเส้น", ""], answer: "" },

  { no: 42, subject: "BASIC", gaps: [],
    text: "การทำงานยกของหนัก และเอื้อมสุดแขน ทำแบบนี้ตลอดระยะเวลาการทำงาน ส่งผลให้เกิดอะไร",
    options: [], answer: "การทำงานผิดหลักการยศาสตร์ และทำงานซ้ำ ๆ เดิม" },

  { no: 43, subject: "APPLIED", gaps: [],
    text: "ทำวิจัยและแจ้งผู้เข้าร่วมโครงการถึงการรักษาความลับของข้อมูล เป็นข้อมูลเกี่ยวกับพฤติกรรมทางเพศ แต่หัวหน้าต้องการขอดูข้อมูลดังกล่าวเพื่อไปตักเตือน ควรทำอย่างไร",
    options: [], answer: "ปฏิเสธไม่ให้ดู (ตัวเลือกอื่นให้ดูแต่ให้เก็บเป็นความลับ)" },

  { no: 44, subject: "BASIC", gaps: [],
    text: "ตัวแปรต้นกับตัวแปรตาม ของความสัมพันธ์ระหว่างความรู้กับการป้องกันโรคพิษสุนัขบ้า",
    options: [], answer: "เป็นตัวแปรที่ใช้ศึกษาทั้งคู่ (ข้ออื่นสลับตัวแปรต้นกับตัวแปรตามหมด)" },

  { no: 45, subject: "BASIC", gaps: [],
    text: "รณรงค์ให้รู้ถึงความรุนแรงและภาวะแทรกซ้อน ตรงกับทฤษฎีอะไร",
    options: [], answer: "HBM (Health Belief Model)" },

  { no: 46, subject: "LAWIT", gaps: [],
    text: "รหัสโรคและรหัสหัตถการ",
    options: [], answer: "ICD-10 และ ICD-9" },

  { no: 47, subject: "LAWIT", gaps: [],
    text: "การวิเคราะห์ข้อมูลที่ยังมีความเสี่ยงกับเจ้าของข้อมูล ตรงกับข้อใด",
    options: [], answer: "ลบชื่อ-สกุลของผู้ป่วย แต่ยังมีวันเดือนปีเกิด รหัสไปรษณีย์ วันที่เข้ารับการรักษา (ข้ออื่นเป็นข้อมูลกว้าง ๆ)" },

  { no: 48, subject: "BASIC", gaps: [],
    text: "การทดสอบก่อน-หลัง การแจกแจงไม่ปกติ ใช้สถิติใด",
    options: [], answer: "Wilcoxon" },

  { no: 49, subject: "BASIC", gaps: ["options", "answer"],
    text: "ปัจจัยใดไม่เกี่ยวข้องกับการวินิจฉัยชุมชน",
    options: ["", "", "กลุ่มเป้าหมายและบุคคลที่เกี่ยวข้อง", "งบประมาณ"], answer: "" },

  { no: 50, subject: "BASIC", gaps: [],
    text: "การคัดกรองโรคเบาหวานและความดันโลหิตสูง เป็นการป้องกันโรคขั้นตอนใด",
    options: [], answer: "Secondary Prevention" },

  { no: 51, subject: "LAWIT", gaps: [],
    text: "ตาม พ.ร.บ. การปฏิบัติราชการทางอิเล็กทรอนิกส์ พ.ศ. 2565 สิ่งใดทำผ่านช่องทางออนไลน์ไม่ได้",
    options: [], answer: "บัตรประชาชนออนไลน์" },

  { no: 52, subject: "APPLIED", gaps: [],
    text: "หากพบเด็กเลือดกำเดาไหล ปฐมพยาบาลอย่างไร",
    options: [], answer: "ก้มหน้า บีบจมูก 10 นาที หายใจทางปาก" },

  { no: 53, subject: "LAWIT", gaps: [],
    text: "ตาม พ.ร.บ. วิชาชีพการสาธารณสุขชุมชน หากผู้ประกอบวิชาชีพนำข้อมูลผู้ป่วยไปเปิดเผยจนได้รับความเสียหาย จะได้รับโทษสูงสุดอย่างไร",
    options: [], answer: "เพิกถอนใบประกอบวิชาชีพ" },

  { no: 54, subject: "APPLIED", gaps: [],
    text: "การตั้งเป้าหมายตาม SMART Goal คือข้อใด",
    options: [], answer: "ลดอุบัติการณ์เกิดโรคเบาหวานรายใหม่ในเขตพื้นที่รับผิดชอบ 15% ใน 1 ปี" },

  { no: 55, subject: "BASIC", gaps: [],
    text: "การปล่อยน้ำเสียจากโรงงานผลิตปุ๋ยหรืออาหารสัตว์ลงแม่น้ำโดยไม่ได้รับการบำบัด ทำให้ธาตุอาหาร เช่น ไนโตรเจนและฟอสฟอรัส สะสมในน้ำจำนวนมาก ส่งผลให้เกิดอะไร",
    options: [], answer: "ยูโทรฟิเคชัน (Eutrophication)" },

  { no: 56, subject: "BASIC", gaps: ["answer"],
    text: "ข้อใดไม่ใช่กฎบัตรออตตาวา",
    options: [
      "สิ่งแวดล้อมเอื้อ",
      "พัฒนาทักษะบุคคล",
      "เสริมสร้างชุมชนเข้มแข็ง",
      "ความเสมอภาคและความไม่เท่าเทียมทางสังคม",
    ], answer: "" },

  { no: 57, subject: "BASIC", gaps: [],
    text: "สัตว์ปีกตาย ได้รับแจ้งจากเกษตรกร อสม. และสื่อสังคม จะเฝ้าระวังแบบไหน",
    options: [], answer: "Event-based Surveillance" },

  { no: 58, subject: "POLICY", gaps: [],
    text: "ผลักดัน พ.ร.บ. ที่เกี่ยวกับข้าราชการ ทำเพื่ออะไร",
    options: [], answer: "ขวัญกำลังใจคนทำงาน" },

  { no: 59, subject: "CURRENT", gaps: [],
    text: "ปัญหาสมองไหลของบุคลากรทางสาธารณสุข นอกจากเรื่องค่าตอบแทนมีปัญหาอะไร",
    options: [], answer: "ภาระงานหนัก ชีวิตไม่สมดุล" },

  { no: 60, subject: "LAWIT", gaps: ["options", "answer"],
    text: "ข้อใดเป็นการ Re-identification",
    options: [], answer: "" },

  { no: 61, subject: "BASIC", gaps: [],
    text: "ค่าพารามิเตอร์ คือค่าที่ได้จากอะไร",
    options: [], answer: "ประชากรทั้งหมด" },

  { no: 62, subject: "CURRENT", gaps: [],
    text: "ต้นทุนทางอ้อม คือข้อใด",
    options: [], answer: "ส่งผลกระทบต่อระบบเศรษฐกิจ ทำให้ขาดงาน ขาดรายได้ (มีตัวเลือกค่าเดินทาง)" },

  { no: 63, subject: "BASIC", gaps: [],
    text: "ผลิตภัณฑ์สุขภาพ หมายถึงข้อใด",
    options: [], answer: "อาหาร ยา เครื่องมือแพทย์ วัตถุอันตรายที่ใช้ในบ้าน" },

  { no: 64, subject: "MOPH", gaps: ["answer"],
    text: "โรงพยาบาล/หน่วยงานใดไม่ได้สังกัดสำนักงานปลัดกระทรวงสาธารณสุข",
    options: [
      "ศูนย์สาสุขมูลฐานห้วยกระทิง",
      "สำนักงานสาธารณสุขจังหวัดนนทบุรี",
      "โรงพยาบาลแม่ลาน้อย",
      "โรงพยาบาลสงขลา",
    ], answer: "" },

  { no: 65, subject: "LAWIT", gaps: ["options", "answer"],
    text: "โพสต์ด่าทวงหนี้ลง Facebook ข้อใดไม่ถูก",
    options: ["", "", "โทษจำคุก 5 ปี ปรับไม่เกิน 100,000 บาท", "ผิดทั้ง พ.ร.บ. คอมพิวเตอร์ และ PDPA"],
    answer: "" },

  { no: 66, subject: "APPLIED", gaps: [],
    text: "ร้านอาหารไม่ดักไขมัน ปล่อยลงท่อทำให้เกิดกลิ่นเหม็น จัดเป็นอะไร ใครจัดการ",
    options: [], answer: "เหตุรำคาญ — เจ้าพนักงานท้องถิ่น (เช่น นายกเทศมนตรี)" },

  { no: 67, subject: "BASIC", gaps: [],
    text: "ดัชนีวัดคุณภาพระหว่างประเทศ",
    options: [], answer: "LE = Life Expectancy" },

  { no: 68, subject: "CURRENT", gaps: ["stem", "options", "answer"],
    text: "ถามเกี่ยวกับสังคมสูงอายุ อัตราเกิดต่ำ (จำคำถามไม่ได้) — ตัวเลือกมีประชากรวัยทำงานลดลง ความต้องการรักษาลดลง งบลด วัยแรงงานลด",
    options: [], answer: "" },

  { no: 69, subject: "APPLIED", gaps: [],
    text: "ในฐานะนักวิชาการสาธารณสุขทำอะไร",
    options: [], answer: "ส่งเสริมป้องกันโรคให้ประชาชนทุกกลุ่ม (ข้ออื่นเป็นนโยบายระดับประเทศ/ผู้บริหาร)" },

  { no: 70, subject: "CURRENT", gaps: [],
    text: "Telehealth มีประโยชน์อย่างไร",
    options: [], answer: "ลดความเหลื่อมล้ำ" },

  { no: 71, subject: "APPLIED", gaps: ["answer"],
    text: "โรงพยาบาลโดนตัดงบ UC ลดลง 15% แต่คนป่วยมารักษามากขึ้น จะจัดการอย่างไร",
    options: [
      "เจรจาขอลดเงินเดือนบุคลากร",
      "ลดต้นทุนยา โดยการรวมซื้อยาแบบเขตสุขภาพ แต่คุณภาพยาคงดีเหมือนเดิม",
      "เก็บค่าบริการผู้ป่วย UC เพิ่ม",
      "จำกัดสิทธิ์รักษา UC ต่อวัน",
    ], answer: "" },

  { no: 72, subject: "BASIC", gaps: ["answer"],
    text: "วินิจฉัยชุมชน จัดลำดับของปัญหาเรียบร้อยแล้ว ขั้นตอนต่อมาคือ",
    options: [], answer: "" },

  { no: 73, subject: "BASIC", gaps: ["options", "answer"],
    text: "Health Literacy — ไม่ได้ถามความหมายตรงตัว ให้เหตุการณ์มาเลือกว่าอันไหนตรง",
    options: [], answer: "" },

  { no: 74, subject: "BASIC", gaps: ["answer"],
    text: "มีชุดข้อมูลมาให้ อายุ เพศ BMI คะแนนความรู้ (0-100) ถามว่าตัวไหนเป็นข้อมูลเชิงปริมาณ ตัวไหนเป็นเชิงคุณภาพ",
    options: [], answer: "" },

  { no: 75, subject: "LAWIT", gaps: ["options", "answer"],
    text: "ข้อไหนถือว่าทำตาม PDPA",
    options: ["สมคิดไม่ให้ข้อมูลกับประกัน", "", "", "สมชายถ่ายรูปครอบครัวลง Facebook โดยไม่ขออนุญาต"],
    answer: "" },

  { no: 76, subject: "BASIC", gaps: [],
    text: "การจัดตั้งชมรมผู้สูงอายุ อยู่ในหลักใดของออตตาวา",
    options: [], answer: "เสริมสร้างความเข้มแข็งในชุมชน" },

  { no: 77, subject: "LAWIT", gaps: [], note: "อาจเป็นข้อเดียวกับข้อ 51 — รอยืนยัน",
    text: "พ.ร.บ. การปฏิบัติราชการทางอิเล็กทรอนิกส์ สิ่งใดไม่สามารถทำได้",
    options: [], answer: "ทำบัตรประชาชนออนไลน์" },
];

// ─── เฉลยจากกลุ่มผู้เข้าสอบ (ยังไม่ยืนยัน) ────────────────────────────────────
//
// ที่มา: กลุ่ม LINE สาธารณะ "สอบนักวิชาการสาธารณสุข สปสธ." (1,075 คน) เย็นวันสอบ
// 15 ส.ค. 2569 — มีคนตั้ง "เฉลยเรียงข้อ" แล้วโพสต์ซ้ำให้คนช่วยยืนยัน
// เทียบ 2 เวอร์ชัน (16:55 กับ 21:26) เวอร์ชันหลังติ๊ก ✅ ข้อที่คนเห็นตรงกันมาก
//
// ⚠️ นี่คือ "เสียงส่วนใหญ่ของคนที่เพิ่งสอบ" ไม่ใช่เฉลยทางการ — ในกลุ่มเองก็บอกว่า
// "ดูเฉลยมาผิดเยอะเลยค่ะ" → ต้องให้ Aj ตรวจก่อนใช้ทุกข้อ (กดยืนยันที่ /admin/recall)

/** agree: high = ติ๊ก ✅ คนเห็นตรงกัน | low = ยังเถียงกัน/คนเดียวตอบ */
export interface CrowdAnswer {
  text:  string;
  agree: "high" | "low";
  /** จุดที่ขัดกับไฟล์ของน้องในคอร์ส หรือข้อสังเกตที่ต้องตรวจ */
  note?: string;
}

export const CROWD_ANSWERS: Record<number, CrowdAnswer> = {
  1:  { text: "ขนาดของปัญหา", agree: "high" },
  2:  { text: "", agree: "low",
        note: "กลุ่มยังตอบไม่ได้ และให้ตัวเลือกไม่ตรงกับไฟล์น้อง — กลุ่มว่า Incidence rate / Life expectancy / Relative risk / General fertility rate (ไม่มี CFR)" },
  3:  { text: "อ่าน x-ray ช่วยวินิจฉัยวัณโรค", agree: "high" },
  8:  { text: "ดื่มน้ำ/นม", agree: "high" },
  10: { text: "รักษาทุกที่", agree: "high" },
  17: { text: "คนเก็บของเก่าถูกแก้วบาด", agree: "low",
        note: "ในกลุ่มยังเถียงกับ 'นักมวย' และ 'โรคกระเพาะจากการเข้ากะ'" },
  19: { text: "Availability", agree: "high" },
  20: { text: "เขียนใบเตือนให้ปรับปรุงภายใน 30 วัน", agree: "low",
        note: "⚠️ กลุ่มยืนยันว่าฟอร์มาลีนออก 2 ข้อ (ดูข้อ 78) — ต้องแยกให้ชัดว่าข้อไหนตอบอะไร บางคนตอบ 'ยึดทันที'" },
  21: { text: "ร่วมมือกับหน่วยงานที่เกี่ยวข้อง ออกมาตรการ", agree: "high" },
  23: { text: "ตัวเลือก ค.", agree: "low",
        note: "กลุ่มจำได้แค่ว่า 'ตอบข้อที่ยาวที่สุด' — ยังไม่มีใครจำเนื้อตัวเลือกได้" },
  26: { text: "NaOH", agree: "high" },
  27: { text: "CH4 ใช้เป็นเชื้อเพลิง", agree: "high" },
  29: { text: "ต้มยำ", agree: "low",
        note: "เหตุผลจากคนทำงานจริงในกลุ่ม: SI-2 ไม่ใช้กับอาหารสีแดง/ส้ม และรสเปรี้ยว/เผ็ด" },
  30: { text: "ตะแกรง → เติมสารเคมี → ฆ่าเชื้อโรค → ถังน้ำใส", agree: "low",
        note: "⚠️ ขัดกับไฟล์น้องที่ว่า ตะแกรง/เติมสารเคมี/ตกตะกอน/ฆ่าเชื้อโรค — ลำดับต่างกัน ต้องฟันธง" },
  33: { text: "อบรมพนักงาน", agree: "low",
        note: "⚠️ ขัดกับไฟล์น้องที่ว่า 'ใช้จานจากชานอ้อย + จัดเตรียมอ่างล้างมือ'" },
  36: { text: "พัฒนาวัคซีนไข้เลือดออก", agree: "high" },
  37: { text: "พยาบาลอาสาประจำหมู่บ้าน", agree: "high" },
  39: { text: "ยืนด้านหลัง โอบมือกดที่ลิ้นปี่ (Heimlich maneuver)", agree: "high" },
  40: { text: "เลือดไหลไม่หยุด", agree: "low" },
  41: { text: "โตไปไม่โกง", agree: "high" },
  49: { text: "งบประมาณ", agree: "low",
        note: "หลายคนในกลุ่มถามยืนยันกันว่า 'ตอบงบประมาณไหม' แต่ยังไม่มีใครฟันธง" },
  56: { text: "ความเสมอภาคและความไม่เท่าเทียมทางสังคม", agree: "high" },
  60: { text: "ผู้ป่วยมะเร็งที่ลบชื่อออกแล้วยังระบุตัวได้", agree: "high" },
  64: { text: "ศูนย์สาสุขมูลฐานห้วยกระทิง", agree: "high" },
  65: { text: "แจ้งความออนไลน์", agree: "high" },
  73: { text: "เรียนรู้จากประสบการณ์", agree: "high" },
};

// ─── ข้อที่พบเฉพาะในแชท (ไม่มีในไฟล์ของน้อง) ────────────────────────────────
// เลข 78+ ต่อจากลิสต์เดิม — ที่มาเดียวกับ CROWD_ANSWERS

export const CHAT_ONLY_ITEMS: RecallSeedItem[] = [
  { no: 78, subject: "APPLIED", gaps: ["options", "answer"],
    note: "ฟอร์มาลีนข้อที่ 2 — กลุ่มยืนยันว่ามี 2 ข้อ (อีกข้อคือข้อ 20)",
    text: "ตรวจพบขายปลาหมึกที่มีสารฟอร์มาลีน เป็นอันตรายต่อสุขภาพมาก ควรทำอย่างไร",
    options: ["แจ้งตำรวจจับ", "สั่งยึดห้ามขายทันทีด้วยอำนาจสาธารณสุข", "ประสานหน่วยงาน แจ้ง…", ""],
    answer: "" },

  { no: 79, subject: "BASIC", gaps: ["answer"],
    note: "คนละข้อกับข้อ 57 (สัตว์ปีกตาย) — กลุ่มบอกมีเฝ้าระวัง 2 ข้อ",
    text: "การเฝ้าระวังในสถานการณ์ที่ยังไม่ยืนยันการระบาด แต่วางระบบไว้เฝ้าเฉพาะจุด",
    options: ["Passive Surveillance", "Active Surveillance", "Sentinel Surveillance", "Community-based Surveillance"],
    answer: "" },

  { no: 80, subject: "CURRENT", gaps: ["options", "answer"],
    note: "เป็นตัวโจทย์ของข้อ 68 ที่ไฟล์น้องจำไม่ได้",
    text: "ประชากรในวัยทำงานลดลง ส่งผลให้เกิดข้อใด",
    options: ["ความต้องการรักษาลดลง", "งบประมาณลดลง", "", "จำนวนผู้สูงอายุลดลง"],
    answer: "" },

  { no: 81, subject: "APPLIED", gaps: ["options", "answer"],
    text: "การควบคุมโรคระบาดของไข้เลือดออก ทำอะไรเป็นลำดับแรก",
    options: [], answer: "" },

  { no: 82, subject: "APPLIED", gaps: ["options"],
    text: "ได้รับมอบหมายให้จัดการโครงการไข้เลือดออก นักวิชาการสาธารณสุขควรทำอะไรเป็นอันดับแรก",
    options: [], answer: "จัดอบรมให้ความรู้การกำจัดลูกน้ำยุงลาย (คำตอบจากกลุ่ม ยังไม่ยืนยัน)" },

  { no: 83, subject: "APPLIED", gaps: ["options"],
    text: "ประเมินโครงการแล้วพบผู้สูงอายุมาฉีดวัคซีนไม่ตรงตามเป้าหมาย เพราะอยู่ไกล ควรทำอย่างไร",
    options: [], answer: "ปรับเปลี่ยนแผน เพิ่มหน่วยวัคซีนเคลื่อนที่ (คำตอบจากกลุ่ม ยังไม่ยืนยัน)" },

  { no: 84, subject: "POLICY", gaps: ["stem", "options", "answer"],
    note: "หลายคนจำได้ว่ามีตัวเลือก 'ใช้กัญชาในวัยรุ่น' ซึ่งเป็นตัวเลือกเชิงลบข้อเดียวในชุด",
    text: "(จำโจทย์ไม่ได้) ข้อที่มีตัวเลือกเกี่ยวกับการใช้กัญชาในวัยรุ่น",
    options: [], answer: "" },
];

/** ลิสต์เต็มที่ใช้แสดงผล = ไฟล์ของน้อง + ข้อที่เจอในแชท */
export const RECALL_ALL: RecallSeedItem[] = [...RECALL_SEED, ...CHAT_ONLY_ITEMS];

export function crowdAnswerFor(no: number): CrowdAnswer | undefined {
  const c = CROWD_ANSWERS[no];
  return c && c.text ? c : undefined;
}

/** หมายเหตุจากกลุ่มที่ต้องตรวจ แม้จะยังไม่มีเฉลย */
export function crowdNoteFor(no: number): string | undefined {
  return CROWD_ANSWERS[no]?.note;
}

// ─── Helpers (pure) ───────────────────────────────────────────────────────────

export function isComplete(item: RecallSeedItem): boolean {
  return item.gaps.length === 0;
}

/** ข้อที่ยังขาดอะไรบางอย่าง — เรียงตามความเร่งด่วน (ขาดมากขึ้นก่อน) */
export function incompleteItems(): RecallSeedItem[] {
  return RECALL_ALL
    .filter((i) => !isComplete(i))
    .sort((a, b) => b.gaps.length - a.gaps.length || a.no - b.no);
}

export function recallProgress() {
  const total     = RECALL_ALL.length;
  const complete  = RECALL_ALL.filter(isComplete).length;
  const noAnswer  = RECALL_ALL.filter((i) => i.gaps.includes("answer"));
  return {
    total,
    complete,
    incomplete: total - complete,
    percent:    Math.round((complete / total) * 100),
    noAnswer:   noAnswer.length,
    noOptions:  RECALL_ALL.filter((i) => i.gaps.includes("options")).length,
    /** ข้อที่ไม่มีเฉลย แต่กลุ่มเสนอคำตอบมาแล้ว → รอ Aj ยืนยันอย่างเดียว */
    withCrowd:  noAnswer.filter((i) => crowdAnswerFor(i.no)).length,
  };
}

/** จำนวนข้อต่อหมวด — ใช้ทำ "ผังข้อสอบจริง" */
export function seedBySubject(): [SubjectCode, number][] {
  const map = new Map<SubjectCode, number>();
  for (const i of RECALL_ALL) map.set(i.subject, (map.get(i.subject) ?? 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}
