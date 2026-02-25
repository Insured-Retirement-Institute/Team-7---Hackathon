export interface InsurancePolicy {
  id: string;
  cusip: string;
  policyDate: string;
  name: string;
  asOfDate: string;
  issueEffective: string;
  valuationDate: string;
  value: string;
  contractNumber: string;
  issuer: string;
  productType: string;
  totalPremium: string;
  totalWithdrawal: string;
  surrenderValue: string;
  costBasis: string;
  netDeathBenefit: string;
  maturityDate?: string;
  receivedDate?: string;
  benefits?: {
    growth: boolean;
    principalProtection: boolean;
    income: boolean;
    deathBenefit: boolean;
  };
  contractDetails?: {
    totalContractAmount: string;
    netDeathBenefit: string;
    grossDeathBenefit: string;
    originalInvestmentValue: string;
    surrenderValue: string;
    totalPremium: string;
    totalWithdrawal: string;
    preTEFRA_Cost: string;
    postTEFRA_Cost: string;
    yearEndValue: string;
    costBasis: string;
    projectedPaymentAmount: string;
    projectedPaymentAmountAnnual: string;
    guaranteedProjectedAmount: string;
  };
}

export interface PolicyProjectionPoint {
  year: number;
  age: number;
  accumValue: number;
  fee: number;
  income: number;
  events: string[];
}

export const policies: InsurancePolicy[] = [
    {
    id: "7",
    cusip: "001399864",
    policyDate: "11/01/2022",
    name: "Polaris Platinum III",
    asOfDate: "11/1/2022",
    issueEffective: "11/1/2019",
    valuationDate: "11/1/2022",
    value: "$211,664",
    contractNumber: "PPL001399864",
    issuer: "American General Life Insurance Co.",
    productType: "Variable Annuity",
    totalPremium: "$180,000",
    totalWithdrawal: "$0",
    surrenderValue: "$200,780",
    costBasis: "$100,000",
    netDeathBenefit: "$220,508",
    maturityDate: "11/1/2054",
    receivedDate: "10/15/2019",
    benefits: { growth: true, principalProtection: false, income: true, deathBenefit: true },
    contractDetails: {
      totalContractAmount: "$211,664",
      netDeathBenefit: "$220,508",
      grossDeathBenefit: "$220,508",
      originalInvestmentValue: "$180,000",
      surrenderValue: "$200,780",
      totalPremium: "$180,000",
      totalWithdrawal: "$0",
      preTEFRA_Cost: "$0",
      postTEFRA_Cost: "$100,000",
      yearEndValue: "$205,320",
      costBasis: "$100,000",
      projectedPaymentAmount: "$1,121",
      projectedPaymentAmountAnnual: "$13,451",
      guaranteedProjectedAmount: "$13,451",
    },
  },
  {
    id: "1",
    cusip: "",
    policyDate: "",
    name: "Allianz Index Advantage®",
    asOfDate: "12/31/2023",
    issueEffective: "--",
    valuationDate: "--",
    value: "$775,104",
    contractNumber: "1111111111",
    issuer: "Allianz",
    productType: "Indexed Annuity",
    totalPremium: "$682,969",
    totalWithdrawal: "$0",
    surrenderValue: "$629,308",
    costBasis: "$0",
    netDeathBenefit: "$682,976",
    benefits: { growth: true, principalProtection: true, income: false, deathBenefit: true },
  },
  {
    id: "2",
    cusip: "",
    policyDate: "",
    name: "American Equity Income Shield - 10 Year",
    asOfDate: "12/31/2023",
    issueEffective: "4/5/2022",
    valuationDate: "--",
    value: "$110,316",
    contractNumber: "2222222222",
    issuer: "Midland",
    productType: "Fixed Annuity",
    totalPremium: "$60,000",
    totalWithdrawal: "$0",
    surrenderValue: "$59,285",
    costBasis: "$0",
    netDeathBenefit: "$62,576",
    benefits: { growth: false, principalProtection: true, income: true, deathBenefit: true },
  },
  {
    id: "3",
    cusip: "",
    policyDate: "",
    name: "American Legacy Design 3, Lifetime Income Advantage",
    asOfDate: "12/31/2023",
    issueEffective: "--",
    valuationDate: "--",
    value: "$678,984",
    contractNumber: "VAR097824DS",
    issuer: "--",
    productType: "--",
    totalPremium: "--",
    totalWithdrawal: "--",
    surrenderValue: "--",
    costBasis: "--",
    netDeathBenefit: "--",
    benefits: { growth: true, principalProtection: true, income: true, deathBenefit: true },
  },
  {
    id: "4",
    cusip: "",
    policyDate: "",
    name: "Fixed Annuity",
    asOfDate: "12/31/2023",
    issueEffective: "4/8/2002",
    valuationDate: "11/6/2023",
    value: "$0",
    contractNumber: "INSURANCET1",
    issuer: "Western Natio",
    productType: "Fixed Annuity",
    totalPremium: "$10,033",
    totalWithdrawal: "$10,000",
    surrenderValue: "$7,909",
    costBasis: "$0",
    netDeathBenefit: "$7,909",
    benefits: { growth: false, principalProtection: true, income: true, deathBenefit: true },
  },
  {
    id: "5",
    cusip: "",
    policyDate: "",
    name: "Security Benefit Indexed Life Annuity",
    asOfDate: "12/31/2023",
    issueEffective: "6/7/2021",
    valuationDate: "--",
    value: "$147,054",
    contractNumber: "333333333",
    issuer: "Security Benefit",
    productType: "Variable Annuity",
    totalPremium: "$115,757",
    totalWithdrawal: "$1,965",
    surrenderValue: "$118,264",
    costBasis: "$0",
    netDeathBenefit: "$0",
    maturityDate: "6/7/2051",
    receivedDate: "5/24/2021",
    benefits: { growth: true, principalProtection: false, income: true, deathBenefit: false },
    contractDetails: {
      totalContractAmount: "$118,264",
      netDeathBenefit: "$0",
      grossDeathBenefit: "$0",
      originalInvestmentValue: "$115,757",
      surrenderValue: "$118,264",
      totalPremium: "$115,757",
      totalWithdrawal: "$1,965",
      preTEFRA_Cost: "$0",
      postTEFRA_Cost: "$0",
      yearEndValue: "$115,015",
      costBasis: "$0",
      projectedPaymentAmount: "$0",
      projectedPaymentAmountAnnual: "$0",
      guaranteedProjectedAmount: "$0",
    },
  },
  {
    id: "6",
    cusip: "",
    policyDate: "",
    name: "Variable Annuity",
    asOfDate: "12/31/2023",
    issueEffective: "5/19/2010",
    valuationDate: "--",
    value: "$2,718",
    contractNumber: "INSURANCE3",
    issuer: "MetLife",
    productType: "Variable Annuity",
    totalPremium: "$41,000",
    totalWithdrawal: "$52,108",
    surrenderValue: "$2,447",
    costBasis: "$0",
    netDeathBenefit: "$2,477",
    benefits: { growth: true, principalProtection: false, income: false, deathBenefit: true },
  },
];

