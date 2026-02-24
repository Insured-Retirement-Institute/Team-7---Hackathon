import React from "react";
import { InsurancePolicy } from "@shared/mock-data";

export const ChartTab: React.FC<{ policy: InsurancePolicy }> = ({ policy }) => {
  return (
    <div className="mt-4 bg-white border rounded p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Performance Snapshot</h4>
        <span className="text-[10px] text-gray-400">Mock chart</span>
      </div>
      <div className="h-48 rounded bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 text-xs font-semibold">
        Chart placeholder for {policy.name}
      </div>
      <div className="grid grid-cols-3 gap-4 mt-4 text-[11px]">
        {["YTD", "1Y", "5Y"].map((label) => (
          <div key={label} className="flex flex-col">
            <span className="text-gray-400">{label} Return</span>
            <span className="text-gray-800 font-bold">+{(Math.random() * 8 + 2).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};
