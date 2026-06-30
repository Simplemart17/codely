// Structured shape for AI-generated instructor lesson notes.
//
// This uses `zod/v4` (not the app-wide `zod` v3 import) because the Anthropic
// SDK's `zodOutputFormat` helper requires a v4 schema. Kept in its own module
// so the type can be imported by client components via `import type` without
// pulling zod into the client bundle.
import * as z from 'zod/v4';

export const LessonNotesSchema = z.object({
  overview: z
    .string()
    .describe('A 2-3 sentence overview of the topic for the instructor'),
  objectives: z
    .array(z.string())
    .describe('Concrete learning objectives for the lesson'),
  keyConcepts: z
    .array(
      z.object({
        concept: z.string(),
        explanation: z.string(),
        instructorTalkingPoint: z
          .string()
          .describe('How the instructor should frame or explain this concept'),
      })
    )
    .describe('Key concepts to teach, in a sensible order'),
  commonMistakes: z
    .array(
      z.object({
        mistake: z.string(),
        howToAddress: z.string(),
      })
    )
    .describe('Common learner mistakes and how to address them'),
  suggestedFlow: z
    .array(z.string())
    .describe('Ordered teaching steps for the session'),
  checkQuestions: z
    .array(z.string())
    .describe('Questions to check learner understanding'),
});

export type LessonNotes = z.infer<typeof LessonNotesSchema>;
