import React from "react";
import AnnuityBenefitsViz from "./AnnuityBenefitsViz";
import { InsurancePolicy } from "@shared/mock-data";

interface YearlyRow {
  age: number;
  growth: number;
  fees: number;
  income: number;
  grossAV: number;
  netAV: number;
  phase: "accumulation" | "income" | "pip";
}

interface Props {
  beaconData?: unknown;
  policy?: InsurancePolicy;
  sidebarPlacement?: "inline" | "external";
  onSidebarChange?: (sidebar: React.ReactNode | null) => void;
  onChartDataChange?: (data: YearlyRow[]) => void;
}

export const AnnuityBenefitsTab: React.FC<Props> = ({ beaconData, policy, sidebarPlacement, onSidebarChange, onChartDataChange }) => {
  return (
    <div className="w-full">
      <AnnuityBenefitsViz
        preloadedData={beaconData}
        policy={policy}
        sidebarPlacement={sidebarPlacement}
        onSidebarChange={onSidebarChange}
        onChartDataChange={onChartDataChange}
      />
    </div>
  );
};
