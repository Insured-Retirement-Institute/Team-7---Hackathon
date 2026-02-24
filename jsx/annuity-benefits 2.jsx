import { useState, useMemo, useEffect, useRef, useCallback } from "react";

// Load fonts
const _fontLink = document.createElement("link");
_fontLink.rel = "stylesheet";
_fontLink.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=DM+Serif+Display:ital@0;1&family=JetBrains+Mono:wght@400;500;600&display=swap";
document.head.appendChild(_fontLink);
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine } from "recharts";

// ─── API Configuration ───
const API_URL = "https://stage-profile.an.annuitynexus.com/api/profile?token=xpdhwqifofnlkdnqbksurbcaldheqj&cusip=246115208&policydate=2022-11-01";

const CONTRACT_YR  = 3;          // contract year (issue Nov 2022 → year 3 as of Feb 2026)
const INIT_BB      = 180000;     // ← update with actual benefit base
const COST_BASIS   = 100000;     // ← update with actual premium paid
const CURRENT_AGE  = 63;         // ← update with owner's current age
const COMPANY_NAME = "Delaware Life Insurance Company";
const CONTRACT_NUM = "—";        // ← update with contract number

// Income Control GLWB V1 — Delaware Life Accelerator Prime VA (CUSIP 246115208)
const GLWB_RATES = [
  { minAge: 55, maxAge: 59,  single: 0.0425, joint: 0.0375 },
  { minAge: 60, maxAge: 64,  single: 0.0480, joint: 0.0430 },
  { minAge: 65, maxAge: 69,  single: 0.0615, joint: 0.0565 },
  { minAge: 70, maxAge: 74,  single: 0.0635, joint: 0.0585 },
  { minAge: 75, maxAge: 79,  single: 0.0660, joint: 0.0610 },
  { minAge: 80, maxAge: 84,  single: 0.0675, joint: 0.0625 },
  { minAge: 85, maxAge: 100, single: 0.0675, joint: 0.0625 },
];

