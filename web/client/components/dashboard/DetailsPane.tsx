import React, { useRef, useState, useEffect, useCallback } from "react";
import { ApiResponse } from "@shared/api-types";

import { X, ExternalLink } from "lucide-react";

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

const TABS = ["Chart", "Tax Implications", "Watch Items", "Full View"] as const;
type Tab = (typeof TABS)[number];

export const DetailsPane: React.FC<Props> = ({ policy, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<Tab>("Chart");
  const [apiResponse, setApiResponse] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [annuitySidebar, setAnnuitySidebar] = useState<React.ReactNode | null>(null);
  const [chartData, setChartData] = useState<unknown[]>([]);

  const sectionRefs = useRef<Record<Tab, HTMLElement | null>>({
    Chart: null,
    "Tax Implications": null,
    "Watch Items": null,
    "Full View": null,
  });

  // Reset all state when the pane closes
  useEffect(() => {
    if (!isOpen) {
      setActiveTab("Chart");
      setApiResponse(null);
      setIsLoading(false);
      setAnnuitySidebar(null);
      setChartData([]);
    }
  }, [isOpen]);

  // Clear chart/sidebar state immediately when the selected policy changes
  useEffect(() => {
    setChartData([]);
    setAnnuitySidebar(null);
  }, [policy?.id]);

  // Fetch beacon data whenever the selected policy changes
  useEffect(() => {
    setApiResponse(null);
    if (!policy?.cusip || !policy?.policyDate) {
      return;
    }
    let formattedDate = policy.policyDate;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(policy.policyDate)) {
      const [month, day, year] = policy.policyDate.split("/");
      formattedDate = `${year}-${month}-${day}`;
    } else if (/^\d{4}\/\d{2}\/\d{2}$/.test(policy.policyDate)) {
      formattedDate = policy.policyDate.replace(/\//g, "-");
    }
    setIsLoading(true);
    fetch(`/api/beacon/${policy.cusip}/${formattedDate}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => setApiResponse(data))
      .catch(() => setApiResponse(null))
      .finally(() => setIsLoading(false));
  }, [policy?.cusip, policy?.policyDate]);

  const handleSidebarChange = useCallback((sidebar: React.ReactNode | null) => {
    setAnnuitySidebar((prev) => (prev === sidebar ? prev : sidebar));
  }, []);

  const handleChartDataChange = useCallback((data: unknown[]) => {
    setChartData(data);
  }, []);

  // All hooks are declared above — safe to bail out here
  if (!policy) return null;

  const sectionId = (tab: Tab) => `details-section-${tab.toLowerCase().replace(/\s+/g, "-")}`;

  const handleTabClick = (tab: Tab) => {
    setActiveTab(tab);
    const section = sectionRefs.current[tab];
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const tabContent: Record<Tab, React.ReactNode> = {
    Chart: <ChartTab policy={policy} sidebar={annuitySidebar} chartData={chartData} />,
    "Tax Implications": <TaxImplicationsTab policy={policy} />,
    "Watch Items": <WatchItemsTab />,
    "Full View": <FullViewTab policy={policy} />,
  };

  const renderedSections = TABS.map((tab) => (
    <section
      key={tab}
      id={sectionId(tab)}
      ref={(el) => (sectionRefs.current[tab] = el)}
      className="scroll-mt-24 space-y-3"
    >
      <h4 className="text-sm font-semibold text-gray-900">{tab}</h4>
      {tabContent[tab]}
    </section>
  ));

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

        {isLoading && (
          <div className="absolute inset-0 top-14 z-20 flex flex-col items-center justify-center gap-4 bg-white/90 backdrop-blur-sm">
            <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-blue-600 animate-spin" />
            <div className="text-center">
              <p className="text-[11px] font-semibold text-gray-700">Loading policy data</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Fetching report and generating analysis…</p>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[1200px] mx-auto px-4 py-4 space-y-6">
            {/* Title and date */}
            <div className="border-b pb-4">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-bold text-primary">{policy.name}</h3>
                {apiResponse?.beaconReportLink && (
                  <a
                    href={apiResponse.beaconReportLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-1 text-[11px] font-semibold text-blue-600 border border-blue-200 rounded hover:bg-blue-50 transition-colors"
                  >
                    Full Beacon Report
                    <ExternalLink size={11} />
                  </a>
                )}
              </div>
              <p className="text-[10px] text-gray-400">As of {policy.asOfDate}</p>

              <div className="grid grid-cols-4 gap-2 mt-4">
                <div className="flex flex-col">
                  <span className="text-gray-900 font-bold text-[11px]">{policy.issueEffective}</span>
                  <span className="text-[9px] text-gray-400 uppercase tracking-tight">Issue Effective</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-gray-900 font-bold text-[11px]">{policy.valuationDate}</span>
                  <span className="text-[9px] text-gray-400 uppercase tracking-tight">Valuation Date</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-gray-900 font-bold text-[11px]">{policy.incomeSw ? "ON" : "OFF"}</span>
                  <span className="text-[9px] text-gray-400 uppercase tracking-tight">Income Rider</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-blue-700 font-bold text-[11px]">{policy.value}</span>
                  <span className="text-[9px] text-gray-400 uppercase tracking-tight">Value</span>
                </div>
              </div>
            </div>

            {apiResponse?.summary && (
              <div className="bg-blue-50 border border-blue-100 rounded px-4 py-3 text-[11px] text-gray-700 leading-relaxed">
                <span className="block text-[9px] font-semibold uppercase tracking-wider text-blue-500 mb-1">Summary</span>
                {apiResponse.summary}
              </div>
            )}

            <div className="sticky top-0 z-10 -mx-4 px-4 bg-white border-b pb-2 pt-2">
              <div className="inline-flex text-[11px] font-semibold text-gray-600 border border-gray-200">
                {TABS.map((tab, i) => (
                  <button
                    key={tab}
                    onClick={() => handleTabClick(tab)}
                    className={cn(
                      "px-3 py-1.5 transition-colors whitespace-nowrap",
                      i > 0 && "border-l border-gray-200",
                      activeTab === tab ? "bg-blue-600 text-white border-blue-600" : "bg-white hover:bg-gray-50"
                    )}
                    aria-controls={sectionId(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-8 pb-6">
              {renderedSections}
              {/* Hidden — keeps AnnuityBenefitsViz mounted so it drives chart data and sidebar */}
              <div className="hidden">
                <AnnuityBenefitsTab
                  beaconData={apiResponse?.beaconReport}
                  policy={policy}
                  sidebarPlacement="external"
                  onSidebarChange={handleSidebarChange}
                  onChartDataChange={handleChartDataChange}
                />
              </div>
            </div>
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
