import Link from 'next/link';
import { Code2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Contact address surfaced on the legal pages. Google's OAuth verification
 * checks that the privacy policy exposes a working contact, so this must be a
 * real, monitored inbox on the production domain before submitting for review.
 */
export const LEGAL_CONTACT_EMAIL = 'support@simplemart.dev';

interface LegalPageProps {
  title: string;
  /** Human-readable effective date, e.g. "July 16, 2026". */
  lastUpdated: string;
  children: React.ReactNode;
}

/**
 * Shared shell for static legal pages (Privacy Policy, Terms of Service).
 * Mirrors the landing page header/footer so the pages stay on-brand, and keeps
 * the content in a readable, single-column measure.
 */
export function LegalPage({ title, lastUpdated, children }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className="fixed top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <Code2 className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold">Codely</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/signup">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-28 sm:px-6 lg:px-8">
        <div className="mb-10 border-b border-border pb-8">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Last updated: {lastUpdated}
          </p>
        </div>

        <div className="space-y-10">{children}</div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Code2 className="h-4 w-4" />
            <span>Codely</span>
          </div>
          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms of Service
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

/** A titled section with an anchor id for deep-linking. */
export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="mb-3 text-xl font-semibold tracking-tight">{title}</h2>
      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

/** Bulleted list styled to match the muted body copy. */
export function LegalList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 pl-6 marker:text-muted-foreground/60">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
