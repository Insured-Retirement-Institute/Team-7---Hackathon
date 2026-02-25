import React from "react";
import AnnuityBenefitsViz from "./AnnuityBenefitsViz";

interface Props {
  beaconData?: unknown;
  sidebarPlacement?: "inline" | "external";
  onSidebarChange?: (sidebar: React.ReactNode | null) => void;
}

export const AnnuityBenefitsTab: React.FC<Props> = ({ beaconData, sidebarPlacement, onSidebarChange }) => {
  return (
    <div className="w-full">
      <AnnuityBenefitsViz
        preloadedData={beaconData}
        sidebarPlacement={sidebarPlacement}
        onSidebarChange={onSidebarChange}
      />
    </div>
  );
};
