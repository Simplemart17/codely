'use server';

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { assertInstructor, AuthorizationError } from '@/lib/auth/session-guards';
import { LessonNotesSchema, type LessonNotes } from '@/lib/ai/lesson-notes';
import type { Language } from '@/types';
import type { ActionResult } from './user-actions';

const MODEL = 'claude-opus-4-8';

const InputSchema = z.object({
  sessionId: z.string().uuid(),
  topic: z.string().trim().min(1).max(200),
  language: z.enum(['JAVASCRIPT', 'PYTHON']),
  code: z.string().max(20000).optional(),
});

export interface GenerateLessonNotesInput {
  sessionId: string;
  topic: string;
  language: Language;
  code?: string;
}

/**
 * Generate (or return cached) AI lesson notes for a session topic.
 *
 * Instructor-only and private: gated by `assertInstructor` (server-side, never
 * trusts the client role) and by the `instructor_notes` RLS policy. Generated
 * once per (session, topic, language) and cached; subsequent calls return the
 * stored notes without hitting the model. Notes are never sent over the shared
 * realtime channel, so learners can't see them.
 */
export async function generateLessonNotes(
  input: GenerateLessonNotesInput
): Promise<ActionResult<LessonNotes>> {
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }
  const { sessionId, topic, language, code } = parsed.data;

  // Server-side authorization — the client role is not trusted.
  let user;
  try {
    user = await assertInstructor(sessionId);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: 'Authorization failed' };
  }

  const supabase = await createClient();

  // Cache: generate once per (session, topic, language).
  const { data: cached } = await supabase
    .from('instructor_notes')
    .select('content')
    .eq('session_id', sessionId)
    .eq('topic', topic)
    .eq('language', language)
    .maybeSingle();
  if (cached?.content) {
    return { success: true, data: cached.content as LessonNotes };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      success: false,
      error: 'AI notes are not configured (missing ANTHROPIC_API_KEY).',
    };
  }

  let notes: LessonNotes;
  try {
    const client = new Anthropic();
    const message = await client.messages.parse({
      model: MODEL,
      // Generous budget: adaptive thinking shares this with the structured
      // output, so too low a cap truncates the JSON and fails parsing.
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      system:
        'You are an expert programming instructor writing PRIVATE teaching notes ' +
        'for an instructor — these notes are never shown to learners. Be specific, ' +
        'practical, and pedagogically sound, tailoring the guidance to the topic, ' +
        'language, and the current code in the session.',
      messages: [
        {
          role: 'user',
          content:
            `Topic: ${topic}\nLanguage: ${language}\n\n` +
            (code?.trim()
              ? `Current code in the session:\n\`\`\`${language.toLowerCase()}\n${code}\n\`\`\``
              : 'No code in the session yet.'),
        },
      ],
      output_config: { format: zodOutputFormat(LessonNotesSchema) },
    });

    if (message.stop_reason === 'refusal') {
      return {
        success: false,
        error: 'The request was declined. Try rephrasing the topic.',
      };
    }
    if (!message.parsed_output) {
      return {
        success: false,
        error:
          'Could not generate lesson notes for this topic. Please try again.',
      };
    }
    notes = message.parsed_output;
  } catch (err) {
    console.error('Lesson note generation failed:', err);
    return {
      success: false,
      error: 'Lesson note generation failed. Please try again.',
    };
  }

  // Persist as the cache for this (session, topic, language). Best-effort —
  // a concurrent generation may have inserted first (unique constraint), which
  // is fine: the notes were still produced. RLS independently enforces that
  // only the instructor can write/read this row.
  const { error: upsertError } = await supabase.from('instructor_notes').upsert(
    {
      session_id: sessionId,
      topic,
      language,
      content: notes,
      model: MODEL,
      created_by: user.id,
    },
    { onConflict: 'session_id,topic,language', ignoreDuplicates: true }
  );
  if (upsertError) {
    console.error('Failed to cache lesson notes:', upsertError.message);
  }

  return { success: true, data: notes };
}

/**
 * Return the most recently generated lesson notes for a session (if any), so
 * the instructor panel can rehydrate instead of showing an empty state after a
 * toggle or reload. Instructor-only (assertInstructor + RLS).
 */
export async function getLessonNotes(
  sessionId: string
): Promise<ActionResult<{ topic: string; notes: LessonNotes } | null>> {
  try {
    await assertInstructor(sessionId);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: 'Authorization failed' };
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from('instructor_notes')
    .select('topic, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return { success: true, data: null };
  }
  return {
    success: true,
    data: { topic: data.topic as string, notes: data.content as LessonNotes },
  };
}
