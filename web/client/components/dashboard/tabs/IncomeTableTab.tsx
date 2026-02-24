import React from "react";
import { InsurancePolicy } from "@shared/mock-data";

export const IncomeTableTab: React.FC<{ policy: InsurancePolicy }> = ({ policy }) => {
  const rows = [
    { year: "2025", income: "$48,200", growth: "+4.2%" },
    { year: "2026", income: "$50,150", growth: "+4.0%" },
    { year: "2027", income: "$52,310", growth: "+4.3%" },
  ];

  return (
    <div className="mt-4 bg-white border rounded">
      <div className="flex items-center justify-between p-4 border-b">
        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Income Schedule</h4>
        <span className="text-[10px] text-gray-400">Mock data</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-[11px]">
          <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-2">Year</th>
              <th className="text-left px-4 py-2">Projected Income</th>
              <th className="text-left px-4 py-2">Growth</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.year} className="border-t">
                <td className="px-4 py-2 text-gray-700 font-medium">{row.year}</td>
                <td className="px-4 py-2 text-gray-800">{row.income}</td>
                <td className="px-4 py-2 text-green-600 font-semibold">{row.growth}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 text-[11px] text-gray-500">Summary based on {policy.productType}</div>
    </div>
  );
};
