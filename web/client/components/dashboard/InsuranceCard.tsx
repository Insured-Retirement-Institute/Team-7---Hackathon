import React, { useState } from "react";
import { ExternalLink, TrendingUp, ShieldCheck, CircleDollarSign, TreeDeciduous } from "lucide-react";
import { InsurancePolicy } from "@shared/mock-data";
import { cn } from "@/lib/utils";

const benefits = [
  { Icon: TrendingUp, label: "Growth", activeColor: "text-emerald-600", activeFill: "", key: "growth" },
  { Icon: ShieldCheck, label: "Protection", activeColor: "text-blue-600", activeFill: "", key: "principalProtection" },
  { Icon: CircleDollarSign, label: "Income", activeColor: "text-violet-600", activeFill: "", key: "income" },
  { Icon: TreeDeciduous, label: "Legacy", activeColor: "text-green-800", activeFill: "fill-green-600", key: "deathBenefit" },
] as const;

interface Props {
  policy: InsurancePolicy;
  isSelected: boolean;
  onSelect: (policy: InsurancePolicy) => void;
  onViewDetails?: (policy: InsurancePolicy) => void;
}

export const InsuranceCard: React.FC<Props> = ({ policy, isSelected, onSelect, onViewDetails }) => {
  return (
    <div
      className={cn(
        "bg-white border transition-all duration-200 cursor-pointer hover:shadow-md flex flex-col",
        isSelected ? "border-blue-500 ring-1 ring-blue-500 shadow-sm" : "border-gray-200"
      )}
      onClick={() => onSelect(policy)}
    >
      <div className="p-4">
        {/* Card Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="text-sm font-bold text-gray-800 leading-tight mb-0.5">{policy.name}</h3>
            <span className="text-[10px] text-gray-400">As of {policy.asOfDate}</span>
          </div>
          <ExternalLink size={14} className="text-blue-500 opacity-60 flex-shrink-0" />
        </div>

        {/* Date / Value Header */}
        <div className="grid grid-cols-3 gap-2 mb-6 border-b border-gray-100 pb-3">
          <div className="flex flex-col">
            <span className="text-gray-900 font-bold text-xs">{policy.issueEffective}</span>
            <span className="text-[9px] text-gray-400 uppercase tracking-tighter">Issue Effective</span>
          </div>
          <div className="flex flex-col">
            <span className="text-gray-900 font-bold text-xs">{policy.valuationDate}</span>
            <span className="text-[9px] text-gray-400 uppercase tracking-tighter">Valuation Date</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-blue-700 font-bold text-xs">{policy.value}</span>
            <span className="text-[9px] text-gray-400 uppercase tracking-tighter">Value</span>
          </div>
        </div>

        {/* Details Grid */}
        <div className="space-y-1.5 text-[11px]">
          <div className="flex justify-between">
            <span className="text-gray-400">Contract Number</span>
            <span className="text-gray-700 font-medium">{policy.contractNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Issuer</span>
            <span className="text-gray-700 font-medium">{policy.issuer}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Product Type</span>
            <span className="text-gray-700 font-medium">{policy.productType}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Total Premium</span>
            <span className="text-gray-700 font-medium">{policy.totalPremium}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Total Withdrawal</span>
            <span className="text-gray-700 font-medium">{policy.totalWithdrawal}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Surrender Value</span>
            <span className="text-gray-700 font-medium">{policy.surrenderValue}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Cost Basis</span>
            <span className="text-gray-700 font-medium">{policy.costBasis}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Net Death Benefit</span>
            <span className="text-gray-700 font-medium">{policy.netDeathBenefit}</span>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 mx-4" />

      {/* Benefit icons */}
      <div className="flex-1 flex items-center justify-between px-4 py-3">
        {benefits.map(({ Icon, label, activeColor, activeFill, key }) => {
          const active = policy.benefits?.[key] ?? false;
          return (
            <div key={label} className="flex flex-col items-center gap-0.5">
              <Icon size={18} className={active ? cn(activeColor, activeFill) : "text-gray-300"} />
              <span className={cn("text-[8px] uppercase tracking-tight leading-none", active ? "text-gray-400" : "text-gray-300")}>
                {label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/30 flex items-center">
        <button 
           className="text-[10px] text-blue-600 font-medium hover:underline"
           onClick={(e) => {
             e.stopPropagation();
             onSelect(policy);
             onViewDetails?.(policy);
           }}
        >
          View Detail
        </button>
      </div>
    </div>
  );
};
