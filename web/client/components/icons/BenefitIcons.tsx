import React from "react";

interface IconProps {
  size?: number;
  className?: string;
}

/** Upward trending line chart — represents Growth */
export const GrowthIcon: React.FC<IconProps> = ({ size = 24, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    aria-label="Growth"
  >
    {/* X/Y axis */}
    <line x1="3" y1="20" x2="21" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="3" y1="20" x2="3" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    {/* Trend line */}
    <polyline
      points="4,17 8,13 13,15 19,7"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    {/* Arrow head at trend end */}
    <polyline
      points="16,6 19,7 18,10"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    {/* Data points */}
    <circle cx="8" cy="13" r="1.25" fill="currentColor" />
    <circle cx="13" cy="15" r="1.25" fill="currentColor" />
    <circle cx="19" cy="7" r="1.25" fill="currentColor" />
  </svg>
);

/** Shield with checkmark — represents Principal Protection */
export const PrincipalProtectionIcon: React.FC<IconProps> = ({ size = 24, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    aria-label="Principal Protection"
  >
    {/* Shield */}
    <path
      d="M12 2.5L4.5 5.5V11c0 4.75 3.25 9.15 7.5 10.5C16.25 20.15 19.5 15.75 19.5 11V5.5L12 2.5z"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinejoin="round"
    />
    {/* Lock body */}
    <rect x="9" y="12" width="6" height="5" rx="0.75" stroke="currentColor" strokeWidth="1.5" />
    {/* Lock shackle */}
    <path
      d="M10 12V10.5a2 2 0 0 1 4 0V12"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    {/* Keyhole dot */}
    <circle cx="12" cy="14.5" r="0.75" fill="currentColor" />
  </svg>
);

/** Dollar sign with circular arrows — represents Income */
export const IncomeIcon: React.FC<IconProps> = ({ size = 24, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    aria-label="Income"
  >
    {/* Outer circle (partial, showing recurring) */}
    <path
      d="M20.5 12A8.5 8.5 0 1 1 12 3.5"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
    {/* Arrow head on the arc */}
    <polyline
      points="12,2 12,5 15,4"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Dollar sign vertical bar */}
    <line x1="12" y1="8" x2="12" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    {/* Dollar sign curves */}
    <path
      d="M14.5 9.75A2.5 2.5 0 0 0 12 8.5h-.25A1.75 1.75 0 0 0 12 12h0A1.75 1.75 0 0 1 12 15.5H11.5A2.5 2.5 0 0 1 9.5 14.25"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

/** Umbrella with a heart — represents Death Benefits */
export const DeathBenefitIcon: React.FC<IconProps> = ({ size = 24, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    aria-label="Death Benefit"
  >
    {/* Umbrella canopy */}
    <path
      d="M12 3C7 3 3 7.25 3 12h18C21 7.25 17 3 12 3z"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinejoin="round"
    />
    {/* Umbrella center rib */}
    <line x1="12" y1="3" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    {/* Umbrella ribs */}
    <line x1="7" y1="4.75" x2="8.5" y2="12" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeOpacity="0.5" />
    <line x1="17" y1="4.75" x2="15.5" y2="12" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeOpacity="0.5" />
    {/* Handle */}
    <path
      d="M12 12v6a2 2 0 0 1-4 0"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
    {/* Small heart below */}
    <path
      d="M12 21.5c-.5-.4-2-1.5-2-2.75a1.25 1.25 0 0 1 2-1 1.25 1.25 0 0 1 2 1c0 1.25-1.5 2.35-2 2.75z"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinejoin="round"
    />
  </svg>
);
