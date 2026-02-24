import React from "react";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { InsurancePolicy } from "@shared/mock-data";
import { cn } from "@/lib/utils";
import * as Accordion from "@radix-ui/react-accordion";

interface Props {
  policy: InsurancePolicy | null;
  isOpen: boolean;
  onClose: () => void;
}

export const DetailsPane: React.FC<Props> = ({ policy, isOpen, onClose }) => {
  if (!policy) return null;

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
        <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Details</h2>
        <button 
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X size={16} className="text-gray-400" />
        </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
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

        {/* Accordion Sections */}
        <Accordion.Root type="multiple" defaultValue={["main-info", "contract-dates", "contract-details"]} className="space-y-4">
          
          <Accordion.Item value="main-info" className="border rounded">
            <Accordion.Header className="flex">
              <Accordion.Trigger className="flex flex-1 items-center justify-between p-3 text-xs font-bold text-gray-700 hover:bg-gray-50 uppercase tracking-wider text-left group">
                Main Information
                <ChevronDown size={14} className="text-gray-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="p-3 bg-white text-[11px] space-y-2 border-t overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
              <div className="flex justify-between">
                <span className="text-gray-400">Contract Number:</span>
                <span className="text-gray-700 font-medium">{policy.contractNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Issuer:</span>
                <span className="text-gray-700 font-medium">{policy.issuer}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Product Type:</span>
                <span className="text-gray-700 font-medium">{policy.productType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total Premium:</span>
                <span className="text-gray-700 font-medium">{policy.totalPremium}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total Withdrawal:</span>
                <span className="text-gray-700 font-medium">{policy.totalWithdrawal}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Surrender Value:</span>
                <span className="text-gray-700 font-medium">{policy.surrenderValue}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Cost Basis:</span>
                <span className="text-gray-700 font-medium">{policy.costBasis}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Net Death Benefit:</span>
                <span className="text-gray-700 font-medium">{policy.netDeathBenefit}</span>
              </div>
            </Accordion.Content>
          </Accordion.Item>

          <Accordion.Item value="contract-dates" className="border rounded">
            <Accordion.Header className="flex">
              <Accordion.Trigger className="flex flex-1 items-center justify-between p-3 text-xs font-bold text-gray-700 hover:bg-gray-50 uppercase tracking-wider text-left group">
                Contract Dates
                <ChevronDown size={14} className="text-gray-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="p-3 bg-white text-[11px] space-y-2 border-t overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
               <div className="flex justify-between">
                <span className="text-gray-400">Maturity:</span>
                <span className="text-gray-700 font-medium">{policy.maturityDate || "--"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Issue Effective:</span>
                <span className="text-gray-700 font-medium">{policy.issueEffective}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Received:</span>
                <span className="text-gray-700 font-medium">{policy.receivedDate || "--"}</span>
              </div>
            </Accordion.Content>
          </Accordion.Item>

          <Accordion.Item value="contract-details" className="border rounded">
            <Accordion.Header className="flex">
              <Accordion.Trigger className="flex flex-1 items-center justify-between p-3 text-xs font-bold text-gray-700 hover:bg-gray-50 uppercase tracking-wider text-left group">
                Contract Details
                <ChevronDown size={14} className="text-gray-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="p-3 bg-white text-[11px] space-y-2 border-t overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
              {policy.contractDetails ? Object.entries(policy.contractDetails).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-gray-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                  <span className="text-gray-700 font-medium">{value}</span>
                </div>
              )) : (
                <p className="text-gray-400 text-center">No additional details available</p>
              )}
            </Accordion.Content>
          </Accordion.Item>

          <Accordion.Item value="service-features" className="border rounded">
            <Accordion.Header className="flex">
              <Accordion.Trigger className="flex flex-1 items-center justify-between p-3 text-xs font-bold text-gray-700 hover:bg-gray-50 uppercase tracking-wider text-left group">
                Service Features
                <ChevronDown size={14} className="text-gray-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="p-3 bg-white text-[11px] space-y-2 border-t overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
              <p className="text-gray-400 italic">Service Feature 1 Sub Type</p>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>
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
