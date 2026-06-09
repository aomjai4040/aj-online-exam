// ─────────────────────────────────────────────────────────────────────────────
// MOPH Focus — Types
// คลังประเด็นสำคัญเพื่อการสอบ สาธารณสุข
// ─────────────────────────────────────────────────────────────────────────────

// ── Preset Tags ───────────────────────────────────────────────────────────────

export const MOPH_TAGS = {
  QUICK_WIN:     "Quick Win",
  POLICY:        "นโยบาย",
  DIGITAL:       "Digital Health",
  PM25:          "PM2.5",
  MENTAL:        "สุขภาพจิต",
  DISEASE:       "โรคและภัยสุขภาพ",
  LAW:           "กฎหมาย",
  BUDGET:        "งบประมาณ",
  MOPH_ORG:      "สป.สธ.",
  MUST_KNOW:     "ข่าวที่ควรรู้",
} as const;

export type MOPHTag = typeof MOPH_TAGS[keyof typeof MOPH_TAGS];

export const MOPH_TAG_LIST = Object.values(MOPH_TAGS) as MOPHTag[];

// ── Tag Visual Tokens ─────────────────────────────────────────────────────────

export const MOPH_TAG_STYLE: Record<MOPHTag, {
  bg:    string;
  color: string;
  label: string;
}> = {
  "Quick Win":          { bg: "#FFFBEB", color: "#D97706", label: "⚡ Quick Win"         },
  "นโยบาย":             { bg: "#EFF6FF", color: "#2563EB", label: "🔵 นโยบาย"            },
  "Digital Health":     { bg: "#F5F3FF", color: "#7C3AED", label: "💻 Digital Health"    },
  "PM2.5":              { bg: "#F1F5F9", color: "#475569", label: "🌫 PM2.5"              },
  "สุขภาพจิต":          { bg: "#FDF4FF", color: "#A21CAF", label: "🧠 สุขภาพจิต"         },
  "โรคและภัยสุขภาพ":    { bg: "#FEF2F2", color: "#DC2626", label: "🦠 โรคและภัยสุขภาพ"   },
  "กฎหมาย":             { bg: "#ECFDF5", color: "#059669", label: "⚖️ กฎหมาย"            },
  "งบประมาณ":           { bg: "#FFF7ED", color: "#EA580C", label: "💰 งบประมาณ"          },
  "สป.สธ.":             { bg: "#EBF5F3", color: "#0B6E65", label: "🏛 สป.สธ."            },
  "ข่าวที่ควรรู้":       { bg: "#FEF9C3", color: "#854D0E", label: "📰 ข่าวที่ควรรู้"     },
};

// ── Main Interface ────────────────────────────────────────────────────────────

export interface MOPHFocusItem {
  id:            string;

  // Header
  title:         string;     // หัวข้อหลัก
  subtitle:      string;     // หัวข้อรอง / subtitle
  summary:       string;     // plain text 2-3 บรรทัด (สำหรับ List)
  coverEmoji:    string;     // 🏥

  // Detail sections (Markdown-safe)
  mustKnow:      string;     // 📌 สิ่งที่ควรรู้
  examPoints:    string;     // 🎯 อาจออกสอบตรงไหน
  quickMemory:   string;     // 🧠 จำง่ายใน 10 วินาที
  fullContent:   string;     // 📖 อ่านเพิ่มเติม (expandable)

  // Meta
  tags:          MOPHTag[];
  isPublished:   boolean;
  order:         number;
  publishedDate: Date;
  updatedAt:     Date;
  createdAt:     Date;
}

// ── Import Row ────────────────────────────────────────────────────────────────

export interface MOPHImportRow {
  title:         string;
  subtitle:      string;
  summary:       string;
  mustKnow:      string;
  examPoints:    string;
  quickMemory:   string;
  fullContent:   string;
  tags:          MOPHTag[];
  coverEmoji:    string;
  order:         number;
  isPublished:   boolean;
  publishedDate: string;     // "YYYY-MM-DD"
}
