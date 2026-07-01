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
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { generateLessonNotes, getLessonNotes } from '@/lib/actions/ai-actions';
import type { LessonNotes } from '@/lib/ai/lesson-notes';
import type { Language } from '@/types';

interface InstructorNotesPanelProps {
  sessionId: string;
  language: Language;
  /** Controls the slide-over visibility. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

function NotesView({ notes }: { notes: LessonNotes }) {
  return (
    <div className="space-y-6">
      <Section icon={BookOpen} title="Overview">
        <p className="text-foreground">{notes.overview}</p>
      </Section>

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
              className="rounded-lg border border-border bg-muted/30 p-3"
            >
              <p className="font-medium text-foreground">{c.concept}</p>
              <p className="mt-0.5 text-muted-foreground">{c.explanation}</p>
              <p className="mt-2 flex items-start gap-1.5 text-xs italic text-primary">
                <MessageCircleQuestion className="mt-0.5 size-3.5 shrink-0" />
                <span>{c.instructorTalkingPoint}</span>
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        icon={AlertTriangle}
        title="Common Mistakes"
        accent="text-destructive"
      >
        <ul className="space-y-1.5">
          {notes.commonMistakes.map((m, i) => (
            <li key={i} className="flex gap-2 text-foreground">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-destructive" />
              <span>
                <span className="font-medium">{m.mistake}</span>
                <span className="text-muted-foreground">
                  {' '}
                  — {m.howToAddress}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section icon={ListOrdered} title="Suggested Flow">
        <ol className="list-decimal space-y-1 pl-5 text-foreground marker:text-primary marker:font-medium">
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
  open,
  onOpenChange,
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
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        side="right"
        overlay={false}
        // Pinned reference panel: keep it open while the instructor keeps
        // coding — only the X button or the toolbar toggle closes it.
        onInteractOutside={(e) => e.preventDefault()}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md lg:max-w-lg"
      >
        <SheetHeader className="gap-1 border-b border-border p-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <NotebookPen className="size-4 text-primary" />
            Instructor Notes
          </SheetTitle>
          <SheetDescription className="flex items-center gap-1.5 text-xs">
            <Lock className="size-3" />
            Private — only visible to you
          </SheetDescription>
        </SheetHeader>

        {/* Topic generator */}
        <div className="flex gap-2 border-b border-border p-4">
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

        {/* Scrollable notes body — always fits the viewport height */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
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
            <NotesView notes={notes} />
          ) : (
            <div className="flex h-full items-center justify-center text-center text-muted-foreground">
              <div className="max-w-xs">
                <NotebookPen className="mx-auto mb-3 size-8 opacity-50" />
                <p className="text-sm font-medium text-foreground">
                  No notes yet
                </p>
                <p className="mt-1 text-xs">
                  Enter a lesson topic above and generate private teaching
                  guidance — talking points, common mistakes, and check
                  questions.
                </p>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default InstructorNotesPanel;