export const householdInfo = {
  name: "The Rogers Household",
  netWorth: "$22,791,132.58",
  clientSince: "February 2008",
  image: "https://images.unsplash.com/photo-1511895426328-dc8714191300?q=80&w=2070&auto=format&fit=crop",
};

export const navigationLinks = [
  { name: "Home", icon: "Home", active: true },
  { name: "Client Information", icon: "User" },
  { name: "Portfolio", icon: "PieChart" },
  { name: "Net Worth", icon: "DollarSign", children: true },
  { name: "Reports and Statements", icon: "FileText" },
  { name: "Timeline", icon: "Clock" },
  { name: "Vault", icon: "Lock" },
  { name: "Planning", icon: "Map", children: true },
  { name: "Insurance", icon: "Shield", active: true, children: true, subItems: ["Marketplace", "Policies"] },
];

export const projectionSeed: Array<Omit<PolicyProjectionPoint, "accumValue" | "fee" | "income"> & { income?: number }> = [
  { year: 2025, age: 67, events: ["retire"], income: 0 },
  { year: 2026, age: 68, events: [], income: 0 },
  { year: 2027, age: 69, events: [], income: 0 },
  { year: 2028, age: 70, events: ["income"], income: 6000 },
  { year: 2029, age: 71, events: [], income: 10000 },
  { year: 2030, age: 72, events: ["rmd"], income: 12000 },
  { year: 2031, age: 73, events: [], income: 18000 },
  { year: 2032, age: 74, events: [], income: 20000 },
  { year: 2033, age: 75, events: [], income: 23000 },
  { year: 2034, age: 76, events: [], income: 25000 },
  { year: 2035, age: 77, events: [], income: 26000 },
  { year: 2036, age: 78, events: [], income: 30000 },
  { year: 2037, age: 79, events: ["EOL"], income: 31000 },
];

const growthRates = [
  0.05, // 2025 -> 2026
  0.06,
  0.045,
  0.055,
  0.04,
  0.07,
  0.065,
  0.05,
  0.08,
  0.06,
  0.045,
  0.05, // 2036 -> 2037
];

export const policyProjection: PolicyProjectionPoint[] = (() => {
  const rows: PolicyProjectionPoint[] = [];
  let accumValue = 250000;
  let income = projectionSeed[0].income ?? 0;

  projectionSeed.forEach((seed, index) => {
    if (index > 0) {
      const rate = growthRates[index - 1];
      accumValue = Math.round(accumValue * (1 + rate));

      if (income === 0 && (seed.income ?? 0) > 0) {
        income = seed.income ?? 0; // start income when it first appears
      }
      const incomeRateBump = 0.07; // modest boost over asset growth
      income = income > 0 ? Math.round(income * (1 + rate + incomeRateBump)) : 0;
    }

    rows.push({
      year: seed.year,
      age: seed.age,
      events: seed.events,
      accumValue,
      income,
      fee: Math.round(accumValue * 0.05),
    });
  });

  return rows;
})();
