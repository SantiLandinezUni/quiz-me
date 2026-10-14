import { z } from "zod";

export const MIN_MATERIAL = 200;
// About 100k tokens (Google: ~4 characters per token). Our Gemini models
// accept ~1M input tokens, but staying around 100k keeps requests fast enough
// for the time budget and well inside free-tier per-minute token limits.
export const MAX_MATERIAL = 400_000;
export const MAX_FOCUS = 200;

export const QuestionTypeSchema = z.enum(["mcq", "open", "mix"]);
export type QuestionType = z.infer<typeof QuestionTypeSchema>;

// `source` (which file/topic the question comes from) is optional so quizzes
// saved before it existed still load.
export const McqQuestionSchema = z.object({
  type: z.literal("mcq"),
  question: z.string().min(1),
  options: z.array(z.string().min(1)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(1),
  source: z.string().optional(),
});

export const OpenQuestionSchema = z.object({
  type: z.literal("open"),
  question: z.string().min(1),
  modelAnswer: z.string().min(1),
  keyPoints: z.array(z.string().min(1)).min(2).max(3),
  source: z.string().optional(),
});

export const QuestionSchema = z.discriminatedUnion("type", [
  McqQuestionSchema,
  OpenQuestionSchema,
]);
export type Question = z.infer<typeof QuestionSchema>;

export const QuizSchema = z.object({
  questionType: QuestionTypeSchema,
  generatedAt: z.string(),
  focus: z.string().optional(),
  questions: z.array(QuestionSchema).min(1),
});
export type Quiz = z.infer<typeof QuizSchema>;

// What the /app list needs (not the material or quiz, which can be large).
export type StudySetSummary = {
  id: string;
  title: string;
  created_at: string;
};

// Returns a valid quiz or null (old/broken jsonb should never crash the page).
export function parseQuiz(value: unknown): Quiz | null {
  const result = QuizSchema.safeParse(value);
  return result.success ? result.data : null;
}

// ---------- Material size ----------

// Uploaded files are added under a heading line like "--- Lecture 3.pdf ---".
export const FILE_HEADING_RE = /^--- (.+) ---$/gm;

export function fileHeading(name: string) {
  return `--- ${name} ---`;
}

// e.g. "4 files · 85,000 characters"
export function describeMaterial(material: string) {
  const files = material.match(FILE_HEADING_RE)?.length ?? 0;
  const chars = material.trim().length;
  const parts = [];
  if (files > 0) parts.push(`${files} file${files === 1 ? "" : "s"}`);
  parts.push(`${chars.toLocaleString("en-US")} / ${MAX_MATERIAL.toLocaleString("en-US")} characters`);
  return parts.join(" · ");
}

// ---------- Quiz attempts and mistakes ----------

export const WrongAnswerSchema = z.object({
  question: QuestionSchema,
  // Option picked for a multiple-choice question.
  picked: z.number().int().min(0).max(3).optional(),
});
export type WrongAnswer = z.infer<typeof WrongAnswerSchema>;

export const AttemptSchema = z.object({
  id: z.string(),
  score: z.number().int(),
  total: z.number().int(),
  kind: z.enum(["quiz", "mistakes"]),
  wrong_questions: z.array(z.unknown()),
  correct_keys: z.array(z.string()),
  created_at: z.string(),
});
export type Attempt = z.infer<typeof AttemptSchema>;

export function parseAttempts(rows: unknown[]): Attempt[] {
  return rows.flatMap((row) => {
    const result = AttemptSchema.safeParse(row);
    return result.success ? [result.data] : [];
  });
}

// Same question text = same question (case and spacing don't matter).
export function questionKey(question: Question) {
  return question.question.toLowerCase().replace(/\s+/g, " ").trim();
}

// Questions answered wrong that haven't been answered right since.
// Goes through attempts oldest-first: a wrong answer adds the question, a
// later right answer removes it. Newest mistakes come first in the result.
export function unresolvedMistakes(attemptsNewestFirst: Attempt[]): Question[] {
  const open = new Map<string, Question>();
  for (const attempt of [...attemptsNewestFirst].reverse()) {
    for (const raw of attempt.wrong_questions) {
      const parsed = WrongAnswerSchema.safeParse(raw);
      if (!parsed.success) continue;
      const key = questionKey(parsed.data.question);
      open.delete(key); // re-insert so the newest mistake ends up last
      open.set(key, parsed.data.question);
    }
    for (const key of attempt.correct_keys) open.delete(key);
  }
  return [...open.values()].reverse();
}
