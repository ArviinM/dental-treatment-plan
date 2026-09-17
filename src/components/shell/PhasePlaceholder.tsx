import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type PhasePlaceholderProps = {
  title: string;
  phase: string;
  description: string;
  /** What this page will do once the phase lands. */
  bullets: string[];
};

/**
 * Stand-in for a route the dashboard already links to but whose feature has not
 * been built yet. Better than a dead link or a 404: it shows the shape of the
 * dashboard while making it obvious nothing is broken.
 */
export function PhasePlaceholder({ title, phase, description, bullets }: PhasePlaceholderProps) {
  return (
    <main className="container mx-auto px-4 py-10">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {phase}
            </span>
          </div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ul className="space-y-2 text-sm text-muted-foreground">
            {bullets.map((bullet) => (
              <li key={bullet} className="flex gap-2">
                <span aria-hidden className="text-sia-teal">
                  •
                </span>
                {bullet}
              </li>
            ))}
          </ul>
          <div className="rounded-md border border-sia-teal/30 bg-sia-teal/5 p-4 text-sm">
            <p className="font-medium text-sia-dark">Nothing has changed for you yet.</p>
            <p className="mt-1 text-muted-foreground">
              Keep using the generator exactly as you do today — it is not going away.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link href="/legacy">Open the generator</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
