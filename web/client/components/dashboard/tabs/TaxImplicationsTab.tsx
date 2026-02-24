import React from "react";
import { InsurancePolicy } from "@shared/mock-data";

export const TaxImplicationsTab: React.FC<{ policy: InsurancePolicy }> = ({ policy }) => {
  const rows = [
    { item: "Deferred gains", detail: "No immediate tax until withdrawal" },
    { item: "Cost basis", detail: `Tracked at ${policy.costBasis}` },
    { item: "Withdrawals", detail: "Ordinary income after basis is recovered" },
    { item: "Surrender", detail: "Potential surrender charges and tax on gains" },
  ];

  return (
    <div className="mt-4 bg-white border rounded">
      <div className="flex items-center justify-between p-4 border-b">
        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Tax Implications</h4>
        <span className="text-[10px] text-gray-400">Mock guidance</span>
      </div>
      <div className="divide-y text-[11px]">
        {rows.map((row) => (
          <div key={row.item} className="px-4 py-3">
            <div className="text-gray-800 font-semibold">{row.item}</div>
            <div className="text-gray-500">{row.detail}</div>
          </div>
        ))}
      </div>
      <div className="px-4 py-3 text-[10px] text-gray-500 bg-gray-50">Consult a tax professional for personalized advice.</div>
    </div>
  );
};
