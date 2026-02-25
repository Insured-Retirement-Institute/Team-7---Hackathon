import React, { useMemo, ReactNode } from "react";
import {
  ComposedChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, ReferenceLine,
} from "recharts";
import { InsurancePolicy, policyProjection } from "@shared/mock-data";

interface YearlyRow {
  age: number;
  growth: number;
  fees: number;
  income: number;
  grossAV: number;
  netAV: number;
  phase: "accumulation" | "income" | "pip";
}

const AgeYearTick: React.FC<any> = ({ x, y, payload, baseAge, baseYear }) => {
  const age: number = payload.value;
  const year = baseYear + (age - baseAge);
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={12} textAnchor="middle" fill="#6b7280" fontSize={10}>{age}</text>
      <text x={0} y={0} dy={24} textAnchor="middle" fill="#9ca3af" fontSize={9}>{year}</text>
    </g>
  );
};

export const ChartTab: React.FC<{ policy?: InsurancePolicy; sidebar?: ReactNode; chartData?: YearlyRow[] }> = ({ policy, sidebar, chartData }) => {
  const baseAge = policy?.clientAge ?? 63;
  const baseYear = useMemo(() => {
    const d = policy?.valuationDate;
    if (!d || d === "--") return new Date().getFullYear();
    const parts = d.split("/");
    if (parts.length === 3) return parseInt(parts[2]);
    return new Date(d).getFullYear();
  }, [policy?.valuationDate]);

  // Fall back to static mock data if live data isn't available yet
  const fallbackData = useMemo(
    () =>
      policyProjection.map((row) => ({
        age: row.age,
        netAV: Math.max(0, row.accumValue - row.fee),
        fees: row.fee,
        income: row.income,
        growth: Math.round(row.accumValue * 0.052),
        grossAV: row.accumValue,
        phase: "accumulation" as const,
      })),
    []
  );

  const data = chartData && chartData.length > 0 ? chartData : fallbackData;
  const hasLiveData = chartData && chartData.length > 0;

  // Find the age where income phase begins (for the reference line)
  const incomeStartAge = data.find((r) => r.phase === "income")?.age;

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="bg-white border rounded p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Account Value Breakdown by Year
            </h4>
            <p className="text-[11px] text-gray-500">
              {hasLiveData
                ? "Net account value, income, fees, and growth from current age to life expectancy"
                : "Loading rider data — showing projected accumulation"}
            </p>
          </div>
          {policy && <span className="text-[11px] text-gray-600 font-semibold">{policy.name}</span>}
        </div>

        <div className="bg-gray-50 border rounded p-3 h-[32rem]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 24, right: 16, left: 4, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="age" tick={<AgeYearTick baseAge={baseAge} baseYear={baseYear} />} height={44} />
              <YAxis tickFormatter={formatCompact} tick={{ fontSize: 10 }} width={60} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />

              {incomeStartAge && (
                <ReferenceLine x={incomeStartAge} stroke="#6366f1" strokeDasharray="4 2" label={{ value: "Income Start", position: "top", fontSize: 9, fill: "#6366f1" }} />
              )}

              {/* Stacked bars: netAV base, then fees + income on top — total = grossAV */}
              <Bar dataKey="netAV" stackId="av" fill="#3b82f6" name="Net Account Value" />
              <Bar dataKey="fees" stackId="av" fill="#f97316" name="Fees" />
              <Bar dataKey="income" stackId="av" fill="#10b981" name="Income Paid" />

              <Bar dataKey="growth" stackId="av" fill="#8b5cf6" name="Annual Growth" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {sidebar && <div className="w-full">{sidebar}</div>}
    </div>
  );
};

function formatCompact(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${value}`;
}

function formatCurrency(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

const PHASE_LABELS: Record<string, string> = {
  accumulation: "Accumulation",
  income: "Income (MAWP)",
  pip: "Guaranteed (PIP)",
};

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const row: YearlyRow = payload[0]?.payload;
  return (
    <div className="bg-white border border-gray-200 rounded shadow-md p-3 text-[11px] min-w-[180px]">
      <div className="font-bold text-gray-800 mb-2">Age {label} — <span className="text-blue-500 font-normal">{PHASE_LABELS[row.phase] ?? row.phase}</span></div>
      <div className="space-y-1">
        <TooltipRow label="Gross Account Value" value={row.grossAV} color="#1d4ed8" />
        <TooltipRow label="Annual Growth" value={row.growth} color="#8b5cf6" />
        <TooltipRow label="Fees" value={row.fees} color="#f97316" />
        <TooltipRow label="Income Paid" value={row.income} color="#10b981" />
        <TooltipRow label="Net Account Value" value={row.netAV} color="#3b82f6" />
      </div>
    </div>
  );
};

const TooltipRow: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div className="flex justify-between gap-4">
    <span style={{ color }} className="font-medium">{label}</span>
    <span className="text-gray-700 font-semibold">{formatCurrency(value)}</span>
  </div>
);
