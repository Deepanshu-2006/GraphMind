import React from 'react';

export interface GraphMindLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  color?: string;
  className?: string;
}

/**
 * Canonical GraphMind logo mark component.
 * Exact 1:1 match with browser favicon SVG emblem in GraphMind accent green.
 */
export const GraphMindLogo: React.FC<GraphMindLogoProps> = ({
  size = 20,
  color = 'var(--accent, #A3FF12)',
  className = '',
  ...props
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
    {...props}
  >
    <circle cx="12" cy="12" r="3" />
    <circle cx="19" cy="5" r="2" />
    <circle cx="5" cy="19" r="2" />
    <circle cx="18" cy="19" r="2" />
    <circle cx="6" cy="5" r="2" />
    <path d="M10 10.5 7 6.5" />
    <path d="m14 10.5 3.5-4" />
    <path d="m10 13.5-3.5 4" />
    <path d="m14 13.5 3 4" />
  </svg>
);

export default GraphMindLogo;
