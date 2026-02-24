import React, { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/Layout";
import { InsuranceCard } from "@/components/dashboard/InsuranceCard";
import { DetailsPane } from "@/components/dashboard/DetailsPane";
import { policies, InsurancePolicy } from "@shared/mock-data";

export default function Index() {
  // Select Allianz Index Advantage as default
  const [selectedPolicy, setSelectedPolicy] = useState<InsurancePolicy | null>(policies[0]);
  const [isDetailsOpen, setIsDetailsOpen] = useState(true);

  const handleSelectPolicy = (policy: InsurancePolicy) => {
    setSelectedPolicy(policy);
    setIsDetailsOpen(true);
  };

  return (
    <DashboardLayout>
        <main className="flex-1 overflow-y-auto p-6 transition-all duration-300 min-h-0">
          <div className="max-w-[1200px] mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-xl font-bold text-gray-800 tracking-tight">Insurance</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {policies.map((policy) => (
                <InsuranceCard
                  key={policy.id}
                  policy={policy}
                  isSelected={selectedPolicy?.id === policy.id}
                  onSelect={handleSelectPolicy}
                />
              ))}
            </div>
          </div>
        </main>

        <DetailsPane
          policy={selectedPolicy}
          isOpen={isDetailsOpen}
          onClose={() => setIsDetailsOpen(false)}
        />
    </DashboardLayout>
  );
}
