import React, { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { InsurancePolicy, policyProjection } from "@shared/mock-data";

export const ChartTab: React.FC<{ policy?: InsurancePolicy }> = ({ policy }) => {
  const chartData = useMemo(
    () =>
      policyProjection.map((row) => ({
        ...row,
        netAccumValue: Math.max(0, row.accumValue - row.fee),
      })),
    []
  );

  return (
    <div className="mt-4 bg-white border rounded p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Accumulation vs Fees</h4>
          <p className="text-[11px] text-gray-500">Stacked bar of account value and annual fees</p>
        </div>
        {policy ? <span className="text-[11px] text-gray-600 font-semibold">{policy.name}</span> : null}
      </div>

      <div className="bg-gray-50 border rounded p-3 h-96">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 16, left: 4, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="year" tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={formatCompact} tick={{ fontSize: 10 }} width={56} domain={[0, "auto"]} />
            <Tooltip formatter={tooltipFormatter} labelFormatter={(label) => `Year ${label}`} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="netAccumValue" stackId="value" fill="#3b82f6" name="Accum (net of fees)" />
            <Bar dataKey="fee" stackId="value" fill="#f97316" name="Fees" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

function formatCompact(value: number) {
  return value >= 1000 ? `${Math.round(value / 1000)}k` : value.toString();
}

function tooltipFormatter(value: number, name: string) {
  const label = name === "netAccumValue" ? "Accum (net of fees)" : name === "fee" ? "Fees" : name;
  return [value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }), label];
}
