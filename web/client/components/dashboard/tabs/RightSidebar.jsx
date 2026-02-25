import React from "react";

const SectionLabel = ({ children, C }) => (
  <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: C.textLight, marginBottom: 8 }}>
    {children}
  </div>
);

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
  activationAge,
  setActivationAge,
  currentAge,
  contractYear,
  costBasis,
  currentAV,
  initialBenefitBase,
  optimalAge,
  gain,
  optimalScenario,
  formatCurrency,
  formatPercent,
  getMawpBand,
  getMawpRate,
}) {
  const riders = apiCatalog?.riders || [];
  const selectedRiderData = riders.find((r) => r.name === selectedRider);
  const incomeOptions = selectedRiderData?.incomeOptions || [];

  const cellStyle = {
    padding: "12px 16px",
    borderRight: `1px solid ${C.border}`,
    minWidth: 0,
  };

  return (
    <div style={{
      background: C.white,
      border: `1px solid ${C.border}`,
      borderRadius: 4,
      display: "grid",
      gridTemplateColumns: `auto ${apiCatalog ? "1fr" : ""} 1fr 1fr 1fr`,
      alignItems: "stretch",
      overflow: "hidden",
    }}>

      {/* Suggested Income Activation */}
      <div style={{ ...cellStyle, background: C.accentLight, whiteSpace: "nowrap" }}>
        <SectionLabel C={C}>Suggested Activation</SectionLabel>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.accent, lineHeight: 1 }}>Age {optimalAge}</div>
        <div style={{ fontSize: 10, color: C.textMid, marginTop: 4 }}>
          Band {getMawpBand(optimalAge, riderParams.mawpTable)} · {formatPercent(getMawpRate(optimalAge, riderParams.mawpTable))} MAWP
        </div>
        <div style={{ fontSize: 10, color: C.green, fontWeight: 600, marginTop: 4 }}>
          +{formatCurrency(gain)} vs. today
        </div>
      </div>

      {/* Rider Selection */}
      {apiCatalog && (
        <div style={cellStyle}>
          <SectionLabel C={C}>Rider</SectionLabel>
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
                {riders.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
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
                  {incomeOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <span style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", fontSize: 8, color: C.textLight }}>▾</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Contract */}
      <div style={cellStyle}>
        <SectionLabel C={C}>Contract</SectionLabel>
        {[
          ["Contract #", "001399864"],
          ["Issuer", "AIG / Corebridge"],
          ["Product", "Variable Annuity"],
          ["Rider", riderParams.riderName],
          ["Issue Date", "11/01/2022"],
          ["Year", contractYear],
        ].map(([l, v], i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: C.textLight, whiteSpace: "nowrap" }}>{l}</span>
            <span style={{ fontSize: 10, color: C.text, fontWeight: 500, textAlign: "right" }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Current Values */}
      <div style={cellStyle}>
        <SectionLabel C={C}>Current Values</SectionLabel>
        {[
          ["Total Premium", formatCurrency(costBasis), null],
          ["Account Value", formatCurrency(currentAV), C.accent],
          ["Benefit Base", formatCurrency(initialBenefitBase), C.accent],
          ["Annual Income", formatCurrency(optimalScenario.mawpIncome), C.green],
        ].map(([l, v, vc], i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 5 }}>
            <span style={{ fontSize: 10, color: C.textLight, whiteSpace: "nowrap" }}>{l}</span>
            <span style={{ fontSize: 11, color: vc || C.text, fontWeight: 600 }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Assumptions */}
      <div style={{ ...cellStyle, borderRight: "none" }}>
        <SectionLabel C={C}>Assumptions</SectionLabel>
        {[
          { label: "Activation Age", value: activationAge, set: setActivationAge, min: currentAge ?? 63, max: 78, step: 1, unit: "" },
          { label: "Growth Rate", value: growthRate, set: setGrowthRate, min: 0, max: 10, step: 0.1, unit: "%" },
          { label: "Life Expectancy", value: lifeExp, set: setLifeExp, min: 75, max: 100, step: 1, unit: " yrs" },
        ].map((s, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontSize: 10, color: C.textLight }}>{s.label}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: C.accent }}>{s.value}{s.unit}</span>
            </div>
            <input
              type="range"
              min={s.min} max={s.max} step={s.step} value={s.value}
              onChange={(e) => s.set?.(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>
        ))}
      </div>

    </div>
  );
}
