// Extracts plain text from lecture slides (PDF or .pptx) in the browser.
// The file never leaves the user's device; only the text is used.

import type JSZip from "jszip";

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB
export const UPLOAD_ACCEPT =
  ".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation";

// Less than this many letters/digits means the file is probably just images.
const MIN_TEXT_CHARS = 20;

// Error with a message that is safe and friendly to show to the user.
export class SlidesError extends Error {}

const NO_TEXT_MESSAGE =
  "We couldn't find any text in this file. It may be made of scanned images or pictures of slides. Please copy and paste the text into the box instead.";

// What was read: the text, and how many slides/pages had text out of the total.
export type ExtractedSlides = {
  text: string;
  unit: "slide" | "page";
  withText: number;
  total: number;
};

type Parts = { parts: string[]; total: number };

export async function extractSlidesText(file: File): Promise<ExtractedSlides> {
  const name = file.name.toLowerCase();
  const kind = name.endsWith(".pdf")
    ? "pdf"
    : name.endsWith(".pptx")
      ? "pptx"
      : null;

  if (!kind) {
    throw new SlidesError(
      name.endsWith(".ppt")
        ? "Old .ppt files aren't supported. Open it in PowerPoint and save it as .pptx or PDF, then upload it again."
        : "That file type isn't supported. Please upload a PDF or a PowerPoint (.pptx) file.",
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new SlidesError(
      `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 20 MB, so try a smaller file or paste the text instead.`,
    );
  }
  if (file.size === 0) {
    throw new SlidesError("That file is empty. Please choose another one.");
  }

  const data = new Uint8Array(await file.arrayBuffer());

  // Check the file really is what its name says (PDFs start with "%PDF",
  // .pptx files are zip archives starting with "PK").
  const head = String.fromCharCode(...data.slice(0, 4));
  if (kind === "pdf" && !head.startsWith("%PDF")) {
    throw new SlidesError("This doesn't look like a valid PDF file. Please check the file and try again.");
  }
  if (kind === "pptx" && !head.startsWith("PK")) {
    throw new SlidesError("This doesn't look like a valid PowerPoint (.pptx) file. Please check the file and try again.");
  }

  const { parts, total } =
    kind === "pdf" ? await extractPdf(data) : await extractPptx(data);
  const text = parts.join("\n\n");

  if (text.replace(/[^\p{L}\p{N}]/gu, "").length < MIN_TEXT_CHARS) {
    throw new SlidesError(NO_TEXT_MESSAGE);
  }
  return {
    text,
    unit: kind === "pdf" ? "page" : "slide",
    withText: parts.length,
    total,
  };
}

// Collapses repeated spaces, trims every line and removes extra blank lines.
function tidy(text: string) {
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------- PDF ----------

async function extractPdf(data: Uint8Array): Promise<Parts> {
  // Loaded only when needed, so it never slows down page loads.
  const pdfjs = await import("pdfjs-dist");
  // Copied into public/ by scripts/copy-pdf-worker.mjs (works on Vercel too).
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

  const loadingTask = pdfjs.getDocument({ data });
  let doc;
  try {
    doc = await loadingTask.promise;
  } catch (err) {
    void loadingTask.destroy();
    if (err instanceof Error && err.name === "PasswordException") {
      throw new SlidesError(
        "This PDF is password-protected. Remove the password or paste the text instead.",
      );
    }
    throw new SlidesError("We couldn't read this PDF. It may be damaged. Try another file or paste the text instead.");
  }

  try {
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      let pageText = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        pageText += item.str + (item.hasEOL ? "\n" : "");
      }
      pages.push(tidy(pageText));
      page.cleanup();
    }
    return { parts: pages.filter(Boolean), total: doc.numPages };
  } finally {
    // Frees the worker and memory used by this document.
    await loadingTask.destroy();
  }
}

// ---------- PowerPoint (.pptx) ----------

const NS = {
  p: "http://schemas.openxmlformats.org/presentationml/2006/main",
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  rel: "http://schemas.openxmlformats.org/package/2006/relationships",
};

function parseXml(xml: string) {
  return new DOMParser().parseFromString(xml, "application/xml");
}

// Turns a relationship target like "slides/slide3.xml" (relative to ppt/)
// or "/ppt/slides/slide3.xml" (absolute) into a path inside the zip.
function resolveTarget(target: string) {
  if (target.startsWith("/")) return target.slice(1);
  const parts = ["ppt"];
  for (const part of target.split("/")) {
    if (part === "..") parts.pop();
    else if (part && part !== ".") parts.push(part);
  }
  return parts.join("/");
}

async function extractPptx(data: Uint8Array): Promise<Parts> {
  const { default: JSZipLib } = await import("jszip");

  let zip;
  try {
    zip = await JSZipLib.loadAsync(data);
  } catch {
    throw new SlidesError("We couldn't open this PowerPoint file. It may be damaged. Try another file or paste the text instead.");
  }

  const slidePaths = await getSlideOrder(zip);
  if (slidePaths.length === 0) {
    throw new SlidesError("We couldn't find any slides in this PowerPoint file. Please check the file or paste the text instead.");
  }

  const slides: string[] = [];
  for (const [index, path] of slidePaths.entries()) {
    const xml = await zip.file(path)?.async("string");
    if (!xml) continue;
    const text = slideText(parseXml(xml));
    if (text) slides.push(`Slide ${index + 1}\n${text}`);
  }
  return { parts: slides, total: slidePaths.length };
}

// Slide files in presentation order (the order in presentation.xml,
// not the file names, which can be out of order after reordering slides).
async function getSlideOrder(zip: JSZip): Promise<string[]> {
  const presentationXml = await zip.file("ppt/presentation.xml")?.async("string");
  const relsXml = await zip
    .file("ppt/_rels/presentation.xml.rels")
    ?.async("string");

  if (presentationXml && relsXml) {
    const targets = new Map<string, string>();
    for (const rel of Array.from(
      parseXml(relsXml).getElementsByTagNameNS(NS.rel, "Relationship"),
    )) {
      const id = rel.getAttribute("Id");
      const target = rel.getAttribute("Target");
      if (id && target) targets.set(id, resolveTarget(target));
    }

    const ordered = Array.from(
      parseXml(presentationXml).getElementsByTagNameNS(NS.p, "sldId"),
    )
      .map((el) => targets.get(el.getAttributeNS(NS.r, "id") ?? ""))
      .filter((path): path is string => Boolean(path && zip.file(path)));

    if (ordered.length > 0) return ordered;
  }

  // Fallback: sort ppt/slides/slideN.xml by number.
  return Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
}

// All text on one slide: one line per paragraph, in the order it appears.
function slideText(doc: Document) {
  const lines: string[] = [];
  for (const paragraph of Array.from(doc.getElementsByTagNameNS(NS.a, "p"))) {
    let line = "";
    for (const node of Array.from(paragraph.getElementsByTagNameNS("*", "*"))) {
      if (node.namespaceURI !== NS.a) continue;
      if (node.localName === "t") line += node.textContent ?? "";
      else if (node.localName === "br") line += "\n";
    }
    if (line.trim()) lines.push(line);
  }
  return tidy(lines.join("\n"));
}
