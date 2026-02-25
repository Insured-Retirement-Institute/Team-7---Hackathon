import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine } from "recharts";
import { RightSidebar } from "./RightSidebar";

// ─── API Configuration ───
const API_URL = "https://stage-profile.an.annuitynexus.com/api/profile?token=xpdhwqifofnlkdnqbksurbcaldheqj&cusip=001399864&policydate=2022-11-01";

// Fallback values used when no policy is selected
const DEFAULT_INIT_PREMIUM = 180000;
const DEFAULT_COST_BASIS = 100000;
const DEFAULT_CONTRACT_YR = 3;
const DEFAULT_CURRENT_AGE = 63;

const FALLBACK_PARAMS = {
  creditRate: 0.07, feeRate: 0.0145, maxCreditYrs: 12, stepUpGuarantee: 2.0,
  productName: "Polaris Platinum III", riderName: "Polaris Income Max",
  mawpTable: [
    { minAge: 45, maxAge: 59, single: 0.0505, joint: 0.0505 },
    { minAge: 60, maxAge: 64, single: 0.0610, joint: 0.0610 },
    { minAge: 65, maxAge: 69, single: 0.0900, joint: 0.0900 },
    { minAge: 70, maxAge: 74, single: 0.0925, joint: 0.0925 },
    { minAge: 75, maxAge: 99, single: 0.0935, joint: 0.0935 },
  ],
  pipTable: [
    { minAge: 45, maxAge: 64, single: 0.0325, joint: 0.0325 },
    { minAge: 65, maxAge: 99, single: 0.035, joint: 0.035 },
  ],
};

// ── Extract all riders + income options from raw API response ──
function extractApiCatalog(raw) {
  try {
    const allRiders = raw?.tabs?.gmwb?.data || [];
    const productName = raw?.basicInfo?.vaProduct?.productName || FALLBACK_PARAMS.productName;
    const activeRiders = allRiders.filter((r) => !r.isTerminated);
    if (!activeRiders.length) return null;

    const buildT = (src) => src
      .filter((c) => c.ageBand1 != null)
      .map((c) => ({ minAge: c.ageBand1, maxAge: c.ageBand2, single: c.num1 / 100, joint: (c.num2 || c.num1) / 100 }))
      .sort((a, b) => a.minAge - b.minAge);

    const riders = activeRiders.map((rider) => {
      const cases = rider.newVaGmwbCases || [];
      const feeCase = cases.find((c) => c.isCaseAOrC === "C" && c.singleJointChrgType === 1);
      const feeRate = feeCase ? (feeCase.chargeFrequencyId === 4 ? feeCase.num1 * 4 : feeCase.num1) / 100 : FALLBACK_PARAMS.feeRate;

      // Collect distinct income options from notes (e.g. "Option 1", "Option 2", "Income Option 1")
      const optionSet = new Set();
      cases.forEach((c) => {
        if (!c.notes) return;
        const m = c.notes.match(/(?:Income\s+)?Option\s+(\d+)/i);
        if (m) optionSet.add(`Option ${m[1]}`);
      });
      const incomeOptions = [...optionSet].sort();

      // Build per-option rate tables
      const optionTables = {};
      incomeOptions.forEach((opt) => {
        const num = opt.replace("Option ", "");
        const mawpCases = cases.filter((c) =>
          c.isCaseAOrC === "A" && c.notes &&
          (c.notes.includes("MAWA") || c.notes.includes("MAWP")) &&
          c.notes.match(new RegExp(`(?:Income\\s+)?Option\\s+${num}`, "i"))
        );
        const pipCases = cases.filter((c) =>
          c.isCaseAOrC === "A" && c.notes &&
          c.notes.includes("PIP") &&
          c.notes.match(new RegExp(`(?:Income\\s+)?Option\\s+${num}`, "i"))
        );
        optionTables[opt] = {
          mawpTable: mawpCases.length ? buildT(mawpCases) : FALLBACK_PARAMS.mawpTable,
          // null means no PIP — model will keep MAWP rate after account depletion
          pipTable: pipCases.length ? buildT(pipCases) : null,
        };
      });

      // Fallback: if no options found, build a default table from all MAWP/PIP cases
      if (!incomeOptions.length) {
        const mawpAll = cases.filter((c) => c.isCaseAOrC === "A" && c.notes && (c.notes.includes("MAWA") || c.notes.includes("MAWP")));
        const pipAll  = cases.filter((c) => c.isCaseAOrC === "A" && c.notes && c.notes.includes("PIP"));
        incomeOptions.push("Default");
        optionTables["Default"] = {
          mawpTable: mawpAll.length ? buildT(mawpAll) : FALLBACK_PARAMS.mawpTable,
          pipTable:  pipAll.length  ? buildT(pipAll)  : null,
        };
      }

      return {
        id: rider.id || rider.name,
        name: rider.name || "Unknown Rider",
        creditRate: (rider.rollupPercentage || 7) / 100,
        maxCreditYrs: rider.maxRollupYears || 12,
        stepUpGuarantee: (rider.stepUpPerct || 200) / 100,
        feeRate,
        incomeOptions,
        optionTables,
      };
    });

    return { productName, riders };
  } catch { return null; }
}

// ── Build riderParams from catalog + current selections ──
function buildRiderParams(catalog, selectedRider, selectedOption) {
  if (!catalog) return { ...FALLBACK_PARAMS, fromApi: false };
  const rider = catalog.riders.find((r) => r.name === selectedRider) || catalog.riders[0];
  const opt   = rider.incomeOptions.includes(selectedOption) ? selectedOption : rider.incomeOptions[0];
  const tables = rider.optionTables[opt] || { mawpTable: FALLBACK_PARAMS.mawpTable, pipTable: null };
  return {
    productName: catalog.productName,
    riderName: rider.name,
    creditRate: rider.creditRate,
    feeRate: rider.feeRate,
    maxCreditYrs: rider.maxCreditYrs,
    stepUpGuarantee: rider.stepUpGuarantee,
    mawpTable: tables.mawpTable,
    pipTable:  tables.pipTable,
    fromApi: true,
    selectedOption: opt,
  };
}

function parseApiResponse(raw) {
  // Legacy shim — returns first rider / first option
  const catalog = extractApiCatalog(raw);
  if (!catalog) return { ...FALLBACK_PARAMS, fromApi: false };
  return buildRiderParams(catalog, catalog.riders[0]?.name, catalog.riders[0]?.incomeOptions[0]);
}

function getMawpRate(age, t) { const b = t.find((r) => age >= r.minAge && age <= r.maxAge); return b ? b.single : t[t.length - 1]?.single ?? 0.0935; }
function getMawpBand(age, t) { const b = t.find((r) => age >= r.minAge && age <= r.maxAge); return b ? `${b.minAge}–${b.maxAge}` : "75+"; }
function getPipRate(age, t) { const b = t.find((r) => age >= r.minAge && age <= r.maxAge); return b ? b.single : t[t.length - 1]?.single ?? 0.035; }

