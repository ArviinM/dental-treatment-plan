import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';

export const metadata = { title: 'History | SIA Dental' };

const PAGE_SIZE = 100;

/** "Today", "Yesterday", or a date — how a person actually talks about when. */
function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';

  return date.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
}

export default async function ActivityPage() {
  await requireAdmin();

  const supabase = await createClient();
  const { data } = await supabase
    .from('activity_log')
    .select('id, actor_name, summary, created_at, entity_type')
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);

  const entries = data ?? [];

  // Grouped by day so a long list reads as a diary rather than a wall of rows.
  const days = new Map<string, typeof entries>();
  for (const entry of entries) {
    const label = dayLabel(entry.created_at);
    days.set(label, [...(days.get(label) ?? []), entry]);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-sia-dark">History</h1>
        <p className="mt-2 text-slate-500">Who changed what, and when.</p>
      </header>

      {entries.length === 0 ? (
        <p className="rounded-lg border bg-white p-8 text-center text-sm text-slate-500">
          Nothing has been changed yet. Edits to fees, dentists, templates and accounts will show up
          here.
        </p>
      ) : (
        <div className="space-y-8">
          {[...days.entries()].map(([label, items]) => (
            <section key={label}>
              <h2 className="mb-3 text-sm font-semibold text-slate-400">{label}</h2>
              <ul className="divide-y rounded-lg border bg-white">
                {items.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 p-4">
                    <span className="w-16 shrink-0 text-sm tabular-nums text-slate-400">
                      {timeLabel(entry.created_at)}
                    </span>
                    <span className="min-w-0 flex-1 text-sm text-sia-dark">
                      <span className="font-medium">{entry.actor_name}</span>
                      {' — '}
                      {entry.summary}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {entries.length === PAGE_SIZE && (
        <p className="mt-6 text-sm text-slate-400">
          Showing the {PAGE_SIZE} most recent changes.
        </p>
      )}
    </div>
  );
}
