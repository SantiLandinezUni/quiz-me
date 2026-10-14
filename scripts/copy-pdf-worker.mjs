// Copies the PDF.js worker into public/ so the browser can load it from
// /pdf.worker.min.js, locally and on Vercel. Runs before `dev` and `build`,
// so the worker always matches the installed pdfjs-dist version.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve("pdfjs-dist/package.json"));
const from = join(pkgDir, "build", "pdf.worker.min.mjs");
const to = join(process.cwd(), "public", "pdf.worker.min.js");

mkdirSync(dirname(to), { recursive: true });
copyFileSync(from, to);
console.log("Copied PDF.js worker to public/pdf.worker.min.js");
