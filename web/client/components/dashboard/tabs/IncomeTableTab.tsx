import React from "react";
import { InsurancePolicy } from "@shared/mock-data";
import AnnuityBenefitsViz from "./AnnuityBenefitsViz";

export const IncomeTableTab: React.FC<{ policy: InsurancePolicy }> = () => {
  return <AnnuityBenefitsViz embedTab="income" />;
};
