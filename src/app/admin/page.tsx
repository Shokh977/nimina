import DashboardCharts from '@/components/admin/DashboardCharts';
import { createClient } from '@/lib/supabase/server';

const DAYS = 30;

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function daysAgoIso(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

function lastNDays(n: number): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function bucketByDay(dates: string[], days: string[]): Array<{ date: string; count: number }> {
  const counts = new Map(days.map((d) => [d, 0]));
  for (const iso of dates) {
    const key = dayKey(iso);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return days.map((date) => ({ date: date.slice(5), count: counts.get(date) ?? 0 }));
}

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const since = daysAgoIso(DAYS);
  const days = lastNDays(DAYS);

  const [{ data: profiles }, { data: events }] = await Promise.all([
    supabase.from('profiles').select('plan, created_at'),
    supabase.from('events').select('type, created_at').gte('created_at', since),
  ]);

  const allProfiles = profiles ?? [];
  const allEvents = events ?? [];
  const proCount = allProfiles.filter((p) => p.plan === 'pro').length;
  const freeCount = allProfiles.length - proCount;

  const signups = bucketByDay(
    allProfiles.filter((p) => p.created_at >= since).map((p) => p.created_at),
    days,
  );
  const projectsCreated = bucketByDay(
    allEvents.filter((e) => e.type === 'project_created').map((e) => e.created_at),
    days,
  );
  const exports = bucketByDay(
    allEvents.filter((e) => e.type === 'export_completed').map((e) => e.created_at),
    days,
  );
  const aiUses = bucketByDay(
    allEvents.filter((e) => e.type === 'ai_director_used').map((e) => e.created_at),
    days,
  );

  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total users" value={allProfiles.length} />
        <Stat label="Pro" value={proCount} />
        <Stat label="Free" value={freeCount} />
        <Stat label={`Exports (${DAYS}d)`} value={exports.reduce((s, d) => s + d.count, 0)} />
      </div>
      <DashboardCharts signups={signups} projectsCreated={projectsCreated} exports={exports} aiUses={aiUses} planBreakdown={[{ name: 'Free', value: freeCount }, { name: 'Pro', value: proCount }]} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-neutral-900">
      <div className="text-[12.5px] font-semibold text-neutral-500 dark:text-neutral-400">{label}</div>
      <div className="mt-1 text-[26px] font-bold">{value}</div>
    </div>
  );
}
