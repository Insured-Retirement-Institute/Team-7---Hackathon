import React, { useMemo, useState } from "react";
import { InsurancePolicy } from "@shared/mock-data";

type Mode = "declining" | "guaranteed";

export const ChartTab: React.FC<{ policy: InsurancePolicy }> = ({ policy }) => {
  const [mode, setMode] = useState<Mode>("declining");

  const incomeSeries = useMemo(() => {
    const years = Array.from({ length: 20 }, (_, i) => i + 1);

    if (mode === "guaranteed") {
      const annual = 35000;
      return years.map((year) => ({ year, amount: annual }));
    }

    const start = 52000;
    const step = 1800; // decreases each year
    return years.map((year) => ({ year, amount: Math.max(0, start - step * (year - 1)) }));
  }, [mode]);

  const maxIncome = Math.max(...incomeSeries.map((d) => d.amount), 1);

  return (
    <div className="mt-4 bg-white border rounded p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Projected Income</h4>
        <div className="flex gap-2 text-[11px] font-semibold">
          <button
            onClick={() => setMode("declining")}
            className={`px-3 py-1 rounded-full transition-colors ${mode === "declining" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            Non-Guaranteed
          </button>
          <button
            onClick={() => setMode("guaranteed")}
            className={`px-3 py-1 rounded-full transition-colors ${mode === "guaranteed" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            Guaranteed
          </button>
        </div>
      </div>

      <div className="bg-gray-50 border rounded p-3">
        <div className="relative h-56 w-full flex items-end gap-2 pb-4">
          <div className="absolute inset-x-0 bottom-0 h-px bg-gray-200" />
          {incomeSeries.map((point) => (
            <div key={point.year} className="flex-1 h-full flex flex-col items-center gap-1 justify-end">
              <div
                className="w-full bg-blue-500 rounded-t shadow-sm"
                style={{ height: `${Math.max(4, (point.amount / maxIncome) * 100)}%` }}
                title={`Year ${point.year}: ${formatIncome(point.amount)}`}
              />
              <span className="text-[10px] text-gray-500">{point.year}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-between text-[11px] text-gray-600">
          <span>{mode === "guaranteed" ? "Even income over 20 years" : "Declining income until depletion"}</span>
          <span className="font-semibold">Policy: {policy.name}</span>
        </div>
      </div>
    </div>
  );
};

function formatIncome(value: number) {
  return value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