function runModel(params) {
  const {
    growth = 0.052, lifeExp = 85, taxRate = 0.24, creditRate, feeRate, maxCreditYrs, stepUpGuarantee, mawpTable, pipTable,
    initPremium: INIT_PREMIUM = DEFAULT_INIT_PREMIUM,
    costBasis: COST_BASIS = DEFAULT_COST_BASIS,
    contractYear: CONTRACT_YR = DEFAULT_CONTRACT_YR,
    currentAge: CURRENT_AGE = DEFAULT_CURRENT_AGE,
    currentAVActual = null,
  } = params;
  // Simulate from initial premium to derive current state
  let av = INIT_PREMIUM, bb = INIT_PREMIUM;
  for (let yr = 1; yr <= CONTRACT_YR; yr++) { av = av + av * growth - bb * feeRate; bb = Math.max(av, INIT_PREMIUM * (1 + creditRate * yr)); }
  // Prefer the actual account value from policy data over the simulated one
  const currentAV = (currentAVActual != null && currentAVActual > 0) ? currentAVActual : av;
  const currentBB = Math.max(currentAV, INIT_PREMIUM * (1 + creditRate * CONTRACT_YR));
  function buildPre() {
    let avL = currentAV, bbL = currentBB; const rows = [];
    for (let yr = 0; yr <= maxCreditYrs - CONTRACT_YR; yr++) {
      const age = CURRENT_AGE + yr, cyr = CONTRACT_YR + yr;
      const avEOY = avL + avL * growth - bbL * feeRate;
      let newBB = cyr < maxCreditYrs ? Math.max(avEOY, INIT_PREMIUM * (1 + creditRate * (cyr + 1))) : Math.max(avEOY, INIT_PREMIUM * (1 + creditRate * maxCreditYrs), INIT_PREMIUM * stepUpGuarantee);
      rows.push({ age, cyr, avEOY, bbEOY: newBB }); avL = avEOY; bbL = newBB;
    }
    return rows;
  }
  const preActRows = buildPre();
  function getState(targetAge) {
    if (targetAge === CURRENT_AGE) return { av: currentAV, bb: currentBB };
    const yrs = targetAge - CURRENT_AGE;
    if (yrs > 0 && yrs <= preActRows.length) { const r = preActRows[yrs - 1]; return { av: r.avEOY, bb: r.bbEOY }; }
    const last = preActRows.length > 0 ? preActRows[preActRows.length - 1] : { avEOY: currentAV, bbEOY: currentBB };
    let avX = last.avEOY, bbX = last.bbEOY;
    for (let i = 0; i < yrs - preActRows.length; i++) { avX = avX + avX * growth - bbX * feeRate; bbX = Math.max(avX, bbX); }
    return { av: avX, bb: bbX };
  }
  function computeScenario(actAge) {
    const { bb: sBB, av: sAV } = getState(actAge);
    const mawpRate = getMawpRate(actAge, mawpTable);
    // If no PIP table exists for this rider, income continues at the MAWP rate after depletion
    const pipRate = pipTable ? getPipRate(actAge, pipTable) : mawpRate;
    const mawpIncome = sBB * mawpRate, pipIncome = sBB * pipRate, drain = mawpIncome + sBB * feeRate;
    let avPost = sAV, depletesAtAge = null, mawpYears = 0;
    for (let y = 0; y < lifeExp - actAge + 1; y++) {
      if (avPost > 0) { avPost = avPost * (1 + growth) - drain; if (avPost <= 0) { depletesAtAge = actAge + y + 1; mawpYears = y + 1; avPost = 0; break; } mawpYears = y + 1; }
    }
    if (!depletesAtAge) mawpYears = lifeExp - actAge;
    const mt = Math.min(mawpYears, lifeExp - actAge) * mawpIncome, pipYrs = depletesAtAge ? Math.max(0, lifeExp - depletesAtAge) : 0;
    return { activateAtAge: actAge, bb: sBB, mawpRate, mawpIncome, annualFee: sBB * feeRate, avAtActivation: sAV, depletesAtAge, mawpYears, mawpTotal: mt, pipRate, pipIncome, pipYears: pipYrs, pipTotal: pipYrs * pipIncome, grandTotal: mt + pipYrs * pipIncome };
  }
  const scenarios = []; for (let a = CURRENT_AGE; a <= 78; a++) scenarios.push(computeScenario(a));
  let optAge = CURRENT_AGE, maxTotal = 0;
  scenarios.forEach((s) => { if (s.grandTotal > maxTotal) { maxTotal = s.grandTotal; optAge = s.activateAtAge; } });
  const optS = scenarios.find((s) => s.activateAtAge === optAge), curS = scenarios.find((s) => s.activateAtAge === CURRENT_AGE);
  // Guard: if scenarios is empty (e.g. CURRENT_AGE > 78) or optS/curS can't be found, return safe fallback
  if (!optS || !curS) {
    return { scenarios, optAge: CURRENT_AGE, optS: null, curS: null, postAct: [], preActRows, currentAV, currentBB, lifoTax: { yearByYear: [], totalGain: 0, avAtActivation: currentAV }, taxChartData: [], initPremium: INIT_PREMIUM, costBasis: COST_BASIS, contractYear: CONTRACT_YR, currentAge: CURRENT_AGE };
  }
  function buildPostAct(s, oAge) {
    let avP = s.avAtActivation, cumIncome = 0, depleted = false; const rows = [];
    for (let y = 0; y < lifeExp - oAge; y++) {
      const age = oAge + y;
      if (depleted) { cumIncome += s.pipIncome; rows.push({ age, av: 0, phase: "PIP", income: s.pipIncome, cumIncome }); }
      else { const eoy = avP + avP * growth - s.bb * feeRate - s.mawpIncome; cumIncome += s.mawpIncome; if (eoy <= 0) { depleted = true; rows.push({ age, av: 0, phase: "MAWP", income: s.mawpIncome, cumIncome }); avP = 0; } else { rows.push({ age, av: eoy, phase: "MAWP", income: s.mawpIncome, cumIncome }); avP = eoy; } }
    }
    return rows;
  }
  const postAct = buildPostAct(optS, optAge);
  function buildLIFO() {
    const avAtAct = optS.avAtActivation, totalGain = avAtAct - COST_BASIS;
    let remGain = Math.max(0, totalGain), remBasis = COST_BASIS, cumGross = 0, cumTaxable = 0, cumTaxFree = 0, cumTax = 0, cumAT = 0, basisDone = false, dep = false, avT = avAtAct;
    const yby = [];
    for (let y = 0; y < lifeExp - optAge; y++) {
      const age = optAge + y; let gw, phase;
      if (dep) { gw = optS.pipIncome; phase = "PIP"; } else { gw = optS.mawpIncome; phase = "MAWP"; avT = avT + avT * growth - optS.bb * feeRate - gw; if (avT <= 0) { dep = true; avT = 0; } }
      let tp = 0, tfp = 0;
      if (remGain > 0) { const gu = Math.min(gw, remGain); tp = gu; tfp = gw - gu; remGain -= gu; if (tfp > 0) remBasis -= tfp; }
      else if (remBasis > 0 && !basisDone) { const bu = Math.min(gw, remBasis); tfp = bu; tp = gw - bu; remBasis -= bu; if (remBasis <= 0) basisDone = true; }
      else tp = gw;
      const tax = tp * taxRate; cumGross += gw; cumTaxable += tp; cumTaxFree += tfp; cumTax += tax; cumAT += gw - tax;
      yby.push({ age, phase, grossIncome: gw, taxablePortion: tp, taxFreePortion: tfp, taxOwed: tax, afterTaxIncome: gw - tax, effectiveRate: gw > 0 ? tax / gw : 0, cumGross, cumTaxable, cumTaxFree, cumTax, cumAfterTax: cumAT, lifoPhase: remGain > 0 ? "GAIN" : remBasis > 0 ? "BASIS" : "FULLY_TAXABLE" });
    }
    return { yearByYear: yby, totalGain, avAtActivation: avAtAct };
  }
  const lifoTax = buildLIFO();
  function buildTaxComp() {
    let tAV = COST_BASIS; for (let yr = 0; yr < optAge - CURRENT_AGE + CONTRACT_YR; yr++) tAV = tAV * (1 + growth) - tAV * growth * taxRate * 0.5;
    let cumAT = 0; const data = [];
    for (let y = 0; y < lifeExp - optAge; y++) {
      const wd = Math.min(optS.mawpIncome, Math.max(0, tAV)), gr = Math.max(0, (tAV - COST_BASIS) / Math.max(1, tAV));
      cumAT += wd - wd * gr * taxRate; tAV = Math.max(0, (tAV - wd) * (1 + growth));
      data.push({ age: optAge + y, taxable: cumAT, annuity: lifoTax.yearByYear[y]?.cumAfterTax || 0 });
    }
    return data;
  }
  return { scenarios, optAge, optS, curS, postAct, preActRows, currentAV, currentBB, lifoTax, taxChartData: buildTaxComp(), initPremium: INIT_PREMIUM, costBasis: COST_BASIS, contractYear: CONTRACT_YR, currentAge: CURRENT_AGE };
}

const fmt = (n) => "$" + Math.round(n).toLocaleString();
const fmtK = (n) => Math.abs(n) >= 1e6 ? "$" + (n / 1e6).toFixed(1) + "M" : Math.abs(n) >= 1e3 ? "$" + Math.round(n / 1e3) + "k" : "$" + Math.round(n);
const pct = (n) => (n * 100).toFixed(2) + "%";

function parseCurrency(str) {
  if (!str || typeof str !== "string") return null;
  const n = parseFloat(str.replace(/[$,]/g, ""));
  return isNaN(n) ? null : n;
}