const FALLBACK_PARAMS = {
  creditRate: 0.08,           // Income Control GLWB V1 — 8%/yr rollup
  feeRate: 0.0135,            // 1.35% annual (0.3375% quarterly)
  maxCreditYrs: 10,           // 10-year rollup window
  stepUpGuarantee: 1.0,       // step-up to CV; no fixed % floor
  productName: "Accelerator Prime Variable Annuity",
  riderName: "Income Control GLWB V1",
  mawpTable: GLWB_RATES,      // GLWB — single rate applies throughout (no separate PIP rate)
  pipTable:  GLWB_RATES,      // same rate; insurer pays same amount after AV depletes (insurer continues payment)
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

      // Fee: find "C" case; num1 may be annual (≥1) or quarterly (<1 needing ×4)
      const feeCase = cases.find((c) => c.isCaseAOrC === "C");
      let feeRate = FALLBACK_PARAMS.feeRate;
      if (feeCase) {
        const raw = feeCase.num1 || 0;
        // If stored as quarterly (e.g. 0.3375) multiply ×4; if annual (e.g. 1.35) use directly
        feeRate = (raw < 1 ? raw * 4 : raw) / 100;
      }

      // Rollup: extract from "R" case if rider.rollupPercentage is null
      const rollupCase = cases.find((c) => c.isCaseAOrC === "R");
      const creditRate = rider.rollupPercentage != null
        ? rider.rollupPercentage / 100
        : rollupCase ? rollupCase.num1 / 100
        : FALLBACK_PARAMS.creditRate;
      const maxCreditYrs = rider.maxRollupYears || rollupCase?.maxRollupYears || FALLBACK_PARAMS.maxCreditYrs;

      // Withdrawal rates: look for MAWP/PIP distinction first; fall back to all "A" cases
      const optionSet = new Set();
      cases.forEach((c) => {
        if (!c.notes) return;
        const m = c.notes.match(/(?:Income\s+)?Option\s+(\d+)/i);
        if (m) optionSet.add(`Option ${m[1]}`);
      });
      const incomeOptions = [...optionSet].sort();

      const optionTables = {};
      if (incomeOptions.length) {
        incomeOptions.forEach((opt) => {
          const num = opt.replace("Option ", "");
          const mawpCases = cases.filter((c) =>
            c.isCaseAOrC === "A" && c.notes &&
            (c.notes.includes("MAWA") || c.notes.includes("MAWP")) &&
            c.notes.match(new RegExp(`(?:Income\\s+)?Option\\s+${num}`, "i"))
          );
          const pipCases = cases.filter((c) =>
            c.isCaseAOrC === "A" && c.notes && c.notes.includes("Insurer Pays") &&
            c.notes.match(new RegExp(`(?:Income\\s+)?Option\\s+${num}`, "i"))
          );
          const allACases = cases.filter((c) => c.isCaseAOrC === "A" && c.ageBand1 != null);
          optionTables[opt] = {
            mawpTable: mawpCases.length ? buildT(mawpCases) : buildT(allACases).length ? buildT(allACases) : FALLBACK_PARAMS.mawpTable,
            pipTable:  pipCases.length  ? buildT(pipCases)  : buildT(allACases).length ? buildT(allACases) : FALLBACK_PARAMS.pipTable,
          };
        });
      } else {
        // No named options — Delaware Life GLWB style: all "A" cases are the withdrawal table
        const mawpAll = cases.filter((c) => c.isCaseAOrC === "A" && c.notes && (c.notes.includes("MAWA") || c.notes.includes("MAWP")));
        const pipAll  = cases.filter((c) => c.isCaseAOrC === "A" && c.notes && c.notes.includes("Insurer Pays"));
        const allA    = cases.filter((c) => c.isCaseAOrC === "A" && c.ageBand1 != null);
        incomeOptions.push("Default");
        optionTables["Default"] = {
          mawpTable: mawpAll.length ? buildT(mawpAll) : allA.length ? buildT(allA) : FALLBACK_PARAMS.mawpTable,
          pipTable:  pipAll.length  ? buildT(pipAll)  : allA.length ? buildT(allA) : FALLBACK_PARAMS.pipTable,
        };
      }

      return {
        id: rider.id || rider.name,
        name: rider.name || "Unknown Rider",
        creditRate,
        maxCreditYrs,
        stepUpGuarantee: rider.stepUpPerct != null ? rider.stepUpPerct / 100 : FALLBACK_PARAMS.stepUpGuarantee,
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
  const tables = rider.optionTables[opt] || { mawpTable: FALLBACK_PARAMS.mawpTable, pipTable: FALLBACK_PARAMS.pipTable };
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
  const { growth = 0.052, lifeExp = 85, taxRate = 0.24, creditRate, feeRate, maxCreditYrs, stepUpGuarantee, mawpTable, pipTable } = params;
  const initPremium = INIT_BB / (1 + creditRate * CONTRACT_YR);
  let av = initPremium, bb = initPremium;
  for (let yr = 1; yr <= CONTRACT_YR; yr++) { av = av + av * growth - bb * feeRate; bb = Math.max(av, initPremium * (1 + creditRate * yr)); }
  const currentAV = av, currentBB = INIT_BB;
  function buildPre() {
    let avL = currentAV, bbL = currentBB; const rows = [];
    for (let yr = 0; yr <= maxCreditYrs - CONTRACT_YR; yr++) {
      const age = CURRENT_AGE + yr, cyr = CONTRACT_YR + yr;
      const avEOY = avL + avL * growth - bbL * feeRate;
      let newBB = cyr < maxCreditYrs ? Math.max(avEOY, initPremium * (1 + creditRate * (cyr + 1))) : Math.max(avEOY, initPremium * (1 + creditRate * maxCreditYrs), initPremium * stepUpGuarantee);
      rows.push({ age, cyr, avEOY, bbEOY: newBB }); avL = avEOY; bbL = newBB;
    }
    return rows;
  }
  const preActRows = buildPre();
  function getState(targetAge) {
    if (targetAge === CURRENT_AGE) return { av: currentAV, bb: currentBB };
    const yrs = targetAge - CURRENT_AGE;
    if (yrs > 0 && yrs <= preActRows.length) { const r = preActRows[yrs - 1]; return { av: r.avEOY, bb: r.bbEOY }; }
    const last = preActRows[preActRows.length - 1]; let avX = last.avEOY, bbX = last.bbEOY;
    for (let i = 0; i < yrs - preActRows.length; i++) { avX = avX + avX * growth - bbX * feeRate; bbX = Math.max(avX, bbX); }
    return { av: avX, bb: bbX };
  }
  function computeScenario(actAge) {
    const { bb: sBB, av: sAV } = getState(actAge);
    const mawpRate = getMawpRate(actAge, mawpTable), pipRate = getPipRate(actAge, pipTable);
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
  function buildPostAct(s, oAge) {
    let avP = s.avAtActivation, cumIncome = 0, depleted = false; const rows = [];
    for (let y = 0; y < lifeExp - oAge; y++) {
      const age = oAge + y;
      if (depleted) { cumIncome += s.pipIncome; rows.push({ age, av: 0, phase: "Insurer Pays", income: s.pipIncome, cumIncome }); }
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
      if (dep) { gw = optS.pipIncome; phase = "Insurer Pays"; } else { gw = optS.mawpIncome; phase = "MAWP"; avT = avT + avT * growth - optS.bb * feeRate - gw; if (avT <= 0) { dep = true; avT = 0; } }
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
  return { scenarios, optAge, optS, curS, postAct, preActRows, currentAV, currentBB, lifoTax, taxChartData: buildTaxComp() };
}

const fmt = (n) => "$" + Math.round(n).toLocaleString();
const fmtK = (n) => Math.abs(n) >= 1e6 ? "$" + (n / 1e6).toFixed(1) + "M" : Math.abs(n) >= 1e3 ? "$" + Math.round(n / 1e3) + "k" : "$" + Math.round(n);
const pct = (n) => (n * 100).toFixed(2) + "%";

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
  const isMAWP = phase === "MAWP"; // GLWB active phase
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
  { id: "risks", label: "Things to Be Aware Of" },
];

export default function AnnuityBenefitsViz() {
  const [activeTab, setActiveTab] = useState("overview");
  const [growthRate, setGrowthRate] = useState(5.2);
  const [lifeExp, setLifeExp] = useState(85);
  const [taxRate, setTaxRate] = useState(24);
  const [apiCatalog, setApiCatalog] = useState(null);
  const [selectedRider, setSelectedRider] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [selectedAge, setSelectedAge] = useState(null); // null = use model optimal
  const [openCards, setOpenCards] = useState({});
  const [openSec, setOpenSec] = useState({});
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [riderParams, setRiderParams] = useState(FALLBACK_PARAMS);
  const [apiStatus, setApiStatus] = useState("idle");
  const [apiError, setApiError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);
  const [showParamPanel, setShowParamPanel] = useState(false);

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

  useEffect(() => { fetchApiData(); }, [fetchApiData]);

  const model = useMemo(() => runModel({
    growth: growthRate / 100, lifeExp, taxRate: taxRate / 100,
    creditRate: riderParams.creditRate, feeRate: riderParams.feeRate,
    maxCreditYrs: riderParams.maxCreditYrs, stepUpGuarantee: riderParams.stepUpGuarantee,
    mawpTable: riderParams.mawpTable, pipTable: riderParams.pipTable,
  }), [growthRate, lifeExp, taxRate, riderParams]);

  const { optAge, optS, curS, postAct, scenarios, currentAV, lifoTax, taxChartData } = model;

  // activeAge: user override or model optimal
  const activeAge = selectedAge !== null ? selectedAge : optAge;
  const activeS   = scenarios.find((s) => s.activateAtAge === activeAge) || optS;
  const activePostAct = (() => {
    if (activeAge === optAge) return postAct;
    // rebuild post-activation rows for the chosen age
    const s = activeS;
    let avP = s.avAtActivation, cumIncome = 0, depleted = false;
    const rows = [];
    const le = lifeExp;
    for (let y = 0; y < le - activeAge; y++) {
      const age = activeAge + y;
      if (depleted) { cumIncome += s.pipIncome; rows.push({ age, av: 0, phase: "Insurer Pays", income: s.pipIncome, cumIncome }); }
      else { const eoy = avP + avP * (model.growthUsed || 0.052) - s.bb * riderParams.feeRate - s.mawpIncome; cumIncome += s.mawpIncome; if (eoy <= 0) { depleted = true; rows.push({ age, av: 0, phase: "MAWP", income: s.mawpIncome, cumIncome }); avP = 0; } else { rows.push({ age, av: eoy, phase: "MAWP", income: s.mawpIncome, cumIncome }); avP = eoy; } }
    }
    return rows;
  })();

  const gain = activeS.grandTotal - curS.grandTotal;
  const isOverridden = selectedAge !== null && selectedAge !== optAge;
  const incomeData = activePostAct.map((r) => ({ age: r.age, mawp: r.phase === "MAWP" ? r.income : 0, pip: r.phase === "Insurer Pays" ? r.income : 0, cumulative: r.cumIncome, av: r.av }));
  const scenarioData = scenarios.map((s) => ({ age: s.activateAtAge, total: s.grandTotal, isOpt: s.activateAtAge === activeAge, isModelOpt: s.activateAtAge === optAge, mawp: s.mawpTotal, pip: s.pipTotal }));
  const bbData = model.preActRows.map((r) => ({ age: r.age, bb: r.bbEOY, av: r.avEOY }));

  const statusDot = { idle: "#8896a8", loading: "#d97706", success: "#2d7a4e", partial: "#d97706", error: "#dc2626" }[apiStatus];
  const statusText = { idle: "Not loaded", loading: "Fetching…", success: "Live", partial: "Defaults", error: "Error" }[apiStatus];

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", background: C.bg, minHeight: "100vh", color: C.text }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .display-font { font-family: 'DM Serif Display', Georgia, serif !important; letter-spacing: -0.01em; }
        body, button, input, select, textarea { font-family: 'Inter', -apple-system, sans-serif; }
        table, table th, table td { font-family: 'JetBrains Mono', 'Fira Mono', 'Consolas', monospace; }
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
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>GLWB Withdrawal Rates</div>
              {riderParams.mawpTable.map((b, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "rgba(255,255,255,0.65)", padding: "1px 0" }}>
                  <span>{b.minAge}–{b.maxAge}</span><span style={{ color: "#6ee7b7" }}>{pct(b.single)}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>PIP Rates</div>
              {riderParams.pipTable.map((b, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "rgba(255,255,255,0.65)", padding: "1px 0" }}>
                  <span>{b.minAge}–{b.maxAge}</span><span style={{ color: "#fca5a5" }}>{pct(b.single)}</span>
                </div>
              ))}
            </div>
          </div>
          {apiStatus === "error" && <div style={{ marginTop: 8, fontSize: 10, color: "#fca5a5" }}>⚠ {apiError} — using fallback defaults</div>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", minHeight: "calc(100vh - 44px)" }}>

        {/* ═══ MAIN CONTENT ═══ */}
        <div style={{ padding: activeTab === "risks" ? 0 : 20, overflowY: "auto" }}>

          {/* ─── Sub-header breadcrumb ─── */}
          {activeTab !== "risks" && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 10, color: C.textLight, marginBottom: 2 }}>Insurance › {riderParams.productName} › {riderParams.riderName}</div>
              <h2 className="display-font" style={{ fontSize: 18, fontWeight: 400, color: C.text }}>{tabs.find(t => t.id === activeTab)?.label}</h2>
            </div>
            <div style={{ fontSize: 10, color: C.textLight }}>As of {new Date().toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" })} {apiStatus === "success" && <span style={{ color: C.green }}>· API data current</span>}</div>
          </div>}

          {/* ═══ CONTRACT DETAILS TAB ═══ */}
          {activeTab === "overview" && (() => {
            const RateTable = ({ table, valueColor }) => (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: `1px solid ${C.borderLight}`, paddingBottom: 4, marginBottom: 4 }}>
                  {["Age Band", "Single", "Joint"].map(h => <span key={h} style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.07em", color: C.textLight }}>{h}</span>)}
                </div>
                {table.map((b, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "3px 0", borderBottom: i < table.length - 1 ? `1px solid ${C.borderLight}` : "none" }}>
                    <span style={{ fontSize: 10, color: C.textMid }}>{b.minAge}–{b.maxAge}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: valueColor }}>{pct(b.single)}</span>
                    <span style={{ fontSize: 10, color: C.textMid }}>{pct(b.joint)}</span>
                  </div>
                ))}
              </div>
            );
            return (
            <div className="fade-in" style={{ padding: 0 }}>

              {/* ══ HERO BAND ══ */}
              <div style={{ background: C.navy, padding: "28px 32px 0", position: "relative", overflow: "hidden" }}>
                {/* Subtle grid texture */}
                <div style={{ position: "absolute", inset: 0, backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 39px, #ffffff06 39px, #ffffff06 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, #ffffff06 39px, #ffffff06 40px)`, pointerEvents: "none" }} />

                {/* Identity row */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, position: "relative" }}>
                  <div>
                    <div style={{ fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "#4a6a8a", marginBottom: 6 }}>
                      {riderParams.productName} · Delaware Life Insurance Company · Contract #{CONTRACT_NUM}
                    </div>
                    <div className="display-font" style={{ fontSize: 32, color: "#ffffff", lineHeight: 1, marginBottom: 4 }}>[Client Name]</div>
                    <div style={{ fontSize: 11, color: "#6b88a8" }}>
                      Owner DOB [DOB] · Age {CURRENT_AGE} · Issue 11/01/2022 · Non-Qualified
                      {apiStatus === "success" && <span style={{ marginLeft: 10, background: "#1a3a5c", color: "#4a9eff", fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 10, letterSpacing: "0.06em" }}>● API LIVE</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "#4a6a8a", marginBottom: 4 }}>Rider</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#8fb8e8" }}>{riderParams.riderName}</div>
                  </div>
                </div>

                {/* Central income story — the hero numbers */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr 1px 1fr", gap: 0, background: "#162438", margin: "0 -32px", padding: "20px 32px 20px" }}>
                  {/* Stat 1 */}
                  <div style={{ paddingRight: 28 }}>
                    <div style={{ fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "#4a6a8a", marginBottom: 6 }}>Income Base Today</div>
                    <div className="display-font" style={{ fontSize: 42, color: "#8fb8e8", lineHeight: 1, marginBottom: 4 }}>{fmt(INIT_BB)}</div>
                    <div style={{ fontSize: 10, color: "#4a6a8a" }}>{pct(INIT_BB / COST_BASIS - 1)} above premium · {riderParams.maxCreditYrs - CONTRACT_YR} yrs of 7% credits remaining</div>
                  </div>
                  <div style={{ background: "#1e3450" }} />
                  {/* Stat 2 */}
                  <div style={{ padding: "0 28px" }}>
                    <div style={{ fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "#4a6a8a", marginBottom: 6 }}>Optimal Annual Income</div>
                    <div className="display-font" style={{ fontSize: 42, color: "#4ade80", lineHeight: 1, marginBottom: 4 }}>{fmt(optS.mawpIncome)}</div>
                    <div style={{ fontSize: 10, color: "#4a6a8a" }}>Starting age {optAge} · {pct(optS.mawpRate)} rate · +{fmt(optS.mawpIncome - curS.mawpIncome)}/yr vs. today</div>
                  </div>
                  <div style={{ background: "#1e3450" }} />
                  {/* Stat 3 */}
                  <div style={{ paddingLeft: 28 }}>
                    <div style={{ fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "#4a6a8a", marginBottom: 6 }}>Lifetime Income (ages {optAge}–{lifeExp})</div>
                    <div className="display-font" style={{ fontSize: 42, color: "#e2a84b", lineHeight: 1, marginBottom: 4 }}>{fmt(optS.grandTotal)}</div>
                    <div style={{ fontSize: 10, color: "#4a6a8a" }}>{fmt(optS.mawpIncome)}/yr MAWP · {fmt(optS.pipIncome)}/yr PIP · {activeS.depletesAtAge ? `AV depletes age ${activeS.depletesAtAge}` : "AV sustained"}</div>
                  </div>
                </div>

                {/* Credit timeline bar */}
                <div style={{ padding: "12px 0 0", margin: "0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "#4a6a8a" }}>Income credit window — year {CONTRACT_YR} of {riderParams.maxCreditYrs}</span>
                    <span style={{ fontSize: 9, color: "#4a9eff", fontWeight: 600 }}>{riderParams.maxCreditYrs - CONTRACT_YR} years of 7% growth remaining</span>
                  </div>
                  <div style={{ display: "flex", gap: 3, height: 4 }}>
                    {Array.from({ length: riderParams.maxCreditYrs }, (_, i) => (
                      <div key={i} style={{ flex: 1, borderRadius: 2, background: i < CONTRACT_YR ? "#4a9eff" : "#1e3450", transition: "background 0.3s" }} />
                    ))}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, paddingBottom: 16 }}>
                    <span style={{ fontSize: 9, color: "#4a6a8a" }}>Issue 2022</span>
                    <span style={{ fontSize: 9, color: "#4a9eff" }}>Today · yr {CONTRACT_YR}</span>
                    <span style={{ fontSize: 9, color: "#4a6a8a" }}>Full credits yr {riderParams.maxCreditYrs}</span>
                  </div>
                </div>
              </div>

              {/* ══ SECOND ROW — Account values + contract quick-facts + expandable details ══ */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, background: C.borderLight, margin: "1px 0" }}>
                {[
                  { label: "Account Value", value: fmt(currentAV), sub: "Market value · invested funds", color: C.accent, bg: C.white },
                  { label: "Total Premium Paid", value: fmt(COST_BASIS), sub: "Your original investment", color: C.text, bg: C.white },
                  { label: "Unrealised Gain", value: fmt(currentAV - COST_BASIS), sub: `${pct((currentAV - COST_BASIS) / COST_BASIS)} since inception`, color: C.green, bg: C.white },
                ].map((s, i) => (
                  <div key={i} style={{ background: s.bg, padding: "14px 20px" }}>
                    <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: C.textLight, marginBottom: 6 }}>{s.label}</div>
                    <div className="display-font" style={{ fontSize: 24, color: s.color, lineHeight: 1, marginBottom: 3 }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: C.textLight }}>{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* ══ MAIN CONTENT — 2 col ══ */}
              <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 1, background: C.borderLight, marginBottom: 1 }}>

                {/* Left — Plain language summary */}
                <div style={{ background: C.white, padding: "20px 24px" }}>
                  <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.14em", color: C.accent, fontWeight: 700, marginBottom: 12 }}>What you own</div>

                  <div style={{ fontSize: 12, color: C.text, lineHeight: 1.8, marginBottom: 16 }}>
                    You own a <span style={{ fontWeight: 700 }}>variable annuity</span> with a <span style={{ fontWeight: 700 }}>guaranteed lifetime income rider</span>. Your investment grows (and fluctuates) in market-based accounts. The rider tracks a separate income base that grows at a guaranteed <span style={{ color: C.accent, fontWeight: 700 }}>7% per year</span> for up to 12 years — completely independent of market performance. When you activate income, the insurance company pays you a fixed annual amount for life, calculated as your income base multiplied by an age-based rate. That income continues <span style={{ fontWeight: 700 }}>even after your account hits zero</span> — the insurer covers it indefinitely.
                  </div>

                  {/* How it works — 3 steps */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    {[
                      { step: "01", label: "Now · Building", body: `Income base growing ${pct(riderParams.creditRate)}/yr. ${riderParams.maxCreditYrs - CONTRACT_YR} years of credits left.`, color: C.accent, bg: C.accentLight },
                      { step: "02", label: "Later · GLWB phase", body: `Income base × age rate. ${fmt(optS.mawpIncome)}/yr at age ${optAge}. Paid guaranteed for life.`, color: C.green, bg: C.greenBg },
                      { step: "03", label: "After · PIP phase", body: `Insurer pays ${fmt(optS.pipIncome)}/yr after AV depletes (insurer continues payment). Guaranteed for life.`, color: "#7c3aed", bg: "#f5f3ff" },
                    ].map((s) => (
                      <div key={s.step} style={{ background: s.bg, borderRadius: 6, padding: "10px 12px", borderTop: `3px solid ${s.color}` }}>
                        <div style={{ fontSize: 9, fontWeight: 800, color: s.color, letterSpacing: "0.1em", marginBottom: 4 }}>{s.step} · {s.label}</div>
                        <div style={{ fontSize: 10, color: C.textMid, lineHeight: 1.6 }}>{s.body}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right — Key metrics + trade-offs */}
                <div style={{ background: C.bg, padding: "20px 20px" }}>
                  <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.14em", color: C.accent, fontWeight: 700, marginBottom: 12 }}>Key numbers</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 16 }}>
                    {[
                      ["Annual rider fee", `${fmt(INIT_BB * riderParams.feeRate)}/yr (${pct(riderParams.feeRate)})`, C.red],
                      ["Effective fee on AV", pct(riderParams.feeRate * INIT_BB / currentAV), C.red],
                      ["Income today vs optimal", `${fmt(curS.mawpIncome)} → ${fmt(optS.mawpIncome)}`, C.accent],
                      ["Lifetime gain from waiting", `+${fmt(optS.grandTotal - curS.grandTotal)}`, C.green],
                      ["Income base step-up floor", fmt(COST_BASIS * riderParams.stepUpGuarantee), C.textMid],
                      ["Projected at yr 12", fmt(COST_BASIS * Math.pow(1 + riderParams.creditRate, riderParams.maxCreditYrs)), C.green],
                    ].map(([l, v, vc]) => (
                      <div key={l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 8px", background: C.white, borderRadius: 4 }}>
                        <span style={{ fontSize: 10, color: C.textLight }}>{l}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: vc }}>{v}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.14em", color: C.accent, fontWeight: 700, marginBottom: 8 }}>Watch out for</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {[
                      { icon: "!", label: "Extra withdrawals permanently cut income", color: C.red },
                      { icon: "!", label: `Fee is ${pct(riderParams.feeRate * INIT_BB / currentAV)} of real money, not ${pct(riderParams.feeRate)}`, color: C.red },
                      { icon: "i", label: `${riderParams.maxCreditYrs - CONTRACT_YR} years left — long-term commitment`, color: C.amber },
                      { icon: "✓", label: "Guaranteed income regardless of market", color: C.green },
                    ].map((r, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                        <div style={{ width: 15, height: 15, borderRadius: "50%", background: r.color + "18", border: `1px solid ${r.color}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                          <span style={{ fontSize: 8, fontWeight: 800, color: r.color }}>{r.icon}</span>
                        </div>
                        <span style={{ fontSize: 10, color: C.textMid, lineHeight: 1.5 }}>{r.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ══ EXPANDABLE CONTRACT & RIDER DETAILS ══ */}
              <div style={{ background: C.white, borderTop: `1px solid ${C.borderLight}` }}>
                <button onClick={() => setDetailsOpen(o => !o)}
                  style={{ width: "100%", padding: "10px 24px", background: "none", border: "none", borderBottom: detailsOpen ? `1px solid ${C.borderLight}` : "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 10, color: C.accent, fontWeight: 600 }}>
                  <span>{detailsOpen ? "▲ Hide full contract & rider details" : "▼ Show full contract & rider details"}</span>
                  <span style={{ fontSize: 9, color: C.textLight, fontWeight: 400 }}>Contract · Values · Rider · Rate tables</span>
                </button>
                {detailsOpen && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 0, borderTop: "none" }}>
                    <div style={{ padding: "14px 16px", borderRight: `1px solid ${C.borderLight}` }}>
                      <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: C.textLight, marginBottom: 10, fontWeight: 600 }}>Contract</div>
                      {[
                        ["Contract #", CONTRACT_NUM], ["Issuer", "Delaware Life Insurance Company"], ["Product", riderParams.productName],
                        ["Type", "Variable Annuity"], ["Plan", "Non-Qualified (LIFO)"], ["Issue Date", "11/01/2022"],
                        ["Contract Year", CONTRACT_YR], ["Owner Age", CURRENT_AGE],
                      ].map(([l, v]) => (
                        <div key={l} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, gap: 8 }}>
                          <span style={{ fontSize: 10, color: C.textLight, flexShrink: 0 }}>{l}</span>
                          <span style={{ fontSize: 10, color: C.text, fontWeight: 500, textAlign: "right" }}>{v}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ padding: "14px 16px", borderRight: `1px solid ${C.borderLight}` }}>
                      <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: C.textLight, marginBottom: 10, fontWeight: 600 }}>Values</div>
                      {[
                        ["Total Premium", fmt(COST_BASIS), null], ["Account Value", fmt(currentAV), C.accent],
                        ["Benefit Base", fmt(INIT_BB), C.accent], ["Unrealized Gain", fmt(currentAV - COST_BASIS), C.green],
                        ["BB Above Premium", fmt(INIT_BB - COST_BASIS), C.accent],
                        ["AV Depletes At", activeS.depletesAtAge ? `Age ${activeS.depletesAtAge}` : `>Age ${lifeExp}`, activeS.depletesAtAge ? C.red : C.green],
                      ].map(([l, v, vc]) => (
                        <div key={l} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, gap: 8 }}>
                          <span style={{ fontSize: 10, color: C.textLight, flexShrink: 0 }}>{l}</span>
                          <span style={{ fontSize: 10, color: vc || C.text, fontWeight: vc ? 600 : 500, textAlign: "right" }}>{v}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ padding: "14px 16px", borderRight: `1px solid ${C.borderLight}` }}>
                      <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: C.textLight, marginBottom: 10, fontWeight: 600 }}>
                        Rider {apiStatus === "success" && <span style={{ color: C.green }}>● API</span>}
                      </div>
                      {[
                        ["Rider", riderParams.riderName, null], ["Credit Rate", pct(riderParams.creditRate), C.accent],
                        ["Max Yrs", `${riderParams.maxCreditYrs} yrs`, null],
                        ["Step-Up", `${(riderParams.stepUpGuarantee * 100).toFixed(0)}% of premium`, C.accent],
                        ["Annual Fee", pct(riderParams.feeRate), C.red], ["Fee Amount", fmt(INIT_BB * riderParams.feeRate) + "/yr", C.red],
                        ["Life Type", "Single Life (Owner)", null], ["Spousal", "Available", C.green],
                      ].map(([l, v, vc]) => (
                        <div key={l} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, gap: 8 }}>
                          <span style={{ fontSize: 10, color: C.textLight, flexShrink: 0 }}>{l}</span>
                          <span style={{ fontSize: 10, color: vc || C.text, fontWeight: vc ? 600 : 500, textAlign: "right" }}>{v}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ padding: "14px 16px" }}>
                      <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: C.textLight, marginBottom: 10, fontWeight: 600 }}>Withdrawal Rates</div>
                      <div style={{ fontSize: 9, color: C.accent, fontWeight: 700, marginBottom: 6 }}>MAWP</div>
                      <RateTable table={riderParams.mawpTable} valueColor={C.accent} />
                      <div style={{ height: 1, background: C.borderLight, margin: "10px 0" }} />
                      <div style={{ fontSize: 9, color: C.red, fontWeight: 700, marginBottom: 6 }}>PIP</div>
                      <RateTable table={riderParams.pipTable} valueColor={C.red} />
                    </div>
                  </div>
                )}
              </div>

              {/* ══ RISK ACCORDION ══ */}
              <div style={{ background: C.white, borderTop: `1px solid ${C.borderLight}`, marginTop: 1 }}>
                <div style={{ padding: "12px 24px 8px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.borderLight}` }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.text }}>Key considerations</span>
                    <span style={{ fontSize: 10, color: C.textLight, marginLeft: 8 }}>Click any item to expand</span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[["High Risk", C.red, C.redBg], ["Moderate", C.amber, C.amberBg], ["Note", C.green, C.greenBg]].map(([l, c, bg]) => (
                      <span key={l} style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: c, background: bg, padding: "2px 8px", borderRadius: 10 }}>{l}</span>
                    ))}
                  </div>
                </div>
                <div>
                  {[
                    { id: "ov-fee", severity: "high", icon: "!", color: C.red, bg: C.redBg, title: "You're paying more in fees than you might think", summary: `The annual fee is ${pct(riderParams.feeRate)}, but it's calculated on a larger number than your actual balance — so the real cost is closer to ${pct(riderParams.feeRate * (INIT_BB / currentAV))} of what you actually have`, detail: `Think of it this way: the insurance company calculates their fee based on your "income number" (${fmt(INIT_BB)}) — not the real money in your account (${fmt(currentAV)}). Since your income number is larger, the fee takes a bigger bite out of your actual balance than the stated rate suggests. The true cost today is closer to ${pct(riderParams.feeRate * (INIT_BB / currentAV))} of your real money. Over time, this causes your account balance to shrink faster.`, metric: `True fee: ${pct(riderParams.feeRate * (INIT_BB / currentAV))}` },
                    { id: "ov-credits", severity: "high", icon: "!", color: C.red, bg: C.redBg, title: `The ${pct(riderParams.creditRate)} growth is not real money you can take out`, summary: "It only determines how much income you'll get — you can't withdraw it, leave it to family, or get it back if you cancel", detail: `Every year your "income number" grows by ${pct(riderParams.creditRate)}. This is not money you can access. It's a scoring system — the higher it is, the bigger your monthly income check. You can't cash it out or leave it to heirs. By the time you're ready for income, your income number will be ${fmt(activeS.bb)}, but the actual cash will be ${fmt(activeS.avAtActivation)} — a difference of ${fmt(activeS.bb - activeS.avAtActivation)} that only exists on paper.`, metric: `Paper vs cash gap: ${fmt(activeS.bb - activeS.avAtActivation)}` },
                    { id: "ov-timing", severity: "high", icon: "!", color: C.red, bg: C.redBg, title: "When you turn on income matters — a lot", summary: `Turning it on today instead of waiting until age ${optAge} would cost you ${fmt(optS.grandTotal - curS.grandTotal)} over your lifetime`, detail: `This contract works like a fruit tree — the longer you wait to pick, the more fruit there is, up to a point. The sweet spot is around age ${optAge}. Turning income on before then locks in a smaller check for life. The difference between now and the right time is ${fmt(optS.grandTotal - curS.grandTotal)} in total lifetime income.`, metric: `Amount at stake: ${fmt(optS.grandTotal - curS.grandTotal)}` },
                    { id: "ov-pip", severity: "high", icon: "!", color: C.red, bg: C.redBg, title: "Your income checks will be taxed more heavily later in life", summary: activeS.depletesAtAge ? `Around age ${activeS.depletesAtAge} your account runs to zero — after that, every dollar of income is fully taxable` : "Your account stays positive at current projections — but lower returns could change this", detail: activeS.depletesAtAge ? `While there's still money in your account, part of your income check is a tax-free return of what you paid in. But around age ${activeS.depletesAtAge}, the account runs out. After that, every dollar is 100% taxable. At your ${taxRate}% tax rate that's an extra ${fmt(activeS.pipIncome * taxRate / 100)} per year arriving right when you're least able to plan around it.` : `At ${growthRate}% growth your account is projected to last your lifetime. But at 2–3% returns it could deplete sooner and your income would become fully taxable earlier.`, metric: activeS.depletesAtAge ? `Extra taxes after age ${activeS.depletesAtAge}: ${fmt(activeS.pipIncome * taxRate / 100)}/yr` : "No depletion at current projections" },
                    { id: "ov-surrender", severity: "high", icon: "!", color: C.red, bg: C.redBg, title: "This money is locked up — you can't easily get it back", summary: `You have ${riderParams.maxCreditYrs - CONTRACT_YR} more years before the income feature is fully built up — leaving early means losing what you've built`, detail: `Think of this as a savings bond with two timers running at once. Exit fees apply for leaving too soon. Your income benefit keeps growing for ${riderParams.maxCreditYrs} years — you're currently in year ${CONTRACT_YR}. If you needed to walk away today you'd lose both exit fees AND the extra ${fmt(INIT_BB - COST_BASIS)} in income-earning power you've already built.`, metric: `Built-up income value at risk: ${fmt(INIT_BB - COST_BASIS)}` },
                    { id: "ov-excess", severity: "high", icon: "!", color: C.red, bg: C.redBg, title: "Taking out extra money permanently shrinks your future income", summary: "You have a set allowed withdrawal each year — taking more cuts your guaranteed income check forever", detail: `Once income is on, you can take exactly your guaranteed amount each year. If you ever take more — even once — the insurance company permanently reduces your income forward. A one-time extra $10,000 would cut your annual income by about ${fmt(activeS.mawpIncome * 10000 / currentAV)} every year for life.`, metric: `Permanent cut per $10k extra: ${fmt(activeS.mawpIncome * 10000 / currentAV)}/yr` },
                    { id: "ov-stepup", severity: "medium", icon: "i", color: C.amber, bg: C.amberBg, title: "The 'double your money' guarantee is a safety net, not a bonus", summary: `Your income number is already on track to exceed that floor — the guarantee only kicks in if things go badly wrong`, detail: `The contract promises at least ${fmt(COST_BASIS * riderParams.stepUpGuarantee)} by year ${riderParams.maxCreditYrs}. But at ${pct(riderParams.creditRate)} growth you're projected to reach ${fmt(COST_BASIS * Math.pow(1 + riderParams.creditRate, riderParams.maxCreditYrs))} — well above the floor. The guarantee is a safety net, not the reason to own this.`, metric: `Projected: ${fmt(COST_BASIS * Math.pow(1 + riderParams.creditRate, riderParams.maxCreditYrs))} vs floor: ${fmt(COST_BASIS * riderParams.stepUpGuarantee)}` },
                    { id: "ov-carrier", severity: "low", icon: "✓", color: C.green, bg: C.greenBg, title: "Your income depends on the insurance company staying in business", summary: "Delaware Life Insurance Company is a large, established company — but the guarantee is theirs, not the government's", detail: `When your account runs out, Delaware Life pays your income from their own reserves — potentially for 15–20 years. They're one of the largest U.S. insurers with 100+ years of history. Your state also provides a backstop up to $250k–$500k. Very low risk, but worth knowing it differs from FDIC-insured deposits.`, metric: "State protection backstop: $250k–$500k" },
                  ].map((p) => {
                    const open = !!openCards[p.id];
                    return (
                      <div key={p.id} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                        <button onClick={() => setOpenCards(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                          style={{ width: "100%", background: open ? p.bg : "none", border: "none", cursor: "pointer", padding: "9px 24px", display: "flex", alignItems: "center", gap: 12, textAlign: "left", transition: "background 0.15s" }}>
                          <div style={{ width: 20, height: 20, borderRadius: "50%", background: p.bg, border: `1.5px solid ${p.color}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <span style={{ fontSize: 9, fontWeight: 800, color: p.color }}>{p.icon}</span>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: C.text }}>{p.title}</span>
                              <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: p.color, background: p.bg, padding: "1px 6px", borderRadius: 10, border: `1px solid ${p.color}33`, flexShrink: 0 }}>{p.severity === "high" ? "High Risk" : p.severity === "medium" ? "Moderate" : "Note"}</span>
                            </div>
                            <div style={{ fontSize: 10, color: C.textMid, marginTop: 2, lineHeight: 1.4 }}>{p.summary}</div>
                          </div>
                          <div style={{ flexShrink: 0, textAlign: "right", minWidth: 120 }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: p.color }}>{p.metric}</div>
                            <div style={{ fontSize: 8, color: C.textLight, marginTop: 2 }}>{open ? "▲ less" : "▼ more"}</div>
                          </div>
                        </button>
                        {open && (
                          <div style={{ padding: "8px 24px 12px 56px", background: p.bg }}>
                            <p style={{ fontSize: 11, color: C.textMid, lineHeight: 1.75, margin: 0 }}>{p.detail}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div style={{ padding: "10px 24px", background: "#f0f7ff", borderTop: `1px solid ${C.borderLight}` }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: C.accent }}>Bottom line · </span>
                  <span style={{ fontSize: 10, color: C.textMid }}>None of these are reasons to walk away — they are simply things every owner of this contract should understand. This product works best for people who have other savings they can access if needed, plan to hold for the long term, and want a guaranteed income stream they can't outlive.</span>
                </div>
              </div>

            </div>
            );
          })()}

          {/* ═══ INCOME PROJECTION TAB ═══ */}
          {activeTab === "income" && (
            <div className="fade-in">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
                {[
                  ["Activation Age", `Age ${activeAge}`, C.accent],
                  ["Annual GLWB Income", fmt(activeS.mawpIncome), C.green],
                  ["AV Depletes", activeS.depletesAtAge ? `Age ${activeS.depletesAtAge}` : "Never", activeS.depletesAtAge ? C.red : C.green],
                  ["Total Lifetime Income", fmt(activeS.grandTotal), C.accent],
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
                        <Bar dataKey="mawp" stackId="a" name="MAWP">{scenarioData.map((d, i) => <Cell key={i} fill={d.isOpt ? C.green : d.isModelOpt ? C.chartGreen : "#c6e6d0"} />)}</Bar>
                        <Bar dataKey="pip" stackId="a" name="Insurer Pays" radius={[2, 2, 0, 0]}>{scenarioData.map((d, i) => <Cell key={i} fill={d.isOpt ? C.red : d.isModelOpt ? C.chartRed : "#fecaca"} />)}</Bar>
                        <ReferenceLine x={optAge} stroke={C.accent} strokeDasharray="3 3" strokeWidth={1} label={{ value: "Model Opt", position: "top", fill: C.accent, fontSize: 8 }} />
                        {isOverridden && <ReferenceLine x={activeAge} stroke="#92400e" strokeDasharray="3 3" strokeWidth={2} label={{ value: "Selected", position: "top", fill: "#92400e", fontSize: 8 }} />}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <Card>
                  <CardHeader title="Annual Income & Account Value" subtitle={`From activation age ${activeAge}${isOverridden ? " (custom)" : " (optimal)"} · ${growthRate}% growth assumption`} />
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
                        <Area type="stepAfter" dataKey="pip" name="Insurer Pays" stroke={C.chartRed} fill="none" strokeWidth={1.5} strokeDasharray="4 2" />
                        {activeS.depletesAtAge && <ReferenceLine x={activeS.depletesAtAge} stroke={C.chartRed} strokeDasharray="4 2" label={{ value: "AV Depletes", position: "insideTopRight", fill: C.red, fontSize: 9 }} />}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              <Card>
                <CardHeader
                  title="Post-Activation Detail"
                  subtitle={`Activation at age ${activeAge}${isOverridden ? " (custom)" : " (optimal)"} · year-by-year`}
                />
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: C.bg }}>
                        {[
                          { h: "Age",            align: "left"  },
                          { h: "Account Value",  align: "right" },
                          { h: "Phase",          align: "center"},
                          { h: "Annual Income",  align: "right" },
                          { h: "Cumulative",     align: "right" },
                        ].map(({ h, align }) => (
                          <th key={h} style={{ padding: "7px 12px", textAlign: align, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textLight, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activePostAct.map((r, i) => {
                        const isPIP = r.phase === "Insurer Pays";
                        return (
                          <tr key={r.age} className="row-hover" style={{ borderBottom: `1px solid ${C.borderLight}`, background: isPIP ? "#fef9f9" : i % 2 === 0 ? C.white : "#fafbfc" }}>
                            <td style={{ padding: "6px 12px", textAlign: "left",   color: C.text, fontWeight: 600 }}>{r.age}</td>
                            <td style={{ padding: "6px 12px", textAlign: "right",  color: r.av > 0 ? C.accent : C.textLight, fontWeight: 500 }}>{r.av > 0 ? fmt(r.av) : <span style={{ fontSize: 9, color: C.textLight }}>Depleted</span>}</td>
                            <td style={{ padding: "6px 12px", textAlign: "center" }}><Pill phase={r.phase} /></td>
                            <td style={{ padding: "6px 12px", textAlign: "right",  color: isPIP ? C.red : C.green, fontWeight: 600 }}>{fmt(r.income)}</td>
                            <td style={{ padding: "6px 12px", textAlign: "right",  color: C.accent, fontWeight: 600 }}>{fmt(r.cumIncome)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: C.accentLight, borderTop: `2px solid ${C.border}` }}>
                        <td colSpan={3} style={{ padding: "7px 12px", fontSize: 10, fontWeight: 700, color: C.text, textAlign: "left" }}>Lifetime Total</td>
                        <td style={{ padding: "7px 12px", textAlign: "right", fontSize: 10, fontWeight: 700, color: C.green }}>{fmt(activeS.grandTotal)}</td>
                        <td style={{ padding: "7px 12px", textAlign: "right", fontSize: 10, fontWeight: 700, color: C.accent }}>{fmt(activeS.grandTotal)}</td>
                      </tr>
                    </tfoot>
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
                          {scenarioData.map((d, i) => <Cell key={i} fill={d.isOpt ? C.accent : d.isModelOpt ? C.chartBlue : "#c3d8f0"} />)}
                        </Bar>
                        <ReferenceLine x={optAge} stroke={C.accent} strokeDasharray="3 3" label={{ value: `Model Opt · ${optAge}`, position: "top", fill: C.accent, fontSize: 8 }} />
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
                        {["Activation Age", "Benefit Base", "GLWB Rate", "Annual Income", "AV at Act.", "AV Depletes", "Grand Total", "vs. Optimal"].map(h => (
                          <th key={h} style={{ padding: "7px 10px", textAlign: "right", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.07em", color: C.textLight, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {scenarios.map((s, i) => {
                        const isOpt = s.activateAtAge === activeAge;
                        const isModelOpt = s.activateAtAge === optAge;
                        const diff = s.grandTotal - activeS.grandTotal;
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
                <strong>Non-Qualified LIFO Treatment:</strong> Funded with {fmt(COST_BASIS)} after-tax dollars. Under IRS LIFO rules, withdrawals are treated as earnings first (100% taxable) until gains are exhausted, then as tax-free return of basis.
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 14 }}>
                {[
                  ["Cost Basis", fmt(COST_BASIS), C.text],
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
                  <CardHeader title="Annuity vs. Taxable Account" subtitle={`Cumulative after-tax · ${fmt(COST_BASIS)} starting investment`} />
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
                <CardHeader title="Year-by-Year LIFO Tax Schedule" subtitle={`Non-qualified GLWB · ${fmt(COST_BASIS)} cost basis · ${taxRate}% marginal rate`} />
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
                        {["Age", "Benefit Base", "GLWB Rate", "Income/yr", "AV at Act.", "AV Depletes", "Grand Total", "vs Optimal"].map(h => (
                          <th key={h} style={{ padding: "7px 10px", textAlign: "right", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.07em", color: C.textLight, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {scenarios.map((s, i) => {
                        const isOpt = s.activateAtAge === activeAge, isModelOpt = s.activateAtAge === optAge, diff = s.grandTotal - activeS.grandTotal;
                        return (
                          <tr key={s.activateAtAge} className="row-hover" style={{ borderBottom: `1px solid ${C.borderLight}`, background: isOpt ? C.accentLight : i % 2 === 0 ? C.white : "#fafbfc" }}>
                            <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: isOpt ? 700 : 400, color: isOpt ? C.accent : C.text }}>{s.activateAtAge} {isOpt && <Badge>OPT</Badge>}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: C.textMid }}>{fmt(s.bb)}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: C.textMid }}>{pct(s.mawpRate)}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: isOpt ? 600 : 400, color: isOpt ? C.green : C.textMid }}>{fmt(s.mawpIncome)}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: C.textMid }}>{fmt(s.avAtActivation)}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: C.textMid }}>{s.depletesAtAge ? `Age ${s.depletesAtAge}` : `>${lifeExp}`}</td>
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


          {/* ═══ RIDER ANALYSIS TAB ═══ */}
          {activeTab === "risks" && (() => {
            // ── Data for visualizations ──
            const feeStated   = riderParams.feeRate;
            const feeEffective = riderParams.feeRate * (INIT_BB / currentAV);

            // BB vs AV divergence over time (pre-activation accumulation)
            const divergenceData = model.preActRows.map(r => ({
              age: r.age,
              realMoney: Math.round(r.avEOY),
              incomeNumber: Math.round(r.bbEOY),
              gap: Math.round(r.bbEOY - r.avEOY),
            }));

            // Activation timing — income by age
            const timingData = scenarios
              .filter(s => s.activateAtAge >= CURRENT_AGE && s.activateAtAge <= Math.min(78, lifeExp - 10))
              .map(s => ({
                age: s.activateAtAge,
                income: Math.round(s.grandTotal),
                annual: Math.round(s.mawpIncome),
                isOpt: s.activateAtAge === optAge,
                isCurrent: s.activateAtAge === CURRENT_AGE,
              }));

            // Tax exposure — use actual LIFO yearByYear data from the tax model
            // lifoTax is indexed from optAge; offset if activeAge differs
            const lifoOffset = Math.max(0, activeAge - optAge);
            const taxPhaseData = lifoTax.yearByYear
              .slice(lifoOffset)
              .map(r => ({
                age: r.age,
                taxable:   Math.round(r.taxablePortion),
                taxFree:   Math.round(r.taxFreePortion),
                lifoPhase: r.lifoPhase,
              }));

            // Derive phase boundary ages for reference lines and phase summary
            const gainYears    = taxPhaseData.filter(r => r.lifoPhase === "GAIN").length;
            const basisYears   = taxPhaseData.filter(r => r.lifoPhase === "BASIS").length;
            const basisStartAge    = taxPhaseData.find(r => r.lifoPhase === "BASIS")?.age;
            const lifoPhaseAge     = taxPhaseData.find(r => r.lifoPhase === "FULLY_TAXABLE")?.age;

            // Fee drag: AV with fee vs without fee over 10 years
            const feeDragData = (() => {
              let avFee = currentAV, avNoFee = currentAV; const rows = [];
              for (let y = 0; y <= 10; y++) {
                rows.push({ year: y + CONTRACT_YR, withFee: Math.round(avFee), noFee: Math.round(avNoFee) });
                avFee   = avFee   * (1 + growthRate/100) - INIT_BB * feeStated;
                avNoFee = avNoFee * (1 + growthRate/100);
              }
              return rows;
            })();

            // Excess withdrawal impact
            const excessSteps = [5000, 10000, 25000, 50000];
            const excessData = excessSteps.map(amt => ({
              label: `$${amt/1000}k`,
              incomecut: Math.round(activeS.mawpIncome * amt / currentAV),
              lifetimecut: Math.round(activeS.mawpIncome * amt / currentAV * (lifeExp - activeAge)),
            }));

            // Section state
            const toggleSec = id => setOpenSec(p => ({ ...p, [id]: !p[id] }));

            const SectionCard = ({ id, severity, children, chart, title, summary, metric, metricSub }) => {
              const cfgMap = {
                positive: { color: C.green,  bg: C.greenBg, border: "#86efac", label: "Strength"     },
                high:     { color: C.red,    bg: C.redBg,   border: "#fca5a5", label: "Watch Out"    },
                medium:   { color: C.amber,  bg: C.amberBg, border: "#fcd34d", label: "Good to Know" },
                low:      { color: C.green,  bg: C.greenBg, border: "#86efac", label: "Low Risk"     },
              };
              const cfg = cfgMap[severity];
              const open = !!openSec[id];
              return (
                <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 12, overflow: "hidden" }}>
                  {/* Colored top accent */}
                  <div style={{ height: 3, background: cfg.color, opacity: severity === "low" ? 0.4 : severity === "medium" ? 0.7 : 1 }} />
                  <div style={{ padding: "14px 16px 12px" }}>
                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: cfg.color, background: cfg.bg, padding: "2px 7px", borderRadius: 10, border: `1px solid ${cfg.border}` }}>{cfg.label}</span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.3, marginBottom: 4 }}>{title}</div>
                        <div style={{ fontSize: 11, color: C.textMid, lineHeight: 1.5 }}>{summary}</div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
                        <div className="display-font" style={{ fontSize: 20, fontWeight: 400, color: cfg.color, lineHeight: 1 }}>{metric}</div>
                        {metricSub && <div style={{ fontSize: 9, color: C.textLight, marginTop: 2 }}>{metricSub}</div>}
                      </div>
                    </div>
                    {/* Chart */}
                    <div style={{ margin: "0 -16px", borderTop: `1px solid ${C.borderLight}`, borderBottom: `1px solid ${C.borderLight}`, padding: "12px 16px", background: C.bg }}>
                      {chart}
                    </div>
                    {/* Expand toggle */}
                    <button onClick={() => toggleSec(id)} style={{ marginTop: 10, background: "none", border: "none", cursor: "pointer", fontSize: 10, color: C.accent, display: "flex", alignItems: "center", gap: 4, padding: 0 }}>
                      {open ? "▲ Less detail" : "▼ Explain this to me"}
                    </button>
                    {open && (
                      <div style={{ marginTop: 10, padding: "10px 14px", background: cfg.bg, borderRadius: 6, fontSize: 11, color: C.textMid, lineHeight: 1.75, borderLeft: `3px solid ${cfg.color}` }}>
                        {children}
                      </div>
                    )}
                  </div>
                </div>
              );
            };

            return (
              <div className="fade-in" style={{ padding: 0 }}>
                {/* Full-width page header */}
                <div style={{ background: C.navy, padding: "20px 32px 18px", borderBottom: `1px solid ${C.navyLight}` }}>
                  <div style={{ fontSize: 10, color: "#8896a8", marginBottom: 4, letterSpacing: "0.08em" }}>
                    {riderParams.productName} · {riderParams.riderName} · Non-Qualified
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
                    <div>
                      <h1 className="display-font" style={{ fontSize: 26, fontWeight: 400, color: "#ffffff", margin: 0, lineHeight: 1.2 }}>Things to Be Aware Of</h1>
                      <div style={{ fontSize: 12, color: "#8896a8", marginTop: 4 }}>What this contract does well — and what every owner needs to understand clearly</div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {[["3 Strengths", C.green, C.greenBg], ["4 Watch Out", C.red, C.redBg], ["2 Good to Know", "#d97706", C.amberBg]].map(([l, c, bg]) => (
                        <span key={l} style={{ fontSize: 10, fontWeight: 600, color: c, background: bg, padding: "4px 10px", borderRadius: 12, border: `1px solid ${c}22` }}>{l}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ padding: "24px 32px" }}>

                {/* ── Summary row ── */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 24 }}>
                  {[
                    { label: "Guaranteed For Life", value: fmt(activeS.mawpIncome) + "/yr", color: C.green, bg: C.greenBg, icon: "✓" },
                    { label: "Income Credit Rate", value: pct(riderParams.creditRate) + "/yr", color: C.green, bg: C.greenBg, icon: "✓" },
                    { label: "Income Built So Far", value: fmt(INIT_BB - COST_BASIS), color: C.green, bg: C.greenBg, icon: "✓" },
                    { label: "True Fee on Balance", value: pct(feeEffective), color: C.red, bg: C.redBg, icon: "!" },
                    { label: "Income at Stake (Timing)", value: fmt(optS.grandTotal - curS.grandTotal), color: C.amber, bg: C.amberBg, icon: "!" },
                    { label: "Years Remaining Locked", value: `${riderParams.maxCreditYrs - CONTRACT_YR} yrs`, color: C.accent, bg: C.accentLight, icon: "i" },
                  ].map((m, i) => (
                    <div key={i} style={{ background: m.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 2 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: m.color, background: "white", borderRadius: "50%", width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, border: `1px solid ${m.color}` }}>{m.icon}</span>
                        <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: C.textLight }}>{m.label}</div>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: m.color }}>{m.value}</div>
                    </div>
                  ))}
                </div>

                {/* ════ STRENGTHS SECTION ════ */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 4, height: 20, background: C.green, borderRadius: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>What this contract does well</div>
                    <div style={{ fontSize: 10, color: C.textLight, marginTop: 1 }}>Genuine strengths worth knowing — not just sales points</div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginBottom: 28 }}>

                {/* ── Positive 1: Guaranteed Income for Life ── */}
                <SectionCard id="pro-guarantee" severity="positive"
                  title="Income you genuinely cannot outlive"
                  summary={`Even if the account hits zero, ${fmt(activeS.pipIncome)}/yr keeps coming from the insurance company for the rest of your life. That guarantee is unconditional.`}
                  metric={fmt(activeS.pipIncome) + "/yr"}
                  metricSub="guaranteed even after account depletes"
                  chart={
                    <div>
                      <div style={{ fontSize: 9, color: C.textLight, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Income continues regardless of account balance</div>
                      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 9, color: C.textLight, marginBottom: 4 }}>While account has money</div>
                          <div style={{ height: 60, background: `linear-gradient(135deg, ${C.chartGreen}22, ${C.chartGreen}44)`, border: `2px solid ${C.chartGreen}`, borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                            <div style={{ fontSize: 16, fontWeight: 700, color: C.chartGreen }}>{fmt(activeS.mawpIncome)}</div>
                            <div style={{ fontSize: 9, color: C.textLight }}>MAWP / year</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", paddingTop: 20, color: C.textLight, fontSize: 14 }}>→</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 9, color: C.textLight, marginBottom: 4 }}>After account hits zero</div>
                          <div style={{ height: 60, background: `linear-gradient(135deg, ${C.chartBlue}22, ${C.chartBlue}44)`, border: `2px solid ${C.chartBlue}`, borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                            <div style={{ fontSize: 16, fontWeight: 700, color: C.chartBlue }}>{fmt(activeS.pipIncome)}</div>
                            <div style={{ fontSize: 9, color: C.textLight }}>PIP / year</div>
                          </div>
                        </div>
                      </div>
                      <div style={{ marginTop: 10, padding: "6px 10px", background: C.greenBg, borderRadius: 6, fontSize: 9, color: C.green, fontWeight: 600, textAlign: "center" }}>
                        Lifetime income guaranteed: {fmt(activeS.grandTotal)} (ages {activeAge}–{lifeExp})
                      </div>
                    </div>
                  }>
                  Most savings accounts and investment portfolios can eventually run dry. The whole point of this rider is that it cannot. Once you turn income on, the insurance company is contractually obligated to keep paying you — at either the MAWP or PIP rate — for the rest of your life, no matter how long that is or what happens to the markets. {activeS.depletesAtAge ? `At current projections the account depletes around age ${activeS.depletesAtAge}, after which the PIP guarantee of ${fmt(activeS.pipIncome)}/yr continues until age ${lifeExp} or beyond.` : `At current projections the account sustains through age ${lifeExp}, meaning you collect ${fmt(activeS.mawpIncome)}/yr the entire time.`} That unconditional guarantee is the core value of this product.
                </SectionCard>

                {/* ── Positive 2: Guaranteed 7% Growth ── */}
                <SectionCard id="pro-credits" severity="positive"
                  title={`Income base grows ${pct(riderParams.creditRate)}/yr — regardless of markets`}
                  summary={`While you wait, your income number grows by ${pct(riderParams.creditRate)} every year, guaranteed. Markets can crash, but the benefit base keeps climbing.`}
                  metric={fmt(activeS.bb)}
                  metricSub={`projected benefit base at age ${activeAge}`}
                  chart={
                    <div>
                      <div style={{ fontSize: 9, color: C.textLight, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Benefit base growth — guaranteed vs market-dependent AV</div>
                      <ResponsiveContainer width="100%" height={160}>
                        <AreaChart data={divergenceData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="bbGreen" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.chartGreen} stopOpacity={0.3}/><stop offset="100%" stopColor={C.chartGreen} stopOpacity={0.03}/></linearGradient>
                            <linearGradient id="avBlue2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.chartBlue} stopOpacity={0.15}/><stop offset="100%" stopColor={C.chartBlue} stopOpacity={0.02}/></linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} />
                          <XAxis dataKey="age" tick={{ fill: C.textLight, fontSize: 9 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: C.textLight, fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={fmtK} width={45} />
                          <Tooltip_ />
                          <Area type="monotone" dataKey="incomeNumber" name="Income base (guaranteed)" stroke={C.chartGreen} fill="url(#bbGreen)" strokeWidth={2} dot={false} />
                          <Area type="monotone" dataKey="realMoney" name="Account value (market-based)" stroke={C.chartBlue} fill="url(#avBlue2)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  }>
                  One of the genuinely compelling aspects of this rider is that your income number grows at a fixed {pct(riderParams.creditRate)} per year — no matter what stocks, bonds, or interest rates do. In a year when markets drop 20%, your benefit base still goes up by {pct(riderParams.creditRate)}. That predictability makes the income calculation immune to sequence-of-returns risk during the accumulation phase. The solid green line in the chart grows on a reliable upward slope while the dashed blue line (your actual account value) varies with investment performance. The income you eventually receive is based entirely on the green line — not the blue one.
                </SectionCard>

                {/* ── Positive 3: Credit Already Accumulated ── */}
                <SectionCard id="pro-accumulated" severity="positive"
                  title="You've already built meaningful income credit"
                  summary={`${CONTRACT_YR} years in, your benefit base is already ${fmt(INIT_BB)} — ${fmt(INIT_BB - COST_BASIS)} above what you put in. That credit goes to work the moment you turn income on.`}
                  metric={fmt(INIT_BB - COST_BASIS)}
                  metricSub="income credit accumulated above premium"
                  chart={
                    <div>
                      <div style={{ fontSize: 9, color: C.textLight, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>What {CONTRACT_YR} years of 7% credits built</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                        {[
                          { label: "Original premium", value: fmt(COST_BASIS), width: 65 },
                          { label: "Benefit base today", value: fmt(INIT_BB), width: 100 },
                        ].map((b, i) => (
                          <div key={i}>
                            <div style={{ fontSize: 9, color: C.textLight, marginBottom: 4 }}>{b.label}</div>
                            <div style={{ height: 36, background: C.borderLight, borderRadius: 6, overflow: "hidden", position: "relative" }}>
                              <div style={{ position: "absolute", inset: 0, width: `${b.width}%`, background: i === 0 ? "#c3d8f0" : `linear-gradient(90deg, ${C.chartGreen}, ${C.chartBlue})`, borderRadius: 6 }} />
                              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: i === 0 ? C.textMid : C.white }}>{b.value}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                        {[
                          { label: "Years elapsed", value: CONTRACT_YR, color: C.accent },
                          { label: "Credit earned", value: pct(INIT_BB / COST_BASIS - 1), color: C.chartGreen },
                          { label: "Income unlocked", value: fmt(activeS.mawpIncome) + "/yr", color: C.green },
                        ].map((s, i) => (
                          <div key={i} style={{ background: C.greenBg, borderRadius: 6, padding: "7px 10px", textAlign: "center" }}>
                            <div style={{ fontSize: 9, color: C.textLight, marginBottom: 2 }}>{s.label}</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  }>
                  It is easy to focus only on what this contract costs or constrains. It is equally important to recognize what you have already gained. In {CONTRACT_YR} years, your benefit base has grown from {fmt(COST_BASIS)} to {fmt(INIT_BB)} — a {pct(INIT_BB / COST_BASIS - 1)} increase that translates directly into the income you will receive. If you turned income on today, the contract would pay {fmt(curS.mawpIncome)}/yr for the rest of your life. Wait until the optimal age and it pays {fmt(optS.mawpIncome)}/yr. Either way, the {fmt(INIT_BB - COST_BASIS)} in credit you have built up is real — it exists in your contract and it directly determines your income check.
                </SectionCard>

                </div>

                {/* ════ WATCH OUT SECTION ════ */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 4, height: 20, background: C.red, borderRadius: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Things to watch out for</div>
                    <div style={{ fontSize: 10, color: C.textLight, marginTop: 1 }}>Not reasons to walk away — but conversations every owner should have</div>
                  </div>
                </div>

                {/* ── 2-col grid for sections ── */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 0 }}>
                <SectionCard id="fee" severity="high"
                  title="The fee costs more than it looks"
                  summary={`The stated fee is ${pct(feeStated)}, but because it's calculated on your income number (not your actual balance), it works out to ${pct(feeEffective)} of your real money today. That gap widens every year.`}
                  metric={pct(feeEffective)}
                  metricSub="true cost on your balance"
                  chart={
                    <div>
                      {/* Fee comparison bar */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                        {[
                          { label: "What the contract says", val: feeStated, color: C.chartGray },
                          { label: "What you actually pay", val: feeEffective, color: C.chartRed },
                        ].map((b, i) => (
                          <div key={i}>
                            <div style={{ fontSize: 9, color: C.textLight, marginBottom: 4 }}>{b.label}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ flex: 1, height: 20, background: C.borderLight, borderRadius: 3, overflow: "hidden" }}>
                                <div style={{ width: `${Math.min(100, b.val * 25)}%`, height: "100%", background: b.color, borderRadius: 3, transition: "width 0.6s ease" }} />
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 700, color: b.color, minWidth: 40 }}>{pct(b.val)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Fee drag chart */}
                      <div style={{ fontSize: 9, color: C.textLight, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Your account balance with fee vs. without fee</div>
                      <ResponsiveContainer width="100%" height={180}>
                        <AreaChart data={feeDragData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="noFeeG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.chartGreen} stopOpacity={0.2}/><stop offset="100%" stopColor={C.chartGreen} stopOpacity={0.02}/></linearGradient>
                            <linearGradient id="feeG"   x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.chartBlue} stopOpacity={0.15}/><stop offset="100%" stopColor={C.chartBlue} stopOpacity={0.02}/></linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} />
                          <XAxis dataKey="year" tick={{ fill: C.textLight, fontSize: 9 }} axisLine={false} tickLine={false} label={{ value: "Contract Year", position: "insideBottom", offset: -2, fill: C.textLight, fontSize: 9 }} />
                          <YAxis tick={{ fill: C.textLight, fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={fmtK} width={45} />
                          <Tooltip_ />
                          <Area type="monotone" dataKey="noFee" name="Without fee" stroke={C.chartGreen} fill="url(#noFeeG)" strokeWidth={2} dot={false} />
                          <Area type="monotone" dataKey="withFee" name="With fee" stroke={C.chartBlue} fill="url(#feeG)" strokeWidth={2} dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  }>
                  The annual fee on this contract is charged based on your "income number" — a figure the insurance company uses to calculate your future income checks. Right now your income number is {fmt(INIT_BB)}, but your actual account balance is only {fmt(currentAV)}. Because the fee is calculated on the larger number, it takes a bigger bite out of your real money than the stated rate suggests. Think of it like paying a percentage of your home's appraised value, even though you only have the mortgage balance sitting in the bank. The chart above shows how your real balance grows with the fee versus how it would grow without it — the gap compounds year after year.
                </SectionCard>

                {/* ── 2. Income Number vs Real Money ── */}
                <SectionCard id="credits" severity="medium"
                  title="Your income number and your real balance are very different things"
                  summary={`By the time you turn income on at age ${optAge}, your income number will be ${fmt(activeS.bb)} — but your actual account balance will only be ${fmt(activeS.avAtActivation)}. The difference of ${fmt(activeS.bb - activeS.avAtActivation)} exists only as a calculation.`}
                  metric={fmt(activeS.bb - activeS.avAtActivation)}
                  metricSub="paper gap at activation"
                  chart={
                    <div>
                      <div style={{ fontSize: 9, color: C.textLight, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Income number vs. real account balance — pre-retirement years</div>
                      <ResponsiveContainer width="100%" height={180}>
                        <AreaChart data={divergenceData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="bnGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.chartAmber} stopOpacity={0.2}/><stop offset="100%" stopColor={C.chartAmber} stopOpacity={0.02}/></linearGradient>
                            <linearGradient id="avGrad2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.chartBlue} stopOpacity={0.2}/><stop offset="100%" stopColor={C.chartBlue} stopOpacity={0.02}/></linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} />
                          <XAxis dataKey="age" tick={{ fill: C.textLight, fontSize: 9 }} axisLine={false} tickLine={false} label={{ value: "Your Age", position: "insideBottom", offset: -2, fill: C.textLight, fontSize: 9 }} />
                          <YAxis tick={{ fill: C.textLight, fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={fmtK} width={45} />
                          <Tooltip_ />
                          <Area type="monotone" dataKey="incomeNumber" name="Income number (paper)" stroke={C.chartAmber} fill="url(#bnGrad)" strokeWidth={2} dot={false} />
                          <Area type="monotone" dataKey="realMoney" name="Real account balance" stroke={C.chartBlue} fill="url(#avGrad2)" strokeWidth={2} dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                      <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
                        {[["Income number (paper)", C.chartAmber], ["Real account balance", C.chartBlue]].map(([l, c]) => (
                          <div key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <div style={{ width: 20, height: 2, background: c, borderRadius: 1 }} />
                            <span style={{ fontSize: 9, color: C.textLight }}>{l}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  }>
                  Every year this contract is in force, your "income number" grows by {pct(riderParams.creditRate)}. This is the number the insurance company uses to calculate how big your monthly income check will be. But it is not money sitting in an account. Think of it as a score — the higher the score, the bigger the check. You cannot cash out this score, leave it to your family, or get it back if you exit the contract. The chart shows the growing gap between the two lines. The amber line is the number the insurance company will use to calculate your income. The blue line is what would actually be left if you surrendered the contract. The gap between them is real money that exists only on paper.
                </SectionCard>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 0 }}>
                {/* ── 3. Timing Sweet Spot ── */}
                <SectionCard id="timing" severity="high"
                  title="There's a right time to flip the switch — and a wrong time"
                  summary={`Turning income on at age ${optAge} generates ${fmt(optS.grandTotal)} over your lifetime. Turning it on today generates ${fmt(curS.grandTotal)} — a difference of ${fmt(optS.grandTotal - curS.grandTotal)}.`}
                  metric={fmt(optS.grandTotal - curS.grandTotal)}
                  metricSub="at stake based on timing"
                  chart={
                    <div>
                      <div style={{ fontSize: 9, color: C.textLight, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Total lifetime income by the age you turn income on</div>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={timingData} barCategoryGap="12%" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} vertical={false} />
                          <XAxis dataKey="age" tick={{ fill: C.textLight, fontSize: 9 }} axisLine={false} tickLine={false} label={{ value: "Age you turn income on", position: "insideBottom", offset: -2, fill: C.textLight, fontSize: 9 }} />
                          <YAxis tick={{ fill: C.textLight, fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={fmtK} width={45} />
                          <Tooltip_ />
                          <Bar dataKey="income" name="Lifetime income" radius={[3,3,0,0]}>
                            {timingData.map((d, i) => (
                              <Cell key={i} fill={d.isOpt ? C.chartGreen : d.isCurrent ? C.chartRed : "#c3d8f0"} />
                            ))}
                          </Bar>
                          <ReferenceLine x={optAge} stroke={C.chartGreen} strokeDasharray="4 3" label={{ value: `Best age: ${optAge}`, position: "top", fill: C.chartGreen, fontSize: 9, fontWeight: 600 }} />
                          {CURRENT_AGE !== optAge && <ReferenceLine x={CURRENT_AGE} stroke={C.chartRed} strokeDasharray="4 3" label={{ value: "Today", position: "top", fill: C.chartRed, fontSize: 9 }} />}
                        </BarChart>
                      </ResponsiveContainer>
                      <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
                        {[["Best age (green)", C.chartGreen], ["If you started today (red)", C.chartRed], ["Other ages", "#c3d8f0"]].map(([l,c]) => (
                          <div key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
                            <span style={{ fontSize: 9, color: C.textLight }}>{l}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  }>
                  This contract is built so that waiting to turn on income — up to a point — means a larger check for the rest of your life. Two things happen while you wait: your income number keeps growing by {pct(riderParams.creditRate)} per year, and you also move into a higher age band that pays a higher percentage. The chart shows total lifetime income for every possible starting age. The green bar at age {optAge} is the peak — that's where the math works best. The red bar shows what you'd collect if you started today. The difference between those two bars is {fmt(optS.grandTotal - curS.grandTotal)} in lifetime income. Past age {optAge + 3} or so, waiting further starts to cost you because there are fewer years left to collect.
                </SectionCard>

                {/* ── 4. Tax Timeline ── */}
                <SectionCard id="tax"
                  severity="medium"
                  title="Your income is taxed in three distinct phases — gains first, then your own money back, then taxable again"
                  summary={`Under LIFO rules, your gains come out first (all taxable). ${basisStartAge ? `Around age ${basisStartAge} your original investment starts returning tax-free.` : ""} ${lifoPhaseAge ? `Around age ${lifoPhaseAge} all basis is exhausted and income becomes fully taxable again.` : "At current projections your basis outlasts your income horizon."}`}
                  metric={basisStartAge ? `Age ${basisStartAge}` : "N/A"}
                  metricSub="tax-free phase begins"
                  chart={
                    <div>
                      <div style={{ fontSize: 9, color: C.textLight, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>LIFO tax treatment per year — taxable (red) vs tax-free basis return (green)</div>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={taxPhaseData} barCategoryGap="4%" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} vertical={false} />
                          <XAxis dataKey="age" tick={{ fill: C.textLight, fontSize: 9 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: C.textLight, fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={fmtK} width={45} />
                          <Tooltip_ />
                          <Bar dataKey="taxable" stackId="t" name="Taxable (gains / PIP)" fill={C.chartRed} />
                          <Bar dataKey="taxFree"  stackId="t" name="Tax-free (basis return)" fill={C.chartGreen} radius={[2,2,0,0]} />
                          {basisStartAge && <ReferenceLine x={basisStartAge} stroke={C.chartGreen} strokeDasharray="4 3" label={{ value: "Basis starts", position: "top", fill: C.chartGreen, fontSize: 9 }} />}
                          {lifoPhaseAge  && <ReferenceLine x={lifoPhaseAge}  stroke={C.chartRed}   strokeDasharray="4 3" label={{ value: "Fully taxable", position: "top", fill: C.chartRed,   fontSize: 9 }} />}
                        </BarChart>
                      </ResponsiveContainer>
                      <div style={{ display: "flex", gap: 20, marginTop: 8 }}>
                        {[["Taxable (gains then PIP)", C.chartRed], ["Tax-free (return of basis)", C.chartGreen]].map(([l,c]) => (
                          <div key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
                            <span style={{ fontSize: 9, color: C.textLight }}>{l}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 10 }}>
                        {[
                          { label: "Phase 1 · Gains first", desc: `${gainYears} yrs · fully taxable`, color: C.red, bg: C.redBg },
                          { label: "Phase 2 · Basis return", desc: basisStartAge ? `Age ${basisStartAge} · ${basisYears} yrs tax-free` : "N/A in projection", color: C.green, bg: C.greenBg },
                          { label: "Phase 3 · Fully taxable", desc: lifoPhaseAge ? `Starts age ${lifoPhaseAge}` : "Not reached in projection", color: C.amber, bg: C.amberBg },
                        ].map((p, i) => (
                          <div key={i} style={{ background: p.bg, borderRadius: 6, padding: "8px 10px" }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: p.color, marginBottom: 2 }}>{p.label}</div>
                            <div style={{ fontSize: 10, color: C.textMid }}>{p.desc}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  }>
                  Under LIFO (Last In, First Out) rules — which apply to non-qualified annuities like this one — your most recent earnings come out of the contract first, before your original investment. This means the early years of income are actually the most heavily taxed. Here is how the three phases play out: first, every withdrawal is treated as coming from gains and is fully taxable at your {taxRate}% rate. This continues for {gainYears} years. Then, once all the accumulated gains have been paid out, your original after-tax investment starts coming back — that portion is tax-free because you already paid taxes on it when you earned it. {basisStartAge ? `This more favorable phase starts around age ${basisStartAge} and runs for about ${basisYears} years.` : ""} {lifoPhaseAge ? `Around age ${lifoPhaseAge}, your full original investment has been returned. After that, every dollar — whether from the remaining contract value or from PIP payments — is fully taxable again.` : "Based on current projections, your original investment outlasts your income horizon, meaning you will have tax-free income in your later years."}
                </SectionCard>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
                {/* ── 5. Lockout Timeline ── */}
                <SectionCard id="lockout" severity="high"
                  title="This is long-term money — you have years left where leaving is expensive"
                  summary={`You are in contract year ${CONTRACT_YR} of ${riderParams.maxCreditYrs}. You have ${riderParams.maxCreditYrs - CONTRACT_YR} years left in the income-building phase. Exiting now means losing the ${fmt(INIT_BB - COST_BASIS)} in extra income value you have already built up.`}
                  metric={`${riderParams.maxCreditYrs - CONTRACT_YR} yrs left`}
                  metricSub="in income-building phase"
                  chart={
                    <div>
                      <div style={{ fontSize: 9, color: C.textLight, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Where you are in the contract timeline</div>
                      {/* Progress bar timeline */}
                      <div style={{ position: "relative", height: 48 }}>
                        {/* Background track */}
                        <div style={{ position: "absolute", top: 16, left: 0, right: 0, height: 16, background: C.borderLight, borderRadius: 8 }} />
                        {/* Completed portion */}
                        <div style={{ position: "absolute", top: 16, left: 0, width: `${(CONTRACT_YR / riderParams.maxCreditYrs) * 100}%`, height: 16, background: `linear-gradient(90deg, ${C.chartGreen}, ${C.chartBlue})`, borderRadius: "8px 0 0 8px", transition: "width 0.8s ease" }} />
                        {/* Remaining portion */}
                        <div style={{ position: "absolute", top: 16, left: `${(CONTRACT_YR / riderParams.maxCreditYrs) * 100}%`, right: 0, height: 16, background: C.amberBg, border: `1px solid #fcd34d`, borderRadius: "0 8px 8px 0" }} />
                        {/* Year marker pin */}
                        <div style={{ position: "absolute", top: 8, left: `${(CONTRACT_YR / riderParams.maxCreditYrs) * 100}%`, transform: "translateX(-50%)", width: 2, height: 32, background: C.amber, zIndex: 2 }} />
                        {/* Labels */}
                        <div style={{ position: "absolute", top: 36, left: 0, fontSize: 9, color: C.textLight }}>Year 1</div>
                        <div style={{ position: "absolute", top: 36, left: `${(CONTRACT_YR / riderParams.maxCreditYrs) * 100}%`, transform: "translateX(-50%)", fontSize: 9, color: C.amber, fontWeight: 700 }}>Year {CONTRACT_YR} ← You are here</div>
                        <div style={{ position: "absolute", top: 36, right: 0, fontSize: 9, color: C.textLight, textAlign: "right" }}>Year {riderParams.maxCreditYrs}</div>
                      </div>
                      {/* Stats */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 14 }}>
                        {[
                          { label: "Years completed", value: CONTRACT_YR, color: C.chartGreen },
                          { label: "Years remaining", value: riderParams.maxCreditYrs - CONTRACT_YR, color: C.amber },
                          { label: "Income value built", value: fmt(INIT_BB - COST_BASIS), color: C.chartBlue },
                        ].map((s, i) => (
                          <div key={i} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 10px", textAlign: "center" }}>
                            <div style={{ fontSize: 9, color: C.textLight, marginBottom: 3 }}>{s.label}</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{s.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  }>
                  This contract has two separate timers running at once. First, there are early exit penalties (surrender charges) for leaving before a certain number of years. Second, your income number keeps growing for {riderParams.maxCreditYrs} years — and every year you stay, that number gets bigger and your future income check gets larger. You are currently in year {CONTRACT_YR}. You have {riderParams.maxCreditYrs - CONTRACT_YR} years remaining in this building phase. If something in your life changed today and you needed to exit — a health emergency, a major expense, a business need — you would not only owe exit penalties but would also permanently walk away from the {fmt(INIT_BB - COST_BASIS)} in extra income-earning value you have already accumulated above what you put in. This is why this contract should represent only money you are confident you will not need to access.
                </SectionCard>

                {/* ── 6. Excess Withdrawal Calculator ── */}
                <SectionCard id="excess" severity="high"
                  title="Taking out extra money cuts your income check for life"
                  summary={`Once income is turned on, you are allowed a specific annual amount. Every dollar above that permanently reduces your guaranteed income. Even a one-time extra $10,000 withdrawal would cut your annual income by ${fmt(activeS.mawpIncome * 10000 / currentAV)} every year forever.`}
                  metric={`${fmt(activeS.mawpIncome * 10000 / currentAV)}/yr`}
                  metricSub="lost per $10k extra taken out"
                  chart={
                    <div>
                      <div style={{ fontSize: 9, color: C.textLight, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>How much a single extra withdrawal cuts your annual income — permanently</div>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={excessData} barCategoryGap="25%" layout="vertical" margin={{ top: 0, right: 50, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} horizontal={false} />
                          <XAxis type="number" tick={{ fill: C.textLight, fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                          <YAxis type="category" dataKey="label" tick={{ fill: C.textMid, fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} width={32} />
                          <Tooltip_ />
                          <Bar dataKey="incomecut" name="Annual income cut" fill={C.chartRed} radius={[0,3,3,0]}>
                            {excessData.map((_, i) => <Cell key={i} fill={`rgba(185,28,28,${0.4 + i * 0.18})`} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  }>
                  Once you turn income on, there is a specific amount you are allowed to take each year — your guaranteed income payment. If you ever take out more than that, even just once and even for a good reason, the insurance company permanently reduces your guaranteed income. It is not a one-time penalty. It is a lifetime cut to every future check. The chart shows how much your annual income would be reduced for different sizes of extra withdrawals. If you needed an extra $25,000 one year — a home repair, medical bills, helping a family member — your annual income would be permanently reduced by {fmt(activeS.mawpIncome * 25000 / currentAV)} every single year for the rest of your life. This surprises many people who think of the account as their money to access freely once income has started.
                </SectionCard>
                </div>

                {/* ── Bottom line ── */}
                <div style={{ padding: "14px 18px", background: C.navy, borderRadius: 8, fontSize: 11, color: "#c8d4e6", lineHeight: 1.75 }}>
                  <span style={{ fontWeight: 700, color: "#ffffff" }}>The complete picture · </span>
                  This contract offers something genuinely valuable: guaranteed income for life, predictable growth on your income base, and credit you've already earned. It also carries real constraints — fees that compound, rules about withdrawals, and a timing window that matters. Understanding both sides clearly is what makes this contract work for you rather than against you.
                </div>

                </div>
              </div>
            );
          })()}
        </div>

        {/* ═══ RIGHT SIDEBAR ═══ */}
        <div style={{ background: C.white, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
          {/* Client block */}
          <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: C.textLight, marginBottom: 6 }}>Client View</div>
            <div className="display-font" style={{ fontSize: 14, fontWeight: 400, color: C.text }}>[Client Name]</div>
            <div style={{ fontSize: 10, color: C.textLight, marginTop: 2 }}>DOB [DOB] · Age {CURRENT_AGE}</div>
            <div style={{ fontSize: 10, color: C.textLight }}>Policy Date 11/01/2022</div>
          </div>

          {/* Rider / Option selector block */}
          {apiCatalog && (
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: C.textLight, marginBottom: 8 }}>Rider Selection</div>

              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9, color: C.textLight, marginBottom: 3 }}>Rider</div>
                <div style={{ position: "relative" }}>
                  <select value={selectedRider || ""} onChange={(e) => { setSelectedRider(e.target.value); setSelectedOption(apiCatalog.riders.find(r => r.name === e.target.value)?.incomeOptions[0] || null); }}
                    style={{ width: "100%", fontSize: 10, padding: "5px 8px", border: `1px solid ${C.border}`, borderRadius: 3, background: C.white, color: C.text, cursor: "pointer", outline: "none", appearance: "none", WebkitAppearance: "none" }}>
                    {apiCatalog.riders.map((r) => (
                      <option key={r.name} value={r.name}>{r.name}</option>
                    ))}
                  </select>
                  <span style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", fontSize: 8, color: C.textLight }}>▾</span>
                </div>
              </div>

              {apiCatalog.riders.find(r => r.name === selectedRider)?.incomeOptions.length > 1 && (
                <div>
                  <div style={{ fontSize: 9, color: C.textLight, marginBottom: 3 }}>Income Option</div>
                  <div style={{ position: "relative" }}>
                    <select value={selectedOption || ""} onChange={(e) => setSelectedOption(e.target.value)}
                      style={{ width: "100%", fontSize: 10, padding: "5px 8px", border: `1px solid ${C.border}`, borderRadius: 3, background: C.white, color: C.text, cursor: "pointer", outline: "none", appearance: "none", WebkitAppearance: "none" }}>
                      {apiCatalog.riders.find(r => r.name === selectedRider)?.incomeOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <span style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", fontSize: 8, color: C.textLight }}>▾</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Contract info block */}
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: C.textLight, marginBottom: 8 }}>Contract</div>
            {[
              ["Contract #", CONTRACT_NUM],
              ["Issuer", "Delaware Life Insurance Company"],
              ["Product Type", "Variable Annuity"],
              ["Rider", riderParams.riderName],
              ["Issue Effective", "11/01/2022"],
              ["Contract Year", CONTRACT_YR],
            ].map(([l, v], i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: C.textLight }}>{l}</span>
                <span style={{ fontSize: 10, color: C.text, fontWeight: 500, textAlign: "right", maxWidth: 110 }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Values block */}
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: C.textLight, marginBottom: 8 }}>Current Values</div>
            {[
              ["Total Premium", fmt(COST_BASIS), null],
              ["Account Value", fmt(currentAV), C.accent],
              ["Benefit Base", fmt(INIT_BB), C.accent],
              ["Annual Income", fmt(activeS.mawpIncome), C.green],
            ].map(([l, v, vc], i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 10, color: C.textLight }}>{l}</span>
                <span style={{ fontSize: 11, color: vc || C.text, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Assumptions block */}
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: C.textLight, marginBottom: 8 }}>Assumptions</div>
            {[
              { label: "Growth Rate", value: growthRate, set: setGrowthRate, min: 0, max: 10, step: 0.1, unit: "%" },
              { label: "Life Expectancy", value: lifeExp, set: setLifeExp, min: 75, max: 100, step: 1, unit: " yrs" },
              { label: "Tax Rate", value: taxRate, set: setTaxRate, min: 10, max: 40, step: 1, unit: "%" },
            ].map((s, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 10, color: C.textLight }}>{s.label}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: C.accent }}>{s.value}{s.unit}</span>
                </div>
                <input type="range" min={s.min} max={s.max} step={s.step} value={s.value} onChange={(e) => s.set(Number(e.target.value))} />
              </div>
            ))}
          </div>

          {/* Activation Age block */}
          <div style={{ padding: "12px 16px", background: isOverridden ? "#fffbeb" : C.accentLight, borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: isOverridden ? "#92400e" : C.accent }}>
                {isOverridden ? "Custom Activation" : "Optimal Activation"}
              </div>
              {isOverridden && (
                <button onClick={() => setSelectedAge(null)}
                  style={{ fontSize: 8, color: C.accent, background: "none", border: `1px solid ${C.accent}`, borderRadius: 3, padding: "1px 6px", cursor: "pointer", letterSpacing: "0.06em" }}>
                  Reset
                </button>
              )}
            </div>

            {/* Stepper */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <button onClick={() => setSelectedAge(Math.max(CURRENT_AGE, activeAge - 1))}
                style={{ width: 24, height: 24, borderRadius: 4, border: `1px solid ${C.border}`, background: C.white, cursor: "pointer", fontSize: 14, color: C.textMid, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>−</button>
              <div style={{ flex: 1, textAlign: "center" }}>
                <span className="display-font" style={{ fontSize: 26, fontWeight: 400, color: isOverridden ? "#92400e" : C.accent }}>Age {activeAge}</span>
              </div>
              <button onClick={() => setSelectedAge(Math.min(78, activeAge + 1))}
                style={{ width: 24, height: 24, borderRadius: 4, border: `1px solid ${C.border}`, background: C.white, cursor: "pointer", fontSize: 14, color: C.textMid, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>+</button>
            </div>

            <div style={{ fontSize: 10, color: C.textMid }}>Band {getMawpBand(activeAge, riderParams.mawpTable)} · {pct(getMawpRate(activeAge, riderParams.mawpTable))} MAWP</div>
            <div style={{ fontSize: 10, color: gain >= 0 ? C.green : C.red, fontWeight: 600, marginTop: 3 }}>
              {gain >= 0 ? "+" : ""}{fmt(gain)} vs. activating today
            </div>
            {isOverridden && (
              <div style={{ fontSize: 9, color: "#92400e", marginTop: 4, padding: "4px 6px", background: "rgba(245,158,11,0.1)", borderRadius: 3 }}>
                Model optimal: Age {optAge} (+{fmt(optS.grandTotal - activeS.grandTotal)} more)
              </div>
            )}
          </div>

          {/* Nav */}
          <nav style={{ padding: "8px 0", flex: 1 }}>
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: C.textLight, padding: "4px 16px 6px" }}>Analysis Views</div>
            {tabs.map((t) => {
              const active = activeTab === t.id;
              return (
                <button key={t.id} className="tab-btn" onClick={() => setActiveTab(t.id)}
                  style={{ width: "100%", textAlign: "left", padding: "8px 16px", background: active ? C.accentLight : "none", border: "none", borderLeft: `3px solid ${active ? C.accent : "transparent"}`, cursor: "pointer", fontSize: 11, fontWeight: active ? 600 : 400, color: active ? C.accent : C.textMid, display: "block" }}>
                  {t.label}
                </button>
              );
            })}
          </nav>
        </div>

      </div>
    </div>
  );
}
