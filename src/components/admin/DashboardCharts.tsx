'use client';

import { CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface DayCount {
  date: string;
  count: number;
}

const PLAN_COLORS = ['#94A3B8', '#6366F1'];

export default function DashboardCharts({
  signups,
  projectsCreated,
  exports: exportCounts,
  aiUses,
  planBreakdown,
}: {
  signups: DayCount[];
  projectsCreated: DayCount[];
  exports: DayCount[];
  aiUses: DayCount[];
  planBreakdown: Array<{ name: string; value: number }>;
}) {
  return (
    <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
      <ChartCard title="Signups (30d)" className="lg:col-span-2">
        <LineTrend data={signups} color="#6366F1" />
      </ChartCard>
      <ChartCard title="Plan breakdown">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={planBreakdown} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
              {planBreakdown.map((entry, i) => (
                <Cell key={entry.name} fill={PLAN_COLORS[i % PLAN_COLORS.length]} />
              ))}
            </Pie>
            <Legend />
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Projects created (30d)">
        <LineTrend data={projectsCreated} color="#10B981" />
      </ChartCard>
      <ChartCard title="Exports (30d)">
        <LineTrend data={exportCounts} color="#F59E0B" />
      </ChartCard>
      <ChartCard title="AI Director uses (30d)">
        <LineTrend data={aiUses} color="#EC4899" />
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, className, children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-neutral-900 ${className ?? ''}`}>
      <h3 className="mb-2 text-[13px] font-bold text-neutral-500 dark:text-neutral-400">{title}</h3>
      {children}
    </div>
  );
}

function LineTrend({ data, color }: { data: DayCount[]; color: string }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
        <XAxis dataKey="date" fontSize={11} interval="preserveStartEnd" />
        <YAxis fontSize={11} allowDecimals={false} width={28} />
        <Tooltip />
        <Line type="monotone" dataKey="count" stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
