import { z } from "zod";

export const MIN_MATERIAL = 200;
export const MAX_MATERIAL = 30000;

export const QuestionTypeSchema = z.enum(["mcq", "open", "mix"]);
export type QuestionType = z.infer<typeof QuestionTypeSchema>;

export const McqQuestionSchema = z.object({
  type: z.literal("mcq"),
  question: z.string().min(1),
  options: z.array(z.string().min(1)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(1),
});

export const OpenQuestionSchema = z.object({
  type: z.literal("open"),
  question: z.string().min(1),
  modelAnswer: z.string().min(1),
  keyPoints: z.array(z.string().min(1)).min(2).max(3),
});

export const QuestionSchema = z.discriminatedUnion("type", [
  McqQuestionSchema,
  OpenQuestionSchema,
]);
export type Question = z.infer<typeof QuestionSchema>;

export const QuizSchema = z.object({
  questionType: QuestionTypeSchema,
  generatedAt: z.string(),
  questions: z.array(QuestionSchema).min(1),
});
export type Quiz = z.infer<typeof QuizSchema>;

export type StudySet = {
  id: string;
  title: string;
  material: string;
  quiz: unknown;
  created_at: string;
};

// Returns a valid quiz or null (old/broken jsonb should never crash the page).
export function parseQuiz(value: unknown): Quiz | null {
  const result = QuizSchema.safeParse(value);
  return result.success ? result.data : null;
}
