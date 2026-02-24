import React from "react";
import { InsurancePolicy } from "@shared/mock-data";
import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";

export const FullViewTab: React.FC<{ policy: InsurancePolicy }> = ({ policy }) => {
  return (
    <Accordion.Root
      type="multiple"
      defaultValue={["main-info", "contract-dates", "contract-details"]}
      className="space-y-4 mt-4"
    >
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
          {policy.contractDetails ? (
            Object.entries(policy.contractDetails).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="text-gray-400 capitalize">{key.replace(/([A-Z])/g, " $1").trim()}:</span>
                <span className="text-gray-700 font-medium">{value}</span>
              </div>
            ))
          ) : (
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
  );
};