function calcContractYear(issueEffective, valuationDate) {
  if (!issueEffective || !valuationDate || issueEffective === "--" || valuationDate === "--") return null;
  const parseDateStr = (s) => {
    const parts = s.split("/");
    if (parts.length === 3) return new Date(+parts[2], +parts[0] - 1, +parts[1]);
    return new Date(s);
  };
  const issue = parseDateStr(issueEffective);
  const val = parseDateStr(valuationDate);
  if (isNaN(issue.getTime()) || isNaN(val.getTime())) return null;
  return Math.max(0, Math.round((val - issue) / (365.25 * 24 * 60 * 60 * 1000)));
}

// ─── Color palette matching CRM screenshot ───
const C = {
  bg: "#f4f5f7",
  white: "#ffffff",
  navy: "#1e2d4a",
  navyLight: "#2a3f61",
  border: "#dde1e7",
  borderLight: "#eaecf0",
  text: "#1a1f2e",
  textMid: "#4a5568",
  textLight: "#8896a8",
  accent: "#1a5fa8",
  accentLight: "#e8f0fb",
  green: "#2d7a4e",
  greenBg: "#eaf5ee",
  red: "#b91c1c",
  redBg: "#fef2f2",
  amber: "#92400e",
  amberBg: "#fffbeb",
  chartBlue: "#1a5fa8",
  chartGreen: "#2d7a4e",
  chartRed: "#dc2626",
  chartAmber: "#d97706",
  chartGray: "#8896a8",
};

const Tooltip_ = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: "8px 12px", boxShadow: "0 2px 8px rgba(0,0,0,0.12)", fontSize: 11 }}>
      <div style={{ color: C.textLight, marginBottom: 5, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Age {label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
          <span style={{ color: C.textMid }}>{p.name}:</span>
          <span style={{ color: C.text, fontWeight: 600 }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Shared UI primitives ───
const SectionLabel = ({ children, style }) => (
  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: C.textLight, marginBottom: 10, ...style }}>{children}</div>
);

const Card = ({ children, style }) => (
  <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, ...style }}>{children}</div>
);

const CardHeader = ({ title, subtitle, right, bottom, noBorder }) => (
  <div style={{ padding: "10px 14px", borderBottom: noBorder ? "none" : `1px solid ${C.borderLight}` }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.text }}>{title}</div>
        {subtitle && <div style={{ fontSize: 10, color: C.textLight, marginTop: 1 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
    {bottom}
  </div>
);

const LabelValue = ({ label, value, valueColor, border, indent, apiTag }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: `5px ${indent ? "6px" : "14px"}`, borderBottom: border ? `1px solid ${C.borderLight}` : "none" }}>
    <span style={{ fontSize: 11, color: C.textMid, paddingLeft: indent ? 8 : 0 }}>{label}{apiTag && <span style={{ marginLeft: 5, fontSize: 8, background: "#e8f5e9", border: "1px solid #a5d6a7", color: "#2d7a4e", borderRadius: 2, padding: "1px 4px", fontWeight: 600, letterSpacing: "0.06em" }}>API</span>}</span>
    <span style={{ fontSize: 11, fontWeight: 500, color: valueColor || C.text, textAlign: "right" }}>{value}</span>
  </div>
);

const Badge = ({ children, color, bg }) => (
  <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: color || C.accent, background: bg || C.accentLight, borderRadius: 2, padding: "2px 6px" }}>{children}</span>
);

const Pill = ({ phase }) => {
  const isMAWP = phase === "MAWP";
  return <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: isMAWP ? C.green : C.red, background: isMAWP ? C.greenBg : C.redBg, borderRadius: 2, padding: "2px 5px" }}>{phase}</span>;
};

function Accordion({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: `1px solid ${C.borderLight}` }}>
      <button onClick={() => setOpen(!open)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: C.text, letterSpacing: "0.04em" }}>{title}</span>
        <span style={{ fontSize: 10, color: C.textLight, transition: "transform 0.2s", display: "inline-block", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
      </button>
      {open && <div style={{ paddingBottom: 6 }}>{children}</div>}
    </div>
  );
}

const tabs = [
  { id: "overview", label: "Contract Details" },
  { id: "income", label: "Income Projection" },
  { id: "whatif", label: "Scenarios" },
  { id: "tax", label: "Tax Analysis" },
  { id: "detail", label: "Full Analysis" },
];

