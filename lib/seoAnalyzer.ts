import type { AnalysisResult, CheckResult } from "./types";

const CTA_PATTERNS = [
  "liên hệ",
  "đăng ký",
  "tư vấn",
  "mua ngay",
  "nhận ngay",
  "đặt hàng",
];

const FAQ_PATTERNS = ["faq", "câu hỏi thường gặp"];
const TLDR_PATTERNS = ["tldr", "tl;dr", "tóm tắt", "tóm lược"];

function normalize(text: string): string {
  return text.toLowerCase().trim();
}

function countWords(text: string): number {
  const stripped = text.replace(/<[^>]+>/g, " ");
  return stripped.split(/\s+/).filter(Boolean).length;
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${escaped}\\b`, "gi");
  return (haystack.match(re) || []).length;
}

export function analyzeContent(
  rawContent: string,
  keyword: string,
  metaDescription = ""
): AnalysisResult {
  const content = rawContent;
  const lower = normalize(content);
  const kw = normalize(keyword);
  const kwDisplay = keyword.trim() || "từ khóa chính";
  const checks: CheckResult[] = [];

  /* 1. Word count */
  const wordCount = countWords(content);
  const wordsNeeded = Math.max(0, 800 - wordCount);
  checks.push({
    id: "word-count",
    label: "Word count tối thiểu",
    category: "readability",
    status: wordCount >= 800 ? "pass" : "warn",
    detail: `Bài viết có ${wordCount} từ.`,
    recommendation:
      wordCount >= 800
        ? undefined
        : `Bổ sung thêm ~${wordsNeeded} từ để đạt ngưỡng 800. Mở rộng bằng: ví dụ thực tế, case study, mục "Lưu ý khi triển khai", hoặc so sánh phương án.`,
  });

  /* 2. Có H2 */
  const h2Matches = content.match(/^##\s+.+$/gm) || [];
  const hasH2 = h2Matches.length > 0;
  checks.push({
    id: "has-h2",
    label: "Có heading H2",
    category: "technical",
    status: hasH2 ? "pass" : "fail",
    detail: hasH2 ? `Tìm thấy ${h2Matches.length} H2.` : "Không có H2 nào.",
    recommendation: hasH2
      ? undefined
      : `Chia bài thành 3-5 phần với heading H2 (cú pháp \`## Tiêu đề\`). Cấu trúc gợi ý cho bài về "${kwDisplay}":`,
    example: hasH2
      ? undefined
      : `## ${kwDisplay} là gì?\n## Lợi ích của ${kwDisplay}\n## Cách triển khai ${kwDisplay} hiệu quả\n## Lưu ý quan trọng\n## Câu hỏi thường gặp`,
  });

  /* 3. H2 chứa keyword */
  const h2HasKeyword =
    !!kw && h2Matches.some((h) => normalize(h).includes(kw));
  checks.push({
    id: "h2-keyword",
    label: "H2 chứa từ khóa chính",
    category: "technical",
    status: h2HasKeyword ? "pass" : "fail",
    detail: h2HasKeyword
      ? "Có H2 chứa từ khóa."
      : "Chưa có H2 nào chứa từ khóa chính.",
    recommendation: h2HasKeyword
      ? undefined
      : `Đưa từ khóa "${kwDisplay}" vào ít nhất 1 H2 — Google ưu tiên heading khi xác định chủ đề trang. Ví dụ:`,
    example: h2HasKeyword
      ? undefined
      : `## ${kwDisplay} là gì?\n## 5 lợi ích của ${kwDisplay} cho doanh nghiệp\n## Quy trình ${kwDisplay} chuẩn 2026`,
  });

  /* 4. FAQ */
  const hasFAQ = FAQ_PATTERNS.some((p) => lower.includes(p));
  checks.push({
    id: "faq",
    label: "Có phần FAQ / Câu hỏi thường gặp",
    category: "branding",
    status: hasFAQ ? "pass" : "fail",
    detail: hasFAQ ? "Đã tìm thấy mục FAQ." : "Chưa thấy phần FAQ.",
    recommendation: hasFAQ
      ? undefined
      : `Thêm mục FAQ ở cuối bài với 3-5 câu hỏi người dùng hay tìm. Đây là cơ hội xuất hiện ở "People Also Ask" của Google. Mẫu:`,
    example: hasFAQ
      ? undefined
      : `## Câu hỏi thường gặp\n\n**${kwDisplay} là gì?**\n[câu trả lời 2-3 dòng]\n\n**Chi phí ${kwDisplay} bao nhiêu?**\n[câu trả lời...]\n\n**${kwDisplay} phù hợp với ai?**\n[câu trả lời...]`,
  });

  /* 5. CTA */
  const ctaFound = CTA_PATTERNS.find((p) => lower.includes(p));
  checks.push({
    id: "cta",
    label: "Có Call-to-Action",
    category: "cta",
    status: ctaFound ? "pass" : "fail",
    detail: ctaFound
      ? `CTA tìm thấy: "${ctaFound}".`
      : "Không có CTA rõ ràng.",
    recommendation: ctaFound
      ? undefined
      : `Đặt CTA ở cuối bài (bắt buộc) và nhắc lại 1 lần ở giữa. CTA cần rõ hành động + lợi ích cụ thể. Ví dụ:`,
    example: ctaFound
      ? undefined
      : `> 👉 **Liên hệ Seongon** để nhận tư vấn miễn phí về ${kwDisplay} — phản hồi trong 24h.\n> [Đăng ký nhận báo giá](/lien-he)`,
  });

  /* 6. Meta description */
  const metaLen = metaDescription.trim().length;
  const metaOk = metaLen > 0 && metaLen <= 165;
  checks.push({
    id: "meta-description",
    label: "Meta description ≤ 165 ký tự",
    category: "technical",
    status: metaOk ? "pass" : metaLen === 0 ? "warn" : "fail",
    detail:
      metaLen === 0
        ? "Chưa nhập meta description."
        : `Độ dài meta: ${metaLen} ký tự.`,
    recommendation: metaOk
      ? undefined
      : metaLen === 0
      ? `Viết meta 150-160 ký tự, đặt từ khóa "${kwDisplay}" gần đầu + 1 lý do click. Mẫu:`
      : `Rút gọn còn 150-160 ký tự (đang dư ${metaLen - 160} ký tự). Google sẽ cắt phần dư trong SERP. Ưu tiên giữ keyword ở đầu + USP.`,
    example:
      metaOk || metaLen > 0
        ? undefined
        : `Tìm hiểu ${kwDisplay} từ A-Z: định nghĩa, lợi ích và quy trình triển khai chuẩn 2026. Đăng ký nhận tư vấn miễn phí ngay hôm nay.`,
  });

  /* 7. Keyword density */
  const kwCount = kw ? countOccurrences(lower, kw) : 0;
  const density = wordCount > 0 ? (kwCount / wordCount) * 100 : 0;
  const densityOk = density >= 1 && density <= 3;
  const targetMin = Math.ceil((wordCount * 1) / 100);
  const targetMax = Math.floor((wordCount * 3) / 100);
  checks.push({
    id: "keyword-density",
    label: "Keyword density 1% – 3%",
    category: "technical",
    status: densityOk ? "pass" : "fail",
    detail: `Từ khóa xuất hiện ${kwCount} lần (${density.toFixed(2)}%).`,
    recommendation: densityOk
      ? undefined
      : density < 1
      ? `Tăng số lần xuất hiện "${kwDisplay}" lên ${targetMin}-${targetMax} lần. Vị trí ưu tiên: 100 từ đầu, 1-2 H2, đoạn kết, ALT của ảnh, anchor text internal link.`
      : `Giảm xuống ${targetMin}-${targetMax} lần (đang dư ${kwCount - targetMax}). Thay bằng từ đồng nghĩa / LSI: "dịch vụ ${kwDisplay}", "giải pháp ${kwDisplay}", "${kwDisplay} là gì". Tránh nhồi nhét gây phạt.`,
  });

  /* 8. Internal / link */
  const hasInternalLink =
    /\]\(\/[^)]+\)/.test(content) ||
    /href=["']\/[^"']+["']/.test(content) ||
    /\[[^\]]+\]\(https?:\/\/[^)]+\)/.test(content);
  checks.push({
    id: "internal-link",
    label: "Có link trong bài",
    category: "technical",
    status: hasInternalLink ? "pass" : "fail",
    detail: hasInternalLink ? "Đã có link." : "Không phát hiện link nào.",
    recommendation: hasInternalLink
      ? undefined
      : `Thêm 2-3 internal link tới bài liên quan trong site và 1-2 external link tới nguồn uy tín. Anchor text nên mô tả rõ trang đích (không dùng "click here").`,
    example: hasInternalLink
      ? undefined
      : `Xem thêm: [hướng dẫn ${kwDisplay} chi tiết](/blog/huong-dan-${kw.replace(/\s+/g, "-")})\nTham khảo: [báo cáo của Google](https://developers.google.com/search)`,
  });

  /* 9. Paragraph length */
  const paragraphs = content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const longParagraphs = paragraphs.filter((p) => countWords(p) > 150).length;
  checks.push({
    id: "paragraph-length",
    label: "Đoạn văn ≤ 150 từ",
    category: "readability",
    status: longParagraphs === 0 ? "pass" : "warn",
    detail:
      longParagraphs === 0
        ? "Tất cả đoạn đều có độ dài hợp lý."
        : `Có ${longParagraphs} đoạn dài hơn 150 từ.`,
    recommendation:
      longParagraphs === 0
        ? undefined
        : `Chia đoạn dài thành các đoạn 50-100 từ (~3-4 câu). Tách tại điểm chuyển ý — khi đổi chủ đề con thì xuống dòng. Đoạn ngắn dễ scan trên mobile và tăng dwell time.`,
  });

  /* 10. Sentence length */
  const sentences = content
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const longSentences = sentences.filter((s) => countWords(s) > 30).length;
  checks.push({
    id: "sentence-length",
    label: "Câu ≤ 30 từ",
    category: "readability",
    status: longSentences === 0 ? "pass" : "warn",
    detail:
      longSentences === 0
        ? "Câu có độ dài hợp lý."
        : `Có ${longSentences} câu dài hơn 30 từ.`,
    recommendation:
      longSentences === 0
        ? undefined
        : `Trung bình 15-20 từ/câu là dễ đọc nhất. Cắt câu dài tại liên từ ("và", "nhưng", "tuy nhiên", "vì vậy") — đổi dấu phẩy thành dấu chấm để tách thành 2 câu độc lập.`,
  });

  /* 11. TL;DR */
  const hasTLDR = TLDR_PATTERNS.some((p) => lower.includes(p));
  const hasBullet = /^\s*[-*+]\s+/m.test(content);
  const tldrOk = hasTLDR && hasBullet;
  checks.push({
    id: "tldr",
    label: "Có TL;DR / Tóm tắt dạng bullet",
    category: "readability",
    status: tldrOk ? "pass" : "fail",
    detail: tldrOk
      ? "Đã có phần tóm tắt với bullet list."
      : hasTLDR
      ? "Có nhắc TL;DR nhưng thiếu bullet."
      : "Chưa có phần tóm tắt.",
    recommendation: tldrOk
      ? undefined
      : `Thêm mục tóm tắt ở đầu bài (sau intro) với 3-5 bullet — giúp người đọc nắm nhanh ý chính, tăng dwell time và giảm bounce rate.`,
    example: tldrOk
      ? undefined
      : `## TL;DR\n- ${kwDisplay} giúp [lợi ích chính #1]\n- Phù hợp với [đối tượng]\n- Quy trình gồm [N] bước chính\n- Chi phí khoảng [...]\n- Liên hệ Seongon để được tư vấn`,
  });

  const passCount = checks.filter((c) => c.status === "pass").length;
  const failCount = checks.filter((c) => c.status === "fail").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;
  const score = Math.round(
    ((passCount + warnCount * 0.5) / checks.length) * 100
  );

  return {
    score,
    totalChecks: checks.length,
    passCount,
    failCount,
    warnCount,
    wordCount,
    keywordDensity: density,
    checks,
  };
}
