'use client';

import {
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import {
  NotebookPen,
  Lock,
  BookOpen,
  Target,
  Lightbulb,
  AlertTriangle,
  ListOrdered,
  MessageCircleQuestion,
  GraduationCap,
  Code2,
  Copy,
  Check,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { generateLessonNotes, getLessonNotes } from '@/lib/actions/ai-actions';
import type { LessonNotes } from '@/lib/ai/lesson-notes';
import type { Language } from '@/types';

interface InstructorNotesPanelProps {
  sessionId: string;
  language: Language;
  /** Closes the docked notes column (toolbar toggle + header button share it). */
  onClose: () => void;
  /** Pre-fills the topic field (e.g. the session title). */
  defaultTopic?: string;
  /** Returns the current editor code, sent as context for the notes. */
  getCode: () => string;
}

function Section({
  icon: Icon,
  title,
  accent = 'text-primary',
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  accent?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className={cn('size-3.5', accent)} />
        {title}
      </h4>
      <div className="text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function CodeBlock({ code, language }: { code: string; language: Language }) {
  const [copied, setCopied] = useState(false);
  const label = language === 'PYTHON' ? 'python' : 'javascript';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — no-op.
    }
  };

  return (
    <div className="overflow-hidden rounded-md border border-border bg-muted/40">
      <div className="flex items-center justify-between border-b border-border bg-muted px-2 py-1">
        <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed">
        <code className="font-mono text-foreground">
          {code.replace(/\s+$/, '')}
        </code>
      </pre>
    </div>
  );
}

function NotesView({
  notes,
  language,
}: {
  notes: LessonNotes;
  language: Language;
}) {
  // Older cached notes predate some fields — guard every optional array/string.
  const prerequisites = notes.prerequisites ?? [];
  const codeExamples = notes.codeExamples ?? [];

  return (
    <div className="space-y-6">
      <Section icon={BookOpen} title="Overview">
        <p className="text-foreground">{notes.overview}</p>
      </Section>

      {prerequisites.length > 0 && (
        <Section icon={GraduationCap} title="Prerequisites">
          <ul className="list-disc space-y-1 pl-5 text-foreground marker:text-primary">
            {prerequisites.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </Section>
      )}

      <Section icon={Target} title="Objectives">
        <ul className="list-disc space-y-1 pl-5 text-foreground marker:text-primary">
          {notes.objectives.map((o, i) => (
            <li key={i}>{o}</li>
          ))}
        </ul>
      </Section>

      <Section icon={Lightbulb} title="Key Concepts">
        <div className="space-y-2">
          {notes.keyConcepts.map((c, i) => (
            <div
              key={i}
              className="space-y-2 rounded-lg border border-border bg-muted/30 p-3"
            >
              <div>
                <p className="font-medium text-foreground">{c.concept}</p>
                <p className="mt-0.5 text-muted-foreground">{c.explanation}</p>
              </div>
              {c.codeExample?.trim() && (
                <CodeBlock code={c.codeExample} language={language} />
              )}
              <p className="flex items-start gap-1.5 text-xs italic text-primary">
                <MessageCircleQuestion className="mt-0.5 size-3.5 shrink-0" />
                <span>{c.instructorTalkingPoint}</span>
              </p>
            </div>
          ))}
        </div>
      </Section>

      {codeExamples.length > 0 && (
        <Section icon={Code2} title="Worked Examples">
          <div className="space-y-3">
            {codeExamples.map((ex, i) => (
              <div
                key={i}
                className="space-y-2 rounded-lg border border-border bg-muted/30 p-3"
              >
                <div>
                  <p className="font-medium text-foreground">{ex.title}</p>
                  {ex.description && (
                    <p className="mt-0.5 text-muted-foreground">
                      {ex.description}
                    </p>
                  )}
                </div>
                <CodeBlock code={ex.code} language={language} />
                {ex.walkthrough && (
                  <p className="text-muted-foreground">{ex.walkthrough}</p>
                )}
                {ex.expectedOutput?.trim() && (
                  <div className="text-xs">
                    <span className="font-semibold uppercase tracking-wide text-muted-foreground">
                      Output
                    </span>
                    <pre className="mt-1 overflow-x-auto rounded-md border border-border bg-background p-2 font-mono text-foreground">
                      {ex.expectedOutput.replace(/\s+$/, '')}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section
        icon={AlertTriangle}
        title="Common Mistakes"
        accent="text-destructive"
      >
        <ul className="space-y-3">
          {notes.commonMistakes.map((m, i) => (
            <li key={i} className="space-y-1.5">
              <div className="flex gap-2 text-foreground">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-destructive" />
                <span>
                  <span className="font-medium">{m.mistake}</span>
                  <span className="text-muted-foreground">
                    {' '}
                    — {m.howToAddress}
                  </span>
                </span>
              </div>
              {m.codeExample?.trim() && (
                <div className="pl-3.5">
                  <CodeBlock code={m.codeExample} language={language} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Section icon={ListOrdered} title="Suggested Flow">
        <ol className="list-decimal space-y-1 pl-5 text-foreground marker:font-medium marker:text-primary">
          {notes.suggestedFlow.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </Section>

      <Section icon={MessageCircleQuestion} title="Check Questions">
        <ul className="list-disc space-y-1 pl-5 text-foreground marker:text-primary">
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
  onClose,
  defaultTopic = '',
  getCode,
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
        // If notes already exist, an explicit click means "regenerate" — force
        // a fresh generation that overwrites the cached copy.
        regenerate: Boolean(notes),
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
          <NotebookPen className="size-4 shrink-0 text-primary" />
          <span className="truncate">Instructor Notes</span>
          <span className="hidden items-center gap-1 text-xs font-normal text-muted-foreground sm:flex">
            <Lock className="size-3" />
            private
          </span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          className="size-7 shrink-0 p-0 text-muted-foreground hover:text-foreground"
          title="Close notes"
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* Topic generator */}
      <div className="flex gap-2 border-b border-border p-3">
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleGenerate();
          }}
          placeholder="Lesson topic (e.g. Recursion basics)"
          className="min-w-0 flex-1 rounded-md border-2 border-input bg-background px-3 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button
          size="sm"
          onClick={handleGenerate}
          disabled={isLoading || !topic.trim()}
        >
          {isLoading ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <Sparkles className="size-3.5" />
              {notes ? 'Regenerate' : 'Generate'}
            </>
          )}
        </Button>
      </div>

      {/* Scrollable notes body — always fits the column height */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {isLoading || !hydrated ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Loader2 className="mx-auto size-6 animate-spin text-primary" />
              <p className="mt-2 text-xs">
                {isLoading ? 'Generating teaching notes…' : 'Loading…'}
              </p>
            </div>
          </div>
        ) : notes ? (
          <NotesView notes={notes} language={language} />
        ) : (
          <div className="flex h-full items-center justify-center text-center text-muted-foreground">
            <div className="max-w-xs">
              <NotebookPen className="mx-auto mb-3 size-8 opacity-50" />
              <p className="text-sm font-medium text-foreground">No notes yet</p>
              <p className="mt-1 text-xs">
                Enter a lesson topic above and generate private teaching guidance
                — talking points, common mistakes, and check questions.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default InstructorNotesPanel;
