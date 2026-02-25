import React from "react";
import AnnuityBenefitsViz from "./AnnuityBenefitsViz";

interface Props {
  beaconData?: unknown;
}

export const AnnuityBenefitsTab: React.FC<Props> = ({ beaconData }) => {
  return (
    <div className="w-full">
      <AnnuityBenefitsViz preloadedData={beaconData} />
    </div>
  );
};
