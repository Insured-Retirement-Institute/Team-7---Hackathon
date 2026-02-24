import React from "react";

export const WatchItemsTab: React.FC = () => {
  const items = [
    { name: "Rider review", note: "Check quarterly adjustments" },
    { name: "Beneficiary update", note: "Confirm latest filing" },
    { name: "Fee audit", note: "Compare custodian statements" },
  ];

  return (
    <div className="mt-4 bg-white border rounded p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Watch Items</h4>
        <span className="text-[10px] text-gray-400">Mock list</span>
      </div>
      <div className="space-y-2 text-[11px]">
        {items.map((item) => (
          <div key={item.name} className="border rounded px-3 py-2">
            <div className="text-gray-800 font-semibold">{item.name}</div>
            <div className="text-gray-500">{item.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
