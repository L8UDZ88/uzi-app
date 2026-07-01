// Extract readable text from a document asset's bytes. Handles .docx (mammoth), .pdf (pdf-parse),
// and plain text/markdown. Libraries are loaded lazily so they only weigh in when actually used.
// Any failure returns "" so one bad file never breaks ingestion.
export async function extractText(bytes: ArrayBuffer, mimeType: string, name: string): Promise<string> {
  const mt = (mimeType || "").toLowerCase();
  const nm = (name || "").toLowerCase();
  const buf = Buffer.from(bytes);
  try {
    if (mt.includes("wordprocessingml") || mt.includes("msword") || nm.endsWith(".docx")) {
      const mammoth: any = await import("mammoth");
      const res = await (mammoth.default || mammoth).extractRawText({ buffer: buf });
      return String(res?.value || "").trim();
    }
    if (mt.includes("pdf") || nm.endsWith(".pdf")) {
      const pdf: any = (await import("pdf-parse/lib/pdf-parse.js")).default;
      const res = await pdf(buf);
      return String(res?.text || "").trim();
    }
    if (mt.startsWith("text/") || mt.includes("json") || nm.endsWith(".txt") || nm.endsWith(".md")) {
      return buf.toString("utf8").trim();
    }
  } catch {
    /* skip unreadable file */
  }
  return "";
}