export default function AnnuityBenefitsViz({ embedTab, preloadedData, policy, sidebarPlacement = "inline", onSidebarChange, onChartDataChange } = {}) {
  const [activeTab, setActiveTab] = useState(embedTab || "overview");
  const displayTab = embedTab || activeTab;
  const [growthRate, setGrowthRate] = useState(5.2);
  const [lifeExp, setLifeExp] = useState(85);
  const [taxRate, setTaxRate] = useState(24);
  const [apiCatalog, setApiCatalog] = useState(null);
  const [selectedRider, setSelectedRider] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [riderParams, setRiderParams] = useState(FALLBACK_PARAMS);
  const [apiStatus, setApiStatus] = useState("idle");
  const [apiError, setApiError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);
  const [showParamPanel, setShowParamPanel] = useState(false);
  const [activationAge, setActivationAge] = useState(null);

  const policyParams = useMemo(() => {
    if (!policy) return {};
    const initPremium = parseCurrency(policy.totalPremium);
    const costBasis = parseCurrency(policy.costBasis);
    const currentAVActual = parseCurrency(policy.value);
    const currentAge = policy.clientAge ?? DEFAULT_CURRENT_AGE;
    const contractYear = calcContractYear(policy.issueEffective, policy.valuationDate);
    return {
      ...(initPremium != null && initPremium > 0 && { initPremium }),
      ...(costBasis != null && costBasis > 0 && { costBasis }),
      ...(currentAVActual != null && currentAVActual > 0 && { currentAVActual }),
      currentAge,
      ...(contractYear != null && { contractYear }),
    };
  }, [policy]);

  const fetchApiData = useCallback(async () => {
    setApiStatus("loading");
    setApiError(null);
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const catalog = extractApiCatalog(json);
      if (catalog && catalog.riders.length) {
        // Default to first rider that includes "income max", else first rider
        const defaultRider = catalog.riders.find((r) => r.name.toLowerCase().includes("income max")) || catalog.riders[0];
        const defaultOption = defaultRider.incomeOptions[0];
        setApiCatalog(catalog);
        setSelectedRider(defaultRider.name);
        setSelectedOption(defaultOption);
        setRiderParams(buildRiderParams(catalog, defaultRider.name, defaultOption));
        setApiStatus("success");
      } else {
        setRiderParams({ ...FALLBACK_PARAMS, fromApi: false });
        setApiStatus("partial");
      }
      setLastFetched(new Date());
    } catch (err) { setApiError(err.message); setApiStatus("error"); }
  }, []);

  // Re-derive riderParams when selections change (without re-fetching)
  useEffect(() => {
    if (apiCatalog && selectedRider && selectedOption) {
      setRiderParams(buildRiderParams(apiCatalog, selectedRider, selectedOption));
    }
  }, [apiCatalog, selectedRider, selectedOption]);

  useEffect(() => {
    if (preloadedData) {
      const catalog = extractApiCatalog(preloadedData);
      if (catalog && catalog.riders.length) {
        const defaultRider = catalog.riders.find((r) => r.name.toLowerCase().includes("income max")) || catalog.riders[0];
        const defaultOption = defaultRider.incomeOptions[0];
        setApiCatalog(catalog);
        setSelectedRider(defaultRider.name);
        setSelectedOption(defaultOption);
        setRiderParams(buildRiderParams(catalog, defaultRider.name, defaultOption));
        setApiStatus("success");
      } else {
        setRiderParams({ ...FALLBACK_PARAMS, fromApi: false });
        setApiStatus("partial");
      }
      setLastFetched(new Date());
    } else if (!policy) {
      // Only fall back to the hardcoded API when running standalone (no policy context).
      // When embedded in the details pane, wait for preloadedData instead of racing
      // against the beacon fetch with a hardcoded URL.
      fetchApiData();
    }
  }, [preloadedData, policy, fetchApiData]);

  const model = useMemo(() => {
    try {
      return runModel({
        growth: growthRate / 100, lifeExp, taxRate: taxRate / 100,
        creditRate: riderParams.creditRate, feeRate: riderParams.feeRate,
        maxCreditYrs: riderParams.maxCreditYrs, stepUpGuarantee: riderParams.stepUpGuarantee,
        mawpTable: riderParams.mawpTable, pipTable: riderParams.pipTable,
        ...policyParams,
      });
    } catch (err) {
      console.error("[AnnuityBenefitsViz] runModel error:", err);
      return null;
    }
  }, [growthRate, lifeExp, taxRate, riderParams, policyParams]);

  const { optAge = DEFAULT_CURRENT_AGE, optS = null, curS = null, postAct = [], scenarios = [], currentAV = 0, currentBB = 0, lifoTax = { yearByYear: [], totalGain: 0, avAtActivation: 0 }, taxChartData = [], initPremium = DEFAULT_INIT_PREMIUM, costBasis = DEFAULT_COST_BASIS, contractYear = DEFAULT_CONTRACT_YR, currentAge = DEFAULT_CURRENT_AGE } = model ?? {};

  // Sync activation age to model's optimal age when rider/assumptions change
  useEffect(() => { setActivationAge(optAge); }, [optAge]);

  const gain = optS && curS ? optS.grandTotal - curS.grandTotal : 0;
  const incomeData = postAct.map((r) => ({ age: r.age, mawp: r.phase === "MAWP" ? r.income : 0, pip: r.phase === "PIP" ? r.income : 0, cumulative: r.cumIncome, av: r.av }));
  const scenarioData = scenarios.map((s) => ({ age: s.activateAtAge, total: s.grandTotal, isOpt: s.activateAtAge === optAge, mawp: s.mawpTotal, pip: s.pipTotal }));
  const bbData = (model?.preActRows ?? []).map((r) => ({ age: r.age, bb: r.bbEOY, av: r.avEOY }));

  const statusDot = { idle: "#8896a8", loading: "#d97706", success: "#2d7a4e", partial: "#d97706", error: "#dc2626" }[apiStatus];
  const statusText = { idle: "Not loaded", loading: "Fetching…", success: "Live", partial: "Defaults", error: "Error" }[apiStatus];

  const sidebar = useMemo(() => (
    <RightSidebar
      colors={C}
      apiCatalog={apiCatalog}
      selectedRider={selectedRider}
      selectedOption={selectedOption}
      onSelectRider={setSelectedRider}
      onSelectOption={setSelectedOption}
      riderParams={riderParams}
      growthRate={growthRate}
      lifeExp={lifeExp}
      taxRate={taxRate}
      setGrowthRate={setGrowthRate}
      setLifeExp={setLifeExp}
      setTaxRate={setTaxRate}
      contractYear={contractYear}
      costBasis={costBasis}
      currentAV={currentAV}
      initialBenefitBase={currentBB}
      activationAge={activationAge ?? optAge}
      setActivationAge={setActivationAge}
      currentAge={currentAge}
      optimalAge={optAge}
      gain={gain}
      optimalScenario={optS}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      formatCurrency={fmt}
      formatPercent={pct}
      getMawpBand={getMawpBand}
      getMawpRate={getMawpRate}
    />
  ), [apiCatalog, selectedRider, selectedOption, riderParams, growthRate, lifeExp, taxRate, currentAV, currentBB, costBasis, contractYear, currentAge, activationAge, optAge, gain, optS, activeTab]);

  const yearlyBreakdown = useMemo(() => {
    const { preActRows, currentAV, currentBB, optS, scenarios } = model ?? {};
    if (!model || !optS || !preActRows) return [];
    const gr = growthRate / 100;
    const fr = riderParams.feeRate;
    const rows = [];

    const selAge = activationAge ?? optS.activateAtAge;
    const selS = scenarios.find((s) => s.activateAtAge === selAge) ?? optS;

    // Pre-activation accumulation phase — only up to (but not including) selAge
    let prevAV = currentAV;
    let prevBB = currentBB;
    for (const row of preActRows) {
      if (row.age >= selAge) break;
      const growthAmt = Math.round(prevAV * gr);
      const feeAmt = Math.round(prevBB * fr);
      rows.push({
        age: row.age,
        growth: growthAmt,
        fees: feeAmt,
        income: 0,
        grossAV: Math.round(prevAV + growthAmt),
        netAV: Math.round(row.avEOY),
        phase: "accumulation",
      });
      prevAV = row.avEOY;
      prevBB = row.bbEOY;
    }

    // Post-activation income phase — rebuilt for selAge/selS
    let avPost = selS.avAtActivation;
    let depleted = false;
    for (let y = 0; y < lifeExp - selAge; y++) {
      const age = selAge + y;
      if (depleted) {
        rows.push({ age, growth: 0, fees: 0, income: Math.round(selS.pipIncome), grossAV: 0, netAV: 0, phase: "pip" });
      } else {
        const growthAmt = Math.round(avPost * gr);
        const feeAmt = Math.round(selS.bb * fr);
        const incomeAmt = Math.round(selS.mawpIncome);
        const eoy = avPost + avPost * gr - selS.bb * fr - selS.mawpIncome;
        rows.push({
          age,
          growth: growthAmt,
          fees: feeAmt,
          income: incomeAmt,
          grossAV: Math.round(avPost + growthAmt),
          netAV: Math.max(0, Math.round(eoy)),
          phase: "income",
        });
        if (eoy <= 0) depleted = true;
        avPost = Math.max(0, eoy);
      }
    }

    return rows;
  }, [model, growthRate, lifeExp, riderParams, activationAge]);

  useEffect(() => {
    if (sidebarPlacement === "external") {
      onSidebarChange?.(sidebar);
    } else {
      onSidebarChange?.(null);
    }
    onChartDataChange?.(yearlyBreakdown);
  }, [sidebarPlacement, sidebar, yearlyBreakdown, onSidebarChange, onChartDataChange]);

  if (embedTab) {
    return (
      <div style={{ fontFamily: "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif", background: C.bg, color: C.text, padding: 16 }}>
        <style>{`.row-hover:hover { background: ${C.accentLight} !important; } .fade-in { animation: fadeIn 0.2s ease; } @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
        {embedTab === "income" && (
          <div className="fade-in">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
              {[
                ["Activation Age", `Age ${optAge}`, C.accent],
                ["Annual MAWP Income", optS ? fmt(optS.mawpIncome) : "—", C.green],
                ["AV Depletes", optS?.depletesAtAge ? `Age ${optS.depletesAtAge}` : "Never", optS?.depletesAtAge ? C.red : C.green],
                ["Total Lifetime Income", optS ? fmt(optS.grandTotal) : "—", C.accent],
              ].map(([l, v, vc], i) => (
                <Card key={i} style={{ padding: "11px 13px" }}>
                  <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: C.textLight, marginBottom: 5 }}>{l}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: vc }}>{v}</div>
                </Card>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <Card>
                <CardHeader title="Lifetime Income by Activation Age" subtitle={`MAWP + PIP · projected through age ${lifeExp}`} />
                <div style={{ padding: "12px 4px 8px" }}>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={scenarioData} barCategoryGap="18%">
                      <CartesianGrid strokeDasharray="2 3" stroke={C.borderLight} vertical={false} />
                      <XAxis dataKey="age" tick={{ fill: C.textLight, fontSize: 9 }} axisLine={{ stroke: C.border }} tickLine={false} />
                      <YAxis tick={{ fill: C.textLight, fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={fmtK} />
                      <Tooltip content={<Tooltip_ />} />
                      <Bar dataKey="mawp" stackId="a" name="MAWP">{scenarioData.map((d, i) => <Cell key={i} fill={d.isOpt ? C.chartGreen : "#c6e6d0"} />)}</Bar>
                      <Bar dataKey="pip" stackId="a" name="PIP" radius={[2, 2, 0, 0]}>{scenarioData.map((d, i) => <Cell key={i} fill={d.isOpt ? C.chartRed : "#fecaca"} />)}</Bar>
                      <ReferenceLine x={optAge} stroke={C.accent} strokeDasharray="3 3" strokeWidth={1.5} label={{ value: "Optimal", position: "top", fill: C.accent, fontSize: 9 }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card>
                <CardHeader title="Annual Income & Account Value" subtitle={`From activation age ${optAge} · ${growthRate}% growth assumption`} />
                <div style={{ padding: "12px 4px 8px" }}>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={incomeData}>
                      <defs>
                        <linearGradient id="avG2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.chartBlue} stopOpacity={0.15} /><stop offset="100%" stopColor={C.chartBlue} stopOpacity={0.02} /></linearGradient>
                        <linearGradient id="mG2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.chartGreen} stopOpacity={0.3} /><stop offset="100%" stopColor={C.chartGreen} stopOpacity={0.02} /></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="2 3" stroke={C.borderLight} vertical={false} />
                      <XAxis dataKey="age" tick={{ fill: C.textLight, fontSize: 9 }} axisLine={{ stroke: C.border }} tickLine={false} />
                      <YAxis tick={{ fill: C.textLight, fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={fmtK} />
                      <Tooltip content={<Tooltip_ />} />
                      <Area type="monotone" dataKey="av" name="Account Value" stroke={C.chartBlue} fill="url(#avG2)" strokeWidth={1.5} />
                      <Area type="stepAfter" dataKey="mawp" name="MAWP" stroke={C.chartGreen} fill="url(#mG2)" strokeWidth={1.5} />
                      <Area type="stepAfter" dataKey="pip" name="PIP" stroke={C.chartRed} fill="none" strokeWidth={1.5} strokeDasharray="4 2" />
                      {optS?.depletesAtAge && <ReferenceLine x={optS.depletesAtAge} stroke={C.chartRed} strokeDasharray="4 2" label={{ value: "AV Depletes", position: "insideTopRight", fill: C.red, fontSize: 9 }} />}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
            <Card>
              <CardHeader title="Post-Activation Detail" subtitle={`Activation at age ${optAge} · year-by-year`} />
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: C.bg }}>
                      {["Age", "Account Value", "Phase", "Annual Income", "Cumulative Income"].map(h => (
                        <th key={h} style={{ padding: "7px 12px", textAlign: "right", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textLight, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {postAct.map((r, i) => (
                      <tr key={r.age} className="row-hover" style={{ borderBottom: `1px solid ${C.borderLight}`, background: i % 2 === 0 ? C.white : "#fafbfc" }}>
                        <td style={{ padding: "6px 12px", textAlign: "right", color: C.text, fontWeight: 500 }}>{r.age}</td>
                        <td style={{ padding: "6px 12px", textAlign: "right", color: r.av > 0 ? C.accent : C.red }}>{r.av > 0 ? fmt(r.av) : "$0"}</td>
                        <td style={{ padding: "6px 12px", textAlign: "right" }}><Pill phase={r.phase} /></td>
                        <td style={{ padding: "6px 12px", textAlign: "right", color: r.phase === "MAWP" ? C.green : C.red, fontWeight: 500 }}>{fmt(r.income)}</td>
                        <td style={{ padding: "6px 12px", textAlign: "right", color: C.accent, fontWeight: 600 }}>{fmt(r.cumIncome)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif", background: C.bg, minHeight: "100vh", color: C.text }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
        .tab-btn { transition: border-color 0.15s, color 0.15s, background 0.15s; }
        .tab-btn:hover { background: ${C.accentLight} !important; color: ${C.accent} !important; }
        .row-hover:hover { background: ${C.accentLight} !important; }
        .refresh-btn:hover { background: ${C.navyLight} !important; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .fade-in { animation: fadeIn 0.2s ease; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; display: inline-block; }
        .toggle-panel { overflow: hidden; transition: max-height 0.3s ease; }
        input[type=range] { -webkit-appearance: none; appearance: none; height: 4px; border-radius: 2px; background: ${C.border}; outline: none; width: 100%; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: ${C.accent}; cursor: pointer; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
        input[type=number] { -moz-appearance: textfield; }
        select { -webkit-appearance: none; }
      `}</style>

      {/* ═══ TOP HEADER BAR ═══ */}
      <div style={{ background: C.navy, borderBottom: `1px solid ${C.navyLight}`, padding: "0 20px", height: 44, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 24, height: 24, background: "white", borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: C.navy, fontSize: 11, fontWeight: 800, letterSpacing: "-0.05em" }}>DW</span>
            </div>
            <span style={{ color: "white", fontSize: 12, fontWeight: 600, letterSpacing: "0.04em" }}>DELIVER WEALTH MANAGEMENT</span>
          </div>
          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.15)" }} />
          <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>Insurance · Variable Annuity</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* API status */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 3, padding: "4px 10px" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: statusDot }} />
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", letterSpacing: "0.1em", textTransform: "uppercase" }}>API {statusText}</span>
            {lastFetched && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>· {lastFetched.toLocaleTimeString()}</span>}
          </div>
          <button className="refresh-btn" onClick={fetchApiData} disabled={apiStatus === "loading"}
            style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 3, padding: "5px 10px", cursor: apiStatus === "loading" ? "not-allowed" : "pointer", color: "white", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", opacity: apiStatus === "loading" ? 0.6 : 1, transition: "background 0.15s" }}>
            <span className={apiStatus === "loading" ? "spin" : ""}>↻</span> Refresh Data
          </button>
          <button onClick={() => setShowParamPanel(v => !v)}
            style={{ background: showParamPanel ? "rgba(255,255,255,0.15)" : "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 3, padding: "5px 10px", cursor: "pointer", color: "rgba(255,255,255,0.7)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {showParamPanel ? "Hide Params" : "API Params"}
          </button>
        </div>
      </div>

      {/* ═══ API PARAMS PANEL ═══ */}
      <div className="toggle-panel" style={{ maxHeight: showParamPanel ? "400px" : "0px" }}>
        <div style={{ background: C.navy, borderBottom: `1px solid rgba(255,255,255,0.08)`, padding: "12px 20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr) 1fr 1fr", gap: 12, alignItems: "start" }}>
            {[
              { label: "Rider", value: riderParams.riderName },
              { label: "Credit Rate", value: pct(riderParams.creditRate) },
              { label: "Annual Fee", value: pct(riderParams.feeRate) },
              { label: "Max Credit Years", value: `${riderParams.maxCreditYrs} yrs` },
              { label: "Step-Up Guarantee", value: `${(riderParams.stepUpGuarantee * 100).toFixed(0)}%` },
            ].map((f, i) => (
              <div key={i}>
                <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", marginBottom: 3 }}>{f.label}</div>
                <div style={{ fontSize: 12, color: "white", fontWeight: 500 }}>{f.value}</div>
              </div>
            ))}
            {/* MAWP mini-table */}
            <div>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>MAWP Rates</div>
              {riderParams.mawpTable.map((b, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "rgba(255,255,255,0.65)", padding: "1px 0" }}>
                  <span>{b.minAge}–{b.maxAge}</span><span style={{ color: "#6ee7b7" }}>{pct(b.single)}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>PIP Rates</div>
              {riderParams.pipTable ? riderParams.pipTable.map((b, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "rgba(255,255,255,0.65)", padding: "1px 0" }}>
                  <span>{b.minAge}–{b.maxAge}</span><span style={{ color: "#fca5a5" }}>{pct(b.single)}</span>
                </div>
              )) : <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontStyle: "italic" }}>Continues at MAWP rate</div>}
            </div>
          </div>
          {apiStatus === "error" && <div style={{ marginTop: 8, fontSize: 10, color: "#fca5a5" }}>⚠ {apiError} — using fallback defaults</div>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: sidebarPlacement === "inline" ? "1fr 220px" : "1fr", minHeight: "calc(100vh - 44px)" }}>

        {/* ═══ MAIN CONTENT ═══ */}
        <div style={{ padding: 20, overflowY: "auto" }}>

          {/* ─── Sub-header breadcrumb ─── */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 10, color: C.textLight, marginBottom: 2 }}>Insurance › {riderParams.productName} › {riderParams.riderName}</div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{tabs.find(t => t.id === activeTab)?.label}</h2>
            </div>
            <div style={{ fontSize: 10, color: C.textLight }}>As of {new Date().toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" })} {apiStatus === "success" && <span style={{ color: C.green }}>· API data current</span>}</div>
          </div>

          {/* ═══ CONTRACT DETAILS TAB ═══ */}
          {activeTab === "overview" && (
            <div className="fade-in">
              {/* Summary metric row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
                {[
                  { label: "Annual Income", value: optS ? fmt(optS.mawpIncome) : "—", sub: "MAWP · guaranteed for life", color: C.green, bg: C.greenBg },
                  { label: "Total Projected Income", value: optS ? fmt(optS.grandTotal) : "—", sub: `Ages ${optAge}–${lifeExp}`, color: C.accent, bg: C.accentLight },
                  { label: "Benefit Base at Activation", value: optS ? fmt(optS.bb) : "—", sub: optS ? `+${pct(optS.bb / initPremium - 1)} from ${pct(riderParams.creditRate)} credits` : "", color: C.accent, bg: C.accentLight },
                  { label: "Income Advantage", value: "+" + fmt(gain), sub: `vs. activating today at age ${currentAge}`, color: C.green, bg: C.greenBg },
                ].map((m, i) => (
                  <Card key={i} style={{ padding: "12px 14px", borderTop: `3px solid ${m.color}` }}>
                    <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: C.textLight, marginBottom: 6 }}>{m.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: m.color, lineHeight: 1, marginBottom: 3 }}>{m.value}</div>
                    <div style={{ fontSize: 10, color: C.textLight }}>{m.sub}</div>
                  </Card>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {/* Contract Details accordion */}
                <Card>
                  <CardHeader title="Contract Details" subtitle={`CUSIP 001399864 · ${riderParams.productName}`} />
                  <Accordion title="Main Information">
                    <LabelValue label="Contract Number" value="001399864" border />
                    <LabelValue label="Issuer" value="AIG / Corebridge Financial" border />
                    <LabelValue label="Product Type" value="Variable Annuity" border />
                    <LabelValue label="Rider" value={riderParams.riderName} border apiTag={apiStatus === "success"} />
                    <LabelValue label="Plan Type" value="Non-Qualified (LIFO)" border />
                    <LabelValue label="Total Premium" value={fmt(initPremium)} border />
                    <LabelValue label="Cost Basis" value={fmt(costBasis)} border />
                    <LabelValue label="Account Value" value={fmt(currentAV)} valueColor={C.accent} border />
                    <LabelValue label="Benefit Base" value={fmt(currentBB)} valueColor={C.accent} />
                  </Accordion>
                  <Accordion title="Contract Dates">
                    <LabelValue label="Issue Effective" value="11/01/2022" border />
                    <LabelValue label="Contract Year" value={contractYear} border />
                    <LabelValue label="Owner Age at Issue" value={currentAge - contractYear} border />
                    <LabelValue label="Current Owner Age" value={currentAge} />
                  </Accordion>
                  <Accordion title="Contract Details">
                    <LabelValue label="Original Investment" value={fmt(initPremium)} border />
                    <LabelValue label="Account Value" value={fmt(currentAV)} valueColor={C.accent} border />
                    <LabelValue label="Unrealized Gain" value={fmt(currentAV - costBasis)} valueColor={C.green} border />
                    <LabelValue label="AV Depletes At" value={optS?.depletesAtAge ? `Age ${optS.depletesAtAge}` : `> Age ${lifeExp}`} valueColor={optS?.depletesAtAge ? C.red : C.green} />
                  </Accordion>
                </Card>

                {/* Rider Details accordion */}
                <Card>
                  <CardHeader title="Rider Details" subtitle={riderParams.riderName} right={apiStatus === "success" ? <Badge>API Live</Badge> : null} />
                  <Accordion title="GMWB Rider Parameters">
                    <LabelValue label="Income Credit Rate" value={pct(riderParams.creditRate)} valueColor={C.accent} border apiTag={apiStatus === "success"} />
                    <LabelValue label="Max Credit Years" value={`${riderParams.maxCreditYrs} contract years`} border apiTag={apiStatus === "success"} />
                    <LabelValue label="Step-Up Guarantee" value={`${(riderParams.stepUpGuarantee * 100).toFixed(0)}% of purchase payments`} border apiTag={apiStatus === "success"} />
                    <LabelValue label="Annual Rider Fee" value={pct(riderParams.feeRate)} valueColor={C.red} border apiTag={apiStatus === "success"} />
                    <LabelValue label="Based On Life" value="Single Life (Owner)" border />
                    <LabelValue label="Spousal Continuation" value="Available" />
                  </Accordion>
                  <Accordion title="MAWP Rate Table — Option 2">
                    <div style={{ padding: "4px 14px 8px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: `1px solid ${C.borderLight}`, paddingBottom: 4, marginBottom: 2 }}>
                        {["Age Band", "Single Life", "Joint Life"].map(h => <span key={h} style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textLight }}>{h}</span>)}
                      </div>
                      {riderParams.mawpTable.map((b, i) => (
                        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "4px 0", borderBottom: i < riderParams.mawpTable.length - 1 ? `1px solid ${C.borderLight}` : "none" }}>
                          <span style={{ fontSize: 11, color: C.textMid }}>{b.minAge}–{b.maxAge}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: C.accent }}>{pct(b.single)}</span>
                          <span style={{ fontSize: 11, color: C.textMid }}>{pct(b.joint)}</span>
                        </div>
                      ))}
                    </div>
                  </Accordion>
                  <Accordion title="PIP Rate Table — Option 2" defaultOpen={false}>
                    <div style={{ padding: "4px 14px 8px" }}>
                      {riderParams.pipTable ? (
                        <>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: `1px solid ${C.borderLight}`, paddingBottom: 4, marginBottom: 2 }}>
                            {["Age Band", "Single Life", "Joint Life"].map(h => <span key={h} style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textLight }}>{h}</span>)}
                          </div>
                          {riderParams.pipTable.map((b, i) => (
                            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "4px 0", borderBottom: i < riderParams.pipTable.length - 1 ? `1px solid ${C.borderLight}` : "none" }}>
                              <span style={{ fontSize: 11, color: C.textMid }}>{b.minAge}–{b.maxAge}</span>
                              <span style={{ fontSize: 11, fontWeight: 600, color: C.red }}>{pct(b.single)}</span>
                              <span style={{ fontSize: 11, color: C.textMid }}>{pct(b.joint)}</span>
                            </div>
                          ))}
                        </>
                      ) : (
                        <div style={{ fontSize: 11, color: C.textLight, fontStyle: "italic", padding: "4px 0" }}>No PIP rate — income continues at MAWP rate after account depletion</div>
                      )}
                    </div>
                  </Accordion>
                </Card>
              </div>
            </div>
          )}

          {/* ═══ INCOME PROJECTION TAB ═══ */}
          {activeTab === "income" && (
            <div className="fade-in">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
                {[
                  ["Activation Age", `Age ${optAge}`, C.accent],
                  ["Annual MAWP Income", optS ? fmt(optS.mawpIncome) : "—", C.green],
                  ["AV Depletes", optS?.depletesAtAge ? `Age ${optS.depletesAtAge}` : "Never", optS?.depletesAtAge ? C.red : C.green],
                  ["Total Lifetime Income", optS ? fmt(optS.grandTotal) : "—", C.accent],
                ].map(([l, v, vc], i) => (
                  <Card key={i} style={{ padding: "11px 13px" }}>
                    <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: C.textLight, marginBottom: 5 }}>{l}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: vc }}>{v}</div>
                  </Card>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <Card>
                  <CardHeader title="Lifetime Income by Activation Age" subtitle={`MAWP + PIP · projected through age ${lifeExp}`} />
                  <div style={{ padding: "12px 4px 8px" }}>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={scenarioData} barCategoryGap="18%">
                        <CartesianGrid strokeDasharray="2 3" stroke={C.borderLight} vertical={false} />
                        <XAxis dataKey="age" tick={{ fill: C.textLight, fontSize: 9 }} axisLine={{ stroke: C.border }} tickLine={false} />
                        <YAxis tick={{ fill: C.textLight, fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={fmtK} />
                        <Tooltip content={<Tooltip_ />} />
                        <Bar dataKey="mawp" stackId="a" name="MAWP">{scenarioData.map((d, i) => <Cell key={i} fill={d.isOpt ? C.chartGreen : "#c6e6d0"} />)}</Bar>
                        <Bar dataKey="pip" stackId="a" name="PIP" radius={[2, 2, 0, 0]}>{scenarioData.map((d, i) => <Cell key={i} fill={d.isOpt ? C.chartRed : "#fecaca"} />)}</Bar>
                        <ReferenceLine x={optAge} stroke={C.accent} strokeDasharray="3 3" strokeWidth={1.5} label={{ value: "Optimal", position: "top", fill: C.accent, fontSize: 9 }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <Card>
                  <CardHeader title="Annual Income & Account Value" subtitle={`From activation age ${optAge} · ${growthRate}% growth assumption`} />
                  <div style={{ padding: "12px 4px 8px" }}>
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={incomeData}>
                        <defs>
                          <linearGradient id="avG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.chartBlue} stopOpacity={0.15} /><stop offset="100%" stopColor={C.chartBlue} stopOpacity={0.02} /></linearGradient>
                          <linearGradient id="mG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.chartGreen} stopOpacity={0.3} /><stop offset="100%" stopColor={C.chartGreen} stopOpacity={0.02} /></linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="2 3" stroke={C.borderLight} vertical={false} />
                        <XAxis dataKey="age" tick={{ fill: C.textLight, fontSize: 9 }} axisLine={{ stroke: C.border }} tickLine={false} />
                        <YAxis tick={{ fill: C.textLight, fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={fmtK} />
                        <Tooltip content={<Tooltip_ />} />
                        <Area type="monotone" dataKey="av" name="Account Value" stroke={C.chartBlue} fill="url(#avG)" strokeWidth={1.5} />
                        <Area type="stepAfter" dataKey="mawp" name="MAWP" stroke={C.chartGreen} fill="url(#mG)" strokeWidth={1.5} />
                        <Area type="stepAfter" dataKey="pip" name="PIP" stroke={C.chartRed} fill="none" strokeWidth={1.5} strokeDasharray="4 2" />
                        {optS?.depletesAtAge && <ReferenceLine x={optS.depletesAtAge} stroke={C.chartRed} strokeDasharray="4 2" label={{ value: "AV Depletes", position: "insideTopRight", fill: C.red, fontSize: 9 }} />}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              <Card>
                <CardHeader title="Post-Activation Detail" subtitle={`Activation at age ${optAge} · year-by-year`} />
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: C.bg }}>
                        {["Age", "Account Value", "Phase", "Annual Income", "Cumulative Income"].map(h => (
                          <th key={h} style={{ padding: "7px 12px", textAlign: "right", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textLight, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {postAct.map((r, i) => (
                        <tr key={r.age} className="row-hover" style={{ borderBottom: `1px solid ${C.borderLight}`, background: i % 2 === 0 ? C.white : "#fafbfc" }}>
                          <td style={{ padding: "6px 12px", textAlign: "right", color: C.text, fontWeight: 500 }}>{r.age}</td>
                          <td style={{ padding: "6px 12px", textAlign: "right", color: r.av > 0 ? C.accent : C.red }}>{r.av > 0 ? fmt(r.av) : "$0"}</td>
                          <td style={{ padding: "6px 12px", textAlign: "right" }}><Pill phase={r.phase} /></td>
                          <td style={{ padding: "6px 12px", textAlign: "right", color: r.phase === "MAWP" ? C.green : C.red, fontWeight: 500 }}>{fmt(r.income)}</td>
                          <td style={{ padding: "6px 12px", textAlign: "right", color: C.accent, fontWeight: 600 }}>{fmt(r.cumIncome)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* ═══ SCENARIOS TAB ═══ */}
          {activeTab === "whatif" && (
            <div className="fade-in">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginBottom: 12 }}>
                <Card>
                  <CardHeader title="Assumptions" subtitle="Manual inputs · adjust to model scenarios" />
                  <div style={{ padding: "8px 14px 12px" }}>
                    {[
                      { label: "Account Value Growth Rate", value: growthRate, set: setGrowthRate, min: 0, max: 10, step: 0.1, unit: "%" },
                      { label: "Life Expectancy", value: lifeExp, set: setLifeExp, min: 75, max: 100, step: 1, unit: " yrs" },
                      { label: "Marginal Tax Rate", value: taxRate, set: setTaxRate, min: 10, max: 40, step: 1, unit: "%" },
                    ].map((s, i) => (
                      <div key={i} style={{ marginBottom: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                          <span style={{ fontSize: 11, color: C.textMid }}>{s.label}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>{s.value}{s.unit}</span>
                        </div>
                        <input type="range" min={s.min} max={s.max} step={s.step} value={s.value} onChange={(e) => s.set(Number(e.target.value))} />
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                          <span style={{ fontSize: 9, color: C.textLight }}>{s.min}{s.unit}</span>
                          <span style={{ fontSize: 9, color: C.textLight }}>{s.max}{s.unit}</span>
                        </div>
                      </div>
                    ))}
                    {apiStatus === "success" && (
                      <div style={{ background: C.accentLight, border: `1px solid ${C.border}`, borderRadius: 3, padding: "8px 10px", fontSize: 10, color: C.textMid, marginTop: 4 }}>
                        <span style={{ color: C.accent, fontWeight: 600 }}>API Locked:</span> {pct(riderParams.creditRate)} credit · {pct(riderParams.feeRate)} fee · {riderParams.maxCreditYrs}-yr credits · {(riderParams.stepUpGuarantee * 100).toFixed(0)}% step-up · age-banded MAWP/PIP
                      </div>
                    )}
                  </div>
                </Card>
                <Card>
                  <CardHeader title="Total Lifetime Income by Activation Age" subtitle={`MAWP + PIP · life expectancy age ${lifeExp}`} />
                  <div style={{ padding: "12px 4px 8px" }}>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={scenarioData} barCategoryGap="15%">
                        <CartesianGrid strokeDasharray="2 3" stroke={C.borderLight} vertical={false} />
                        <XAxis dataKey="age" tick={{ fill: C.textLight, fontSize: 9 }} axisLine={{ stroke: C.border }} tickLine={false} label={{ value: "Activation Age →", position: "insideBottom", offset: -5, fill: C.textLight, fontSize: 9 }} />
                        <YAxis tick={{ fill: C.textLight, fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={fmtK} />
                        <Tooltip content={<Tooltip_ />} />
                        <Bar dataKey="total" name="Total Income" radius={[2, 2, 0, 0]}>
                          {scenarioData.map((d, i) => <Cell key={i} fill={d.isOpt ? C.accent : "#c3d8f0"} />)}
                        </Bar>
                        <ReferenceLine x={optAge} stroke={C.accent} strokeDasharray="3 3" label={{ value: `Optimal · Age ${optAge}`, position: "top", fill: C.accent, fontSize: 9 }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              <Card>
                <CardHeader title="Scenario Comparison Table" subtitle="All activation ages · sorted by income" />
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: C.bg }}>
                        {["Activation Age", "Benefit Base", "MAWP Rate", "Annual Income", "AV at Act.", "AV Depletes", "MAWP Total", "PIP Total", "Grand Total", "vs. Optimal"].map(h => (
                          <th key={h} style={{ padding: "7px 10px", textAlign: "right", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.07em", color: C.textLight, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {scenarios.map((s, i) => {
                        const isOpt = s.activateAtAge === optAge;
                        const diff = optS ? s.grandTotal - optS.grandTotal : 0;
                        return (
                          <tr key={s.activateAtAge} className="row-hover" style={{ borderBottom: `1px solid ${C.borderLight}`, background: isOpt ? C.accentLight : i % 2 === 0 ? C.white : "#fafbfc" }}>
                            <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: isOpt ? 700 : 400, color: isOpt ? C.accent : C.text }}>
                              {s.activateAtAge} {isOpt && <Badge>Optimal</Badge>}
                            </td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: C.textMid }}>{fmt(s.bb)}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: C.textMid }}>{pct(s.mawpRate)}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: isOpt ? 600 : 400, color: isOpt ? C.green : C.textMid }}>{fmt(s.mawpIncome)}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: C.textMid }}>{fmt(s.avAtActivation)}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: C.textMid }}>{s.depletesAtAge ? `Age ${s.depletesAtAge}` : `>${lifeExp}`}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: C.textMid }}>{fmt(s.mawpTotal)}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: C.red }}>{fmt(s.pipTotal)}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: isOpt ? 700 : 400, color: isOpt ? C.accent : C.textMid }}>{fmt(s.grandTotal)}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: isOpt ? C.textLight : diff < 0 ? C.red : C.green }}>{isOpt ? "—" : (diff >= 0 ? "+" : "") + fmt(diff)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* ═══ TAX ANALYSIS TAB ═══ */}
          {activeTab === "tax" && (
            <div className="fade-in">
              <div style={{ background: "#fffbeb", border: `1px solid #fcd34d`, borderRadius: 4, padding: "10px 14px", marginBottom: 14, fontSize: 11, color: C.amber }}>
                <strong>Non-Qualified LIFO Treatment:</strong> Funded with {fmt(costBasis)} after-tax dollars. Under IRS LIFO rules, withdrawals are treated as earnings first (100% taxable) until gains are exhausted, then as tax-free return of basis.
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 14 }}>
                {[
                  ["Cost Basis", fmt(costBasis), C.text],
                  ["AV at Activation", fmt(lifoTax.avAtActivation), C.accent],
                  ["Total Gain (LIFO)", fmt(lifoTax.totalGain), C.red],
                  ["Lifetime Tax Owed", fmt(lifoTax.yearByYear[lifoTax.yearByYear.length - 1]?.cumTax || 0), C.amber],
                  ["Lifetime After-Tax", fmt(lifoTax.yearByYear[lifoTax.yearByYear.length - 1]?.cumAfterTax || 0), C.green],
                ].map(([l, v, vc], i) => (
                  <Card key={i} style={{ padding: "10px 12px" }}>
                    <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: C.textLight, marginBottom: 5 }}>{l}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: vc }}>{v}</div>
                  </Card>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <Card>
                  <CardHeader title="LIFO Income Breakdown by Year" subtitle="Taxable gains vs. tax-free basis recovery" />
                  <div style={{ padding: "12px 4px 8px" }}>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={lifoTax.yearByYear} barCategoryGap="6%">
                        <CartesianGrid strokeDasharray="2 3" stroke={C.borderLight} vertical={false} />
                        <XAxis dataKey="age" tick={{ fill: C.textLight, fontSize: 9 }} axisLine={{ stroke: C.border }} tickLine={false} />
                        <YAxis tick={{ fill: C.textLight, fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={fmtK} />
                        <Tooltip content={<Tooltip_ />} />
                        <Bar dataKey="taxablePortion" stackId="l" name="Taxable (Gains)" fill={C.chartRed} />
                        <Bar dataKey="taxFreePortion" stackId="l" name="Tax-Free (Basis)" fill={C.chartGreen} radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <Card>
                  <CardHeader title="Annuity vs. Taxable Account" subtitle={`Cumulative after-tax · ${fmt(costBasis)} starting investment`} />
                  <div style={{ padding: "12px 4px 8px" }}>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={taxChartData}>
                        <CartesianGrid strokeDasharray="2 3" stroke={C.borderLight} vertical={false} />
                        <XAxis dataKey="age" tick={{ fill: C.textLight, fontSize: 9 }} axisLine={{ stroke: C.border }} tickLine={false} />
                        <YAxis tick={{ fill: C.textLight, fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={fmtK} />
                        <Tooltip content={<Tooltip_ />} />
                        <Line type="monotone" dataKey="annuity" name="Annuity (After-Tax)" stroke={C.chartBlue} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="taxable" name="Taxable Account" stroke={C.chartGray} strokeWidth={1.5} dot={false} strokeDasharray="5 3" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              <Card>
                <CardHeader title="Year-by-Year LIFO Tax Schedule" subtitle={`Non-qualified GLWB · ${fmt(costBasis)} cost basis · ${taxRate}% marginal rate`} />
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: C.bg }}>
                        {["Age", "Phase", "Gross Income", "Taxable", "Tax-Free", "Tax Owed", "After-Tax", "Eff. Rate", "LIFO Status"].map(h => (
                          <th key={h} style={{ padding: "7px 10px", textAlign: "right", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.07em", color: C.textLight, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {lifoTax.yearByYear.map((r, i) => (
                        <tr key={r.age} className="row-hover" style={{ borderBottom: `1px solid ${C.borderLight}`, background: r.lifoPhase === "BASIS" ? "#f0faf4" : i % 2 === 0 ? C.white : "#fafbfc" }}>
                          <td style={{ padding: "5px 10px", textAlign: "right", color: C.text, fontWeight: 500 }}>{r.age}</td>
                          <td style={{ padding: "5px 10px", textAlign: "right" }}><Pill phase={r.phase} /></td>
                          <td style={{ padding: "5px 10px", textAlign: "right", color: C.textMid }}>{fmt(r.grossIncome)}</td>
                          <td style={{ padding: "5px 10px", textAlign: "right", color: r.taxablePortion > 0 ? C.red : C.textLight }}>{fmt(r.taxablePortion)}</td>
                          <td style={{ padding: "5px 10px", textAlign: "right", color: r.taxFreePortion > 0 ? C.green : C.textLight }}>{fmt(r.taxFreePortion)}</td>
                          <td style={{ padding: "5px 10px", textAlign: "right", color: r.taxOwed > 0 ? C.amber : C.textLight }}>{fmt(r.taxOwed)}</td>
                          <td style={{ padding: "5px 10px", textAlign: "right", color: C.text, fontWeight: 500 }}>{fmt(r.afterTaxIncome)}</td>
                          <td style={{ padding: "5px 10px", textAlign: "right", color: r.effectiveRate === 0 ? C.green : C.textMid }}>{(r.effectiveRate * 100).toFixed(1)}%</td>
                          <td style={{ padding: "5px 10px", textAlign: "right" }}>
                            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: r.lifoPhase === "GAIN" ? C.red : r.lifoPhase === "BASIS" ? C.green : C.amber, background: r.lifoPhase === "GAIN" ? C.redBg : r.lifoPhase === "BASIS" ? C.greenBg : C.amberBg, borderRadius: 2, padding: "2px 5px" }}>
                              {r.lifoPhase === "GAIN" ? "Gains" : r.lifoPhase === "BASIS" ? "Basis" : "Taxable"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* ═══ FULL ANALYSIS TAB ═══ */}
          {activeTab === "detail" && (
            <div className="fade-in">
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginBottom: 12 }}>
                <Card>
                  <CardHeader title="Benefit Base vs. Account Value Growth" subtitle={`Pre-activation · ${pct(riderParams.creditRate)} income credits · API populated`} right={apiStatus === "success" ? <Badge>API</Badge> : null} />
                  <div style={{ padding: "12px 4px 8px" }}>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={bbData}>
                        <CartesianGrid strokeDasharray="2 3" stroke={C.borderLight} vertical={false} />
                        <XAxis dataKey="age" tick={{ fill: C.textLight, fontSize: 9 }} axisLine={{ stroke: C.border }} tickLine={false} />
                        <YAxis tick={{ fill: C.textLight, fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={fmtK} />
                        <Tooltip content={<Tooltip_ />} />
                        <Line type="monotone" dataKey="bb" name="Benefit Base" stroke={C.chartAmber} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="av" name="Account Value" stroke={C.chartBlue} strokeWidth={1.5} dot={false} strokeDasharray="5 3" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              <Card>
                <CardHeader title="Complete Scenario Analysis" subtitle={`API-driven rates · ${growthRate}% growth · life expectancy age ${lifeExp}`} right={apiStatus === "success" ? <Badge>API Rates</Badge> : null} />
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: C.bg }}>
                        {["Age", "Benefit Base", "MAWP Rate", "Income/yr", "AV at Act.", "AV Depletes", "MAWP Total", "PIP Total", "Grand Total", "vs Optimal"].map(h => (
                          <th key={h} style={{ padding: "7px 10px", textAlign: "right", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.07em", color: C.textLight, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {scenarios.map((s, i) => {
                        const isOpt = s.activateAtAge === optAge, diff = optS ? s.grandTotal - optS.grandTotal : 0;
                        return (
                          <tr key={s.activateAtAge} className="row-hover" style={{ borderBottom: `1px solid ${C.borderLight}`, background: isOpt ? C.accentLight : i % 2 === 0 ? C.white : "#fafbfc" }}>
                            <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: isOpt ? 700 : 400, color: isOpt ? C.accent : C.text }}>{s.activateAtAge} {isOpt && <Badge>OPT</Badge>}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: C.textMid }}>{fmt(s.bb)}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: C.textMid }}>{pct(s.mawpRate)}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: isOpt ? 600 : 400, color: isOpt ? C.green : C.textMid }}>{fmt(s.mawpIncome)}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: C.textMid }}>{fmt(s.avAtActivation)}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: C.textMid }}>{s.depletesAtAge ? `Age ${s.depletesAtAge}` : `>${lifeExp}`}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: C.textMid }}>{fmt(s.mawpTotal)}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: C.red }}>{fmt(s.pipTotal)}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: isOpt ? 700 : 400, color: isOpt ? C.accent : C.textMid }}>{fmt(s.grandTotal)}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: isOpt ? C.textLight : diff < 0 ? C.red : C.green }}>{isOpt ? "—" : (diff >= 0 ? "+" : "") + fmt(diff)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </div>

        {sidebarPlacement === "inline" && sidebar}

      </div>
    </div>
  );
}
