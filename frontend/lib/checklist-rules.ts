import type { CategoryId } from "./types";

export type RuleKind = "auto" | "config" | "heuristic";

/** Configurable rule input types. */
export type ConfigField =
  | "secondaryKeywords"
  | "pronouns"
  | "brandVoiceKeywords"
  | "brandMessage"
  | "adForbiddenWords"
  | "competitors"
  | "personaKeywords"
  | "awardsMentions"
  | "productUrls"
  | "lsiKeywords";

export interface RuleMeta {
  id: string;
  label: string;
  category: CategoryId;
  description: string;
  threshold?: string;
  kind: RuleKind;
  /** For kind=config: which config field this rule reads. */
  configField?: ConfigField;
  /** UI hint for input control. */
  inputType?: "list" | "text";
  /** Placeholder for the input. */
  placeholder?: string;
}

export const ALL_RULES: RuleMeta[] = [
  // ── Readability (auto) ────────────────────────────────────────
  {
    id: "word-count",
    label: "Word count tối thiểu",
    category: "readability",
    description: "Bài đủ chiều sâu, ít nhất 800 từ.",
    threshold: "≥ 800 từ",
    kind: "auto",
  },
  {
    id: "sentence-length",
    label: "Câu ngắn",
    category: "readability",
    description: "Mỗi câu 20-30 từ, đặt dấu câu ngắt nghỉ phù hợp.",
    threshold: "≤ 30 từ / câu",
    kind: "auto",
  },
  {
    id: "paragraph-length",
    label: "Đoạn ngắn",
    category: "readability",
    description: "Đoạn 60-80 từ (3-4 dòng, tối đa 5 dòng).",
    threshold: "≤ 100 từ / đoạn",
    kind: "auto",
  },
  {
    id: "lead-paragraph",
    label: "Câu dẫn sau H2",
    category: "readability",
    description: "Sau mỗi H2 cần 1-2 câu dẫn dắt trước khi liệt kê bullet.",
    kind: "auto",
  },
  {
    id: "persona-keywords",
    label: "Cá nhân hoá: từ khoá persona",
    category: "readability",
    description: "Tool đếm từ persona xuất hiện trong bài.",
    kind: "config",
    configField: "personaKeywords",
    inputType: "list",
    placeholder: "Mỗi dòng 1 từ — vd:\ndoanh nghiệp SME\nmarketer\ngiám đốc",
  },

  // ── Technical (auto + config) ─────────────────────────────────
  {
    id: "has-h1",
    label: "Có Heading H1",
    category: "technical",
    description: "Đặt H1 duy nhất làm tiêu đề chính của bài.",
    threshold: "≥ 1 H1",
    kind: "auto",
  },
  {
    id: "h1-quality",
    label: "H1 ≤ 63 ký tự + chứa từ khoá",
    category: "technical",
    description: "H1 ngắn gọn để hiển thị đủ trên SERP, chứa từ khoá chính.",
    threshold: "≤ 63 ký tự",
    kind: "auto",
  },
  {
    id: "has-h2",
    label: "Có Heading H2",
    category: "technical",
    description: "Chia bài thành các section với cú pháp `## Tiêu đề`.",
    kind: "auto",
  },
  {
    id: "h2-keyword",
    label: "H2 chứa từ khoá chính",
    category: "technical",
    description: "Google ưu tiên heading khi xác định chủ đề.",
    kind: "auto",
  },
  {
    id: "sapo",
    label: "Mở bài (Sapo) 3-5 dòng + chứa keyword",
    category: "technical",
    description: "Đoạn mở bài sau H1 sơ lược nội dung + chứa từ khoá chính.",
    threshold: "30 – 100 từ",
    kind: "auto",
  },
  {
    id: "conclusion",
    label: "Có Kết bài",
    category: "technical",
    description: "Heading 'Kết luận' / 'Tổng kết' ở cuối bài.",
    kind: "auto",
  },
  {
    id: "meta-description",
    label: "Meta description ≤ 165 ký tự",
    category: "technical",
    description: "Độ dài meta hợp lệ để Google không cắt SERP.",
    threshold: "1 – 165 ký tự",
    kind: "auto",
  },
  {
    id: "meta-keyword",
    label: "Meta description chứa từ khoá",
    category: "technical",
    description: "Đưa từ khoá chính vào meta, ưu tiên gần đầu.",
    kind: "auto",
  },
  {
    id: "keyword-density",
    label: "Keyword density 1–3%",
    category: "technical",
    description: "Mật độ từ khoá chính cân bằng.",
    threshold: "1% – 3%",
    kind: "auto",
  },
  {
    id: "internal-link",
    label: "Có link trong bài",
    category: "technical",
    description: "Markdown `[anchor](/path)` hoặc HTML `<a href='/...'>`.",
    kind: "auto",
  },
  {
    id: "secondary-keywords",
    label: "Từ khoá phụ xuất hiện ≥1 lần",
    category: "technical",
    description: "Tool check mỗi từ khoá phụ trong list xuất hiện ≥1 lần.",
    kind: "config",
    configField: "secondaryKeywords",
    inputType: "list",
    placeholder: "Mỗi dòng 1 từ khoá phụ:\nseo onpage\ntối ưu website",
  },
  {
    id: "product-link-coverage",
    label: "Có link tới các sản phẩm nhắc trong bài",
    category: "technical",
    description: "Tool check mỗi URL sản phẩm trong list có xuất hiện trong bài.",
    kind: "config",
    configField: "productUrls",
    inputType: "list",
    placeholder: "Mỗi dòng 1 URL:\n/dich-vu-seo\n/khoa-hoc-seo",
  },
  {
    id: "conclusion-not-cta",
    label: "Kết bài không gộp chung CTA",
    category: "technical",
    description: "Heuristic: kết luận tách riêng khỏi CTA.",
    kind: "heuristic",
  },

  // ── UL-LI ─────────────────────────────────────────────────────
  {
    id: "bullet-list",
    label: "Có Bullet List",
    category: "ul-li",
    description: "≥3 bullet trong bài — dễ scan.",
    threshold: "≥ 3 bullets",
    kind: "auto",
  },
  {
    id: "bold-emphasis",
    label: "Có in đậm",
    category: "ul-li",
    description: "Dùng `**chữ in đậm**` để highlight ý chính.",
    kind: "auto",
  },

  // ── AI-Opt ────────────────────────────────────────────────────
  {
    id: "heading-question",
    label: "Heading dạng câu hỏi",
    category: "ai-opt",
    description: "≥1 H2/H3 kết thúc `?` — bắt long-tail keyword.",
    kind: "auto",
  },
  {
    id: "tldr",
    label: "TL;DR + bullet",
    category: "ai-opt",
    description: "Tóm tắt đầu/cuối bài dạng bullet.",
    kind: "auto",
  },
  {
    id: "lsi-coverage",
    label: "Mỗi đoạn ≥3 từ LSI",
    category: "ai-opt",
    description: "Tool đếm từ LSI trong mỗi đoạn — tăng cosine similarity.",
    kind: "config",
    configField: "lsiKeywords",
    inputType: "list",
    placeholder: "Mỗi dòng 1 LSI keyword:\ntối ưu\ntừ khoá\nthứ hạng",
  },

  // ── Branding ──────────────────────────────────────────────────
  {
    id: "faq",
    label: "Có FAQ / Câu hỏi thường gặp",
    category: "branding",
    description: "Cơ hội xuất hiện ở 'People Also Ask'.",
    kind: "auto",
  },
  {
    id: "cta",
    label: "Có Call-to-Action",
    category: "branding",
    description: "Liên hệ / Đăng ký / Tư vấn / Mua ngay / Nhận ngay / Đặt hàng.",
    kind: "auto",
  },
  {
    id: "brand-pronoun",
    label: "Xưng hô nhất quán",
    category: "branding",
    description:
      "Tool check xưng hô có xuất hiện + không lẫn lộn cách xưng khác.",
    kind: "config",
    configField: "pronouns",
    inputType: "list",
    placeholder: "Mỗi dòng 1 cách xưng hô:\nBạn",
  },
  {
    id: "brand-voice",
    label: "Brand voice keywords",
    category: "branding",
    description:
      "Tool đếm các từ thể hiện giọng thương hiệu xuất hiện trong bài.",
    kind: "config",
    configField: "brandVoiceKeywords",
    inputType: "list",
    placeholder: "Mỗi dòng 1 từ:\nchuyên nghiệp\nđồng hành\ntận tâm",
  },
  {
    id: "brand-message",
    label: "Thông điệp thương hiệu xuất hiện",
    category: "branding",
    description: "Tool tìm chuỗi thông điệp xuất hiện trong bài.",
    kind: "config",
    configField: "brandMessage",
    inputType: "text",
    placeholder: "Câu thông điệp thương hiệu",
  },
  {
    id: "ad-forbidden-words",
    label: "Không dùng từ cấm quảng cáo",
    category: "branding",
    description:
      "Tool flag nếu xuất hiện từ trong list cấm. Mặc định: 'tốt nhất', 'số 1', 'duy nhất', '100%'.",
    kind: "config",
    configField: "adForbiddenWords",
    inputType: "list",
    placeholder: "Mỗi dòng 1 từ cấm (để trống = dùng mặc định):\ntốt nhất\nsố 1",
  },
  {
    id: "competitor-mention",
    label: "Không so sánh đối thủ thiếu nguồn",
    category: "branding",
    description:
      "Tool flag nếu nhắc đối thủ kèm từ so sánh (hơn / tốt hơn / vượt trội).",
    kind: "config",
    configField: "competitors",
    inputType: "list",
    placeholder: "Mỗi dòng 1 tên đối thủ:\nABC Agency",
  },
  {
    id: "cta-3s-quality",
    label: "CTA đạt 3S (Simple / Specific / Strong)",
    category: "branding",
    description: "Heuristic: CTA ngắn (≤20 từ) + bắt đầu bằng động từ mạnh.",
    kind: "heuristic",
  },

  // ── Ngữ pháp - Chính tả (AI, opt-in) ──────────────────────────
  {
    id: "grammar",
    label: "Ngữ pháp đúng, diễn đạt mạch lạc",
    category: "grammar",
    description:
      "AI proofread (Claude Sonnet 4.6) — phát hiện lỗi cú pháp, câu cụt, chủ-vị sai.",
    kind: "auto",
  },
  {
    id: "spelling",
    label: "Không có lỗi chính tả",
    category: "grammar",
    description:
      "AI proofread (Claude Sonnet 4.6) — phát hiện từ viết sai chính tả + đề xuất sửa.",
    kind: "auto",
  },

  // ── E-E-A-T (heuristic + config) ──────────────────────────────
  {
    id: "eeat-experience",
    label: "Experience: ảnh thực tế + first-person",
    category: "eeat",
    description: "Heuristic: đếm ảnh `![..](..)` + pattern 'tôi đã / kinh nghiệm'.",
    kind: "heuristic",
  },
  {
    id: "eeat-case-study",
    label: "Expertise: case study + số liệu",
    category: "eeat",
    description: "Heuristic: pattern 'case study' + đếm metric (%, nghìn, triệu).",
    kind: "heuristic",
  },
  {
    id: "eeat-customer-reviews",
    label: "Authoritativeness: trích dẫn / review",
    category: "eeat",
    description: "Heuristic: đếm quote `\"...\"` hoặc blockquote `>`.",
    kind: "heuristic",
  },
  {
    id: "eeat-authority-brand",
    label: "Authoritativeness: nhắc giải thưởng / danh tiếng",
    category: "eeat",
    description: "Tool check các giải thưởng trong list xuất hiện trong bài.",
    kind: "config",
    configField: "awardsMentions",
    inputType: "list",
    placeholder: "Mỗi dòng 1 giải thưởng / brand mention:\nGiải thưởng Sao Khuê",
  },
  {
    id: "eeat-trust-citations",
    label: "Trustworthiness: nguồn trích dẫn uy tín",
    category: "eeat",
    description: "Heuristic: đếm link tới domain uy tín (.gov, .edu, wikipedia...).",
    kind: "heuristic",
  },
  {
    id: "eeat-trust-harvard",
    label: "Citation format Harvard",
    category: "eeat",
    description: "Heuristic: regex `(Tác giả, Năm)` — vd `(Smith, 2024)`.",
    kind: "heuristic",
  },
];

export const ALL_RULE_IDS = ALL_RULES.map((r) => r.id);
export const CONFIG_RULES = ALL_RULES.filter((r) => r.kind === "config");
