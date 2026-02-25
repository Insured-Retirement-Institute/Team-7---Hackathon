import React from "react";
import { InsurancePolicy } from "@shared/mock-data";

type Field = {
  label: string;
  value?: string | boolean | null;
};

const formatValue = (value?: string | boolean | null) => {
  if (value === undefined || value === null || value === "") return "--";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value;
};

const FieldRow: React.FC<Field> = ({ label, value }) => (
  <div className="flex flex-col gap-1 rounded border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700">
    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
    <span className="font-medium text-gray-900">{formatValue(value)}</span>
  </div>
);

export const FullViewTab: React.FC<{ policy: InsurancePolicy }> = ({ policy }) => {
  const mainInfo: Field[] = [
    { label: "Product Name", value: policy.name },
    { label: "Product Type", value: policy.productType },
    { label: "Contract Number", value: policy.contractNumber },
    { label: "Issuer", value: policy.issuer },
  ];

  const financials: Field[] = [
    { label: "Current Account Value", value: policy.value },
    { label: "Total Purchase Payments", value: policy.totalPremium },
    { label: "Cost Basis", value: policy.costBasis },
    { label: "Withdrawals", value: policy.totalWithdrawal },
    { label: "Surrender Value", value: policy.surrenderValue },
    { label: "Death Benefit Amount", value: policy.netDeathBenefit },
    { label: "Underlying Investments - VA, FIA, RILA", value: policy.productType },
    { label: "Current Fixed Rate - FA, MYGA", value: policy.valuationDate },
    { label: "Next Rate Lock date, FA, MYGA", value: policy.maturityDate || policy.receivedDate },
  ];

  const dates: Field[] = [
    { label: "Contract Issue Date", value: policy.issueEffective },
    { label: "Surrender Expiration Date", value: policy.maturityDate },
    { label: "Maturity Date", value: policy.maturityDate },
  ];

  const riderInfo: Field[] = [
    { label: "Rider Name", value: policy.productType },
    { label: "Income Rider Activated", value: policy.incomeSw },
    { label: "IR Activation date", value: policy.receivedDate },
    { label: "Payment frequency", value: policy.policyDate },
    { label: "Next Payment Date", value: policy.valuationDate },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">Main Contract Information</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {mainInfo.map((field) => (
            <FieldRow key={field.label} {...field} />
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">Financials</h4>
          <div className="space-y-2">
            {financials.map((field) => (
              <FieldRow key={field.label} {...field} />
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">Dates</h4>
          <div className="space-y-2">
            {dates.map((field) => (
              <FieldRow key={field.label} {...field} />
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">Rider Information</h4>
          <div className="space-y-2">
            {riderInfo.map((field) => (
              <FieldRow key={field.label} {...field} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};