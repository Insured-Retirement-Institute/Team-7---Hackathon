import React from "react";

export const WatchItemsTab: React.FC = () => {
  const watchItems = [
    { ranking: 1, title: "Rider review", description: "Check quarterly adjustments" },
    { ranking: 2, title: "Beneficiary update", description: "Confirm latest filing" },
    { ranking: 3, title: "Fee audit", description: "Compare custodian statements" },
    { ranking: 4, title: "Upcoming RMD", description: "Review required minimum distributions" },
  ];

  const sortedWatchItems = [...watchItems].sort((a, b) => b.ranking - a.ranking);

  return (
    <div className="mt-4 bg-white border rounded p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Watch Items</h4>
        <span className="text-[10px] text-gray-400">Mock list</span>
      </div>
      <div className="space-y-2 text-[11px]">
        {sortedWatchItems.map((item) => (
          <div key={item.title} className="border rounded px-3 py-2">
            <div className="text-gray-800 font-semibold">{item.title}</div>
            <div className="text-gray-500">{item.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
