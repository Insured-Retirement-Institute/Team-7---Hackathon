import React from "react";

export function RightSidebar({
  colors: C,
  apiCatalog,
  selectedRider,
  selectedOption,
  onSelectRider,
  onSelectOption,
  riderParams,
  growthRate,
  lifeExp,
  taxRate,
  setGrowthRate,
  setLifeExp,
  setTaxRate,
  contractYear,
  costBasis,
  currentAV,
  initialBenefitBase,
  optimalAge,
  gain,
  optimalScenario,
  tabs,
  activeTab,
  onTabChange,
  formatCurrency,
  formatPercent,
  getMawpBand,
  getMawpRate,
}) {
  const riders = apiCatalog?.riders || [];
  const selectedRiderData = riders.find((r) => r.name === selectedRider);
  const incomeOptions = selectedRiderData?.incomeOptions || [];

  return (
    <div style={{ background: C.white, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column", minHeight: "100%" }}>
      {/* Client block */}
      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: C.textLight, marginBottom: 6 }}>Client View</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>The Rogers Household</div>
        <div style={{ fontSize: 10, color: C.textLight, marginTop: 2 }}>DOB 11/01/1962 · Age 63</div>
        <div style={{ fontSize: 10, color: C.textLight }}>Policy Date 11/01/2022</div>
      </div>

			{/* Optimal activation */}
      <div style={{ padding: "12px 16px", background: C.accentLight, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: C.accent, marginBottom: 4 }}>Optimal Activation</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: C.accent }}>Age {optimalAge}</div>
        <div style={{ fontSize: 10, color: C.textMid, marginTop: 2 }}>Band {getMawpBand(optimalAge, riderParams.mawpTable)} · {formatPercent(getMawpRate(optimalAge, riderParams.mawpTable))} MAWP</div>
        <div style={{ fontSize: 10, color: C.green, fontWeight: 600, marginTop: 4 }}>+{formatCurrency(gain)} vs. activating today</div>
      </div>

      {/* Rider / Option selector block */}
      {apiCatalog && (
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: C.textLight, marginBottom: 8 }}>Rider Selection</div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9, color: C.textLight, marginBottom: 3 }}>Rider</div>
            <div style={{ position: "relative" }}>
              <select
                value={selectedRider || ""}
                onChange={(e) => {
                  onSelectRider?.(e.target.value);
                  const firstOption = apiCatalog.riders.find((r) => r.name === e.target.value)?.incomeOptions[0] || null;
                  onSelectOption?.(firstOption);
                }}
                style={{ width: "100%", fontSize: 10, padding: "5px 8px", border: `1px solid ${C.border}`, borderRadius: 3, background: C.white, color: C.text, cursor: "pointer", outline: "none", appearance: "none", WebkitAppearance: "none" }}
              >
                {riders.map((r) => (
                  <option key={r.name} value={r.name}>{r.name}</option>
                ))}
              </select>
              <span style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", fontSize: 8, color: C.textLight }}>▾</span>
            </div>
          </div>

          {incomeOptions.length > 1 && (
            <div>
              <div style={{ fontSize: 9, color: C.textLight, marginBottom: 3 }}>Income Option</div>
              <div style={{ position: "relative" }}>
                <select
                  value={selectedOption || ""}
                  onChange={(e) => onSelectOption?.(e.target.value)}
                  style={{ width: "100%", fontSize: 10, padding: "5px 8px", border: `1px solid ${C.border}`, borderRadius: 3, background: C.white, color: C.text, cursor: "pointer", outline: "none", appearance: "none", WebkitAppearance: "none" }}
                >
                  {incomeOptions.map((opt) => (
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
          ["Contract #", "001399864"],
          ["Issuer", "AIG / Corebridge"],
          ["Product Type", "Variable Annuity"],
          ["Rider", riderParams.riderName],
          ["Issue Effective", "11/01/2022"],
          ["Contract Year", contractYear],
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
          ["Total Premium", formatCurrency(costBasis), null],
          ["Account Value", formatCurrency(currentAV), C.accent],
          ["Benefit Base", formatCurrency(initialBenefitBase), C.accent],
          ["Annual Income", formatCurrency(optimalScenario.mawpIncome), C.green],
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
            <input type="range" min={s.min} max={s.max} step={s.step} value={s.value} onChange={(e) => s.set?.(Number(e.target.value))} />
          </div>
        ))}
      </div>

      {/* Nav */}
      {/* <nav style={{ padding: "8px 0", flex: 1 }}>
        <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: C.textLight, padding: "4px 16px 6px" }}>Analysis Views</div>
        {tabs.map((t) => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              className="tab-btn"
              onClick={() => onTabChange?.(t.id)}
              style={{ width: "100%", textAlign: "left", padding: "8px 16px", background: active ? C.accentLight : "none", border: "none", borderLeft: `3px solid ${active ? C.accent : "transparent"}`, cursor: "pointer", fontSize: 11, fontWeight: active ? 600 : 400, color: active ? C.accent : C.textMid, display: "block" }}
            >
              {t.label}
            </button>
          );
        })}
      </nav> */}
    </div>
  );
}
