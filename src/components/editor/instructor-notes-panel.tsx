'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { generateLessonNotes, getLessonNotes } from '@/lib/actions/ai-actions';
import type { LessonNotes } from '@/lib/ai/lesson-notes';
import type { Language } from '@/types';

interface InstructorNotesPanelProps {
  sessionId: string;
  language: Language;
  /** Pre-fills the topic field (e.g. the session title). */
  defaultTopic?: string;
  /** Returns the current editor code, sent as context for the notes. */
  getCode: () => string;
  height?: string | number;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">
        {title}
      </h4>
      {children}
    </div>
  );
}

function NotesView({ notes }: { notes: LessonNotes }) {
  return (
    <div className="space-y-4 text-sm">
      <Section title="Overview">
        <p className="text-foreground">{notes.overview}</p>
      </Section>

      <Section title="Objectives">
        <ul className="list-disc space-y-0.5 pl-5 text-foreground">
          {notes.objectives.map((o, i) => (
            <li key={i}>{o}</li>
          ))}
        </ul>
      </Section>

      <Section title="Key Concepts">
        <div className="space-y-2">
          {notes.keyConcepts.map((c, i) => (
            <div key={i} className="rounded border border-border p-2">
              <p className="font-medium text-foreground">{c.concept}</p>
              <p className="text-muted-foreground">{c.explanation}</p>
              <p className="mt-1 text-xs italic text-primary">
                💬 {c.instructorTalkingPoint}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Common Mistakes">
        <ul className="space-y-1">
          {notes.commonMistakes.map((m, i) => (
            <li key={i} className="text-foreground">
              <span className="font-medium">{m.mistake}</span>
              <span className="text-muted-foreground"> — {m.howToAddress}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Suggested Flow">
        <ol className="list-decimal space-y-0.5 pl-5 text-foreground">
          {notes.suggestedFlow.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </Section>

      <Section title="Check Questions">
        <ul className="list-disc space-y-0.5 pl-5 text-foreground">
          {notes.checkQuestions.map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

export function InstructorNotesPanel({
  sessionId,
  language,
  defaultTopic = '',
  getCode,
  height = '100%',
}: InstructorNotesPanelProps) {
  const [topic, setTopic] = useState(defaultTopic);
  const [notes, setNotes] = useState<LessonNotes | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Rehydrate from the cached notes (if any) so toggling the panel off/on or
  // reloading doesn't lose already-generated (paid) work.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getLessonNotes(sessionId);
      if (cancelled) return;
      if (result.success && result.data) {
        setTopic(result.data.topic);
        setNotes(result.data.notes);
      }
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const handleGenerate = async () => {
    const trimmed = topic.trim();
    if (!trimmed || isLoading) return;

    setIsLoading(true);
    try {
      const result = await generateLessonNotes({
        sessionId,
        topic: trimmed,
        language,
        code: getCode(),
      });
      if (result.success) {
        setNotes(result.data);
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error('Failed to generate lesson notes');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <span>📝</span>
          Instructor Notes
          <span className="text-xs font-normal text-muted-foreground">
            (private — only you)
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        <div className="flex gap-2">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleGenerate();
            }}
            placeholder="Lesson topic (e.g. Recursion basics)"
            className="min-w-0 flex-1 rounded border-2 border-input bg-background px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          />
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={isLoading || !topic.trim()}
          >
            {isLoading ? 'Generating…' : notes ? 'Regenerate' : 'Generate'}
          </Button>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto"
          style={{ height }}
        >
          {isLoading || !hydrated ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <div className="text-center">
                <div className="mx-auto h-6 w-6 animate-spin rounded-full border-b-2 border-primary" />
                <p className="mt-2 text-xs">
                  {isLoading ? 'Generating teaching notes…' : 'Loading…'}
                </p>
              </div>
            </div>
          ) : notes ? (
            <NotesView notes={notes} />
          ) : (
            <div className="flex h-full items-center justify-center text-center text-muted-foreground">
              <div>
                <div className="mb-2 text-2xl">📝</div>
                <p className="text-sm">No notes yet</p>
                <p className="mt-1 text-xs">
                  Enter a topic and generate private teaching guidance.
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default InstructorNotesPanel;
