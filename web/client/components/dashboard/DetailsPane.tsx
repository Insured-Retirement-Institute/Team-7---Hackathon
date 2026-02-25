import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { InsurancePolicy } from "@shared/mock-data";
import { cn } from "@/lib/utils";
import { ChartTab } from "@/components/dashboard/tabs/ChartTab";
import { IncomeTableTab } from "@/components/dashboard/tabs/IncomeTableTab";
import { PostActivationTab } from "@/components/dashboard/tabs/PostActivationTab";
import { TaxImplicationsTab } from "@/components/dashboard/tabs/TaxImplicationsTab";
import { WatchItemsTab } from "@/components/dashboard/tabs/WatchItemsTab";
import { FullViewTab } from "@/components/dashboard/tabs/FullViewTab";
import { AnnuityBenefitsTab } from "@/components/dashboard/tabs/AnnuityBenefitsTab";

interface Props {
  policy: InsurancePolicy | null;
  isOpen: boolean;
  onClose: () => void;
}

export const DetailsPane: React.FC<Props> = ({ policy, isOpen, onClose }) => {
  if (!policy) return null;

  const tabs = ["Chart", "Income Table", "Post Activation", "Tax Implications", "Watch Items", "Full View", "Annuity Benefits"] as const;
  type Tab = (typeof tabs)[number];
  const [activeTab, setActiveTab] = useState<Tab>("Chart");
  const [beaconData, setBeaconData] = useState<unknown>(null);

  useEffect(() => {
    if (!policy.cusip || !policy.policyDate) {
      setBeaconData(null);
      return;
    }

    // Convert MM/DD/YYYY → YYYY-MM-DD for the API call
    let formattedDate = policy.policyDate;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(policy.policyDate)) {
      const [month, day, year] = policy.policyDate.split("/");
      formattedDate = `${year}-${month}-${day}`;
    }

    fetch(`/api/beacon/${policy.cusip}/${formattedDate}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => setBeaconData(data))
      .catch(() => setBeaconData(null));
  }, [policy.cusip, policy.policyDate]);

  return (
    <aside
      className={cn(
        "fixed inset-0 z-30 transition-opacity duration-200",
        isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      )}
      aria-hidden={!isOpen}
    >
      {/* Backdrop to dim main content */}
      <div className="absolute left-0 right-0 top-14 bottom-0 bg-black/30" onClick={onClose} />

      {/* Content starts below header (h-14) and spans full width */}
      <div className="absolute left-0 right-0 top-14 bottom-0 bg-white shadow-2xl border-t border-gray-200 flex flex-col">
        <div className="border-b p-4">
          <div className="max-w-[1200px] mx-auto flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Details</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X size={16} className="text-gray-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-[1200px] mx-auto space-y-6">
        {/* Title and date */}
        <div className="border-b pb-4">
          <h3 className="text-sm font-bold text-primary mb-1">{policy.name}</h3>
          <p className="text-[10px] text-gray-400">As of {policy.asOfDate}</p>

          <div className="grid grid-cols-3 gap-2 mt-4">
             <div className="flex flex-col">
              <span className="text-gray-900 font-bold text-[11px]">{policy.issueEffective}</span>
              <span className="text-[9px] text-gray-400 uppercase tracking-tight">Issue Effective</span>
            </div>
            <div className="flex flex-col">
              <span className="text-gray-900 font-bold text-[11px]">{policy.valuationDate}</span>
              <span className="text-[9px] text-gray-400 uppercase tracking-tight">Valuation Date</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-blue-700 font-bold text-[11px]">{policy.value}</span>
              <span className="text-[9px] text-gray-400 uppercase tracking-tight">Value</span>
            </div>
          </div>
        </div>

        <div className="border-b pb-2">
          <div className="inline-flex text-[11px] font-semibold text-gray-600 border border-gray-200">
            {tabs.map((tab, i) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-3 py-1.5 transition-colors whitespace-nowrap",
                  i > 0 && "border-l border-gray-200",
                  activeTab === tab ? "bg-blue-600 text-white border-blue-600" : "bg-white hover:bg-gray-50"
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <TabContent activeTab={activeTab} policy={policy} beaconData={beaconData} />
        </div>
      </div>

        <div className="p-4 bg-gray-50 border-t flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-1.5 bg-blue-600 text-white text-[11px] font-bold rounded hover:bg-blue-700 transition-colors"
        >
          Close
        </button>
        </div>
      </div>
    </aside>
  );
};

// ---------- Tab Content Components ----------

const TabContent: React.FC<{ activeTab: string; policy: InsurancePolicy; beaconData: unknown }> = ({ activeTab, policy, beaconData }) => {
  switch (activeTab) {
    case "Chart":
      return <ChartTab policy={policy} />;
    case "Income Table":
      return <IncomeTableTab policy={policy} />;
    case "Post Activation":
      return <PostActivationTab policy={policy} />;
    case "Tax Implications":
      return <TaxImplicationsTab policy={policy} />;
    case "Watch Items":
      return <WatchItemsTab />;
    case "Annuity Benefits":
      return <AnnuityBenefitsTab beaconData={beaconData} />;
    case "Full View":
    default:
      return <FullViewTab policy={policy} />;
  }
};
