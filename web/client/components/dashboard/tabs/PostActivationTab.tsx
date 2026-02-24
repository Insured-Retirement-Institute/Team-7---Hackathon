import React from "react";
import { InsurancePolicy } from "@shared/mock-data";
import { cn } from "@/lib/utils";

export const PostActivationTab: React.FC<{ policy: InsurancePolicy }> = ({ policy }) => {
  const items = [
    { label: "KYC verification", status: "Complete" },
    { label: "Funding confirmation", status: "In Progress" },
    { label: "Rider activation", status: "Scheduled" },
  ];

  return (
    <div className="mt-4 bg-white border rounded p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Post Activation</h4>
        <span className="text-[10px] text-gray-400">Mock tasks</span>
      </div>
      <ul className="space-y-2 text-[11px]">
        {items.map((item) => (
          <li key={item.label} className="flex items-center justify-between rounded border px-3 py-2">
            <span className="text-gray-700 font-medium">{item.label}</span>
            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-semibold",
                item.status === "Complete"
                  ? "bg-green-100 text-green-700"
                  : item.status === "In Progress"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-amber-100 text-amber-700"
              )}
            >
              {item.status}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[10px] text-gray-500">Linked to contract {policy.contractNumber}</p>
    </div>
  );
};
