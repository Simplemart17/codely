// Structured shape for AI-generated instructor lesson notes.
//
// This uses `zod/v4` (not the app-wide `zod` v3 import) because the Anthropic
// SDK's `zodOutputFormat` helper requires a v4 schema. Kept in its own module
// so the type can be imported by client components via `import type` without
// pulling zod into the client bundle.
//
// Code fields hold RAW source (no markdown fences) in the lesson's language,
// properly indented and runnable on the platform (JavaScript in the sandbox,
// Python via Pyodide) so the instructor can paste them straight into the editor.
import * as z from 'zod/v4';

export const LessonNotesSchema = z.object({
  overview: z
    .string()
    .describe(
      'A rich 4-6 sentence overview of the topic for the instructor: what it ' +
        'is, why it matters, where it fits in a curriculum, and what makes it ' +
        'tricky to teach.'
    ),
  prerequisites: z
    .array(z.string())
    .describe(
      'Concepts/skills the learner should already know before this lesson ' +
        '(3-6 items).'
    ),
  objectives: z
    .array(z.string())
    .describe(
      'Concrete, measurable learning objectives for the lesson (4-6 items). ' +
        'Each should start with an action verb (e.g. "Implement…", "Explain…").'
    ),
  keyConcepts: z
    .array(
      z.object({
        concept: z.string().describe('The name of the concept.'),
        explanation: z
          .string()
          .describe(
            'A thorough, multi-sentence explanation the instructor can teach ' +
              'from, including the intuition and any important edge cases.'
          ),
        codeExample: z
          .string()
          .describe(
            'A short, correct, idiomatic, RUNNABLE code snippet in the ' +
              "lesson's language that illustrates this concept. Properly " +
              'indented and formatted. Raw source only — NO markdown code ' +
              'fences. Use an empty string only if code genuinely cannot ' +
              'illustrate the concept.'
          ),
        instructorTalkingPoint: z
          .string()
          .describe('How the instructor should frame or explain this concept.'),
      })
    )
    .describe('Key concepts to teach, in a sensible teaching order (4-7 items).'),
  codeExamples: z
    .array(
      z.object({
        title: z.string().describe('A short title for the example.'),
        description: z
          .string()
          .describe('What this example demonstrates and when to reach for it.'),
        code: z
          .string()
          .describe(
            'A COMPLETE, RUNNABLE, well-formatted program or snippet in the ' +
              "lesson's language. Properly indented. Self-contained so it runs " +
              'on the platform as-is. Raw source only — NO markdown code fences.'
          ),
        walkthrough: z
          .string()
          .describe(
            'A step-by-step explanation of how the code works, block by block, ' +
              'that the instructor can narrate while presenting it.'
          ),
        expectedOutput: z
          .string()
          .describe(
            'What the code prints or evaluates to when run. Empty string if it ' +
              'produces no output.'
          ),
      })
    )
    .describe(
      '2-4 fully worked, runnable code examples that progress from simple to ' +
        'more involved. These are the heart of the lesson.'
    ),
  commonMistakes: z
    .array(
      z.object({
        mistake: z.string().describe('The mistake learners commonly make.'),
        howToAddress: z
          .string()
          .describe('How the instructor should catch and correct it.'),
        codeExample: z
          .string()
          .describe(
            'A brief snippet showing the mistake and/or its fix (raw source, ' +
              'NO markdown fences). Empty string if a snippet does not help.'
          ),
      })
    )
    .describe('Common learner mistakes and how to address them (3-6 items).'),
  suggestedFlow: z
    .array(z.string())
    .describe('Ordered, concrete teaching steps for the session (5-8 steps).'),
  checkQuestions: z
    .array(z.string())
    .describe(
      'Questions to check learner understanding, mixing recall and applied ' +
        'reasoning (4-6 items).'
    ),
});

export type LessonNotes = z.infer<typeof LessonNotesSchema>;
