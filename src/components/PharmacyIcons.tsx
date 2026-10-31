import React from 'react';

export function BrandLogoMark({ className = 'w-11 h-11' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Medical Cross */}
      <rect x="26" y="8" width="16" height="44" rx="4" fill="#146c43" />
      <rect x="12" y="22" width="44" height="16" rx="4" fill="#146c43" />
      {/* Herbal Leaf Overlay matching reference logo */}
      <path
        d="M8 34C8 22 20 18 30 28C36 34 36 48 26 54C16 56 8 46 8 34Z"
        fill="#22a05b"
        stroke="#ffffff"
        strokeWidth="2"
      />
      <path
        d="M14 33C20 36 25 43 27 52"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CategoryGraphicIcon({
  iconKey,
  className = 'w-11 h-11',
}: {
  iconKey: string;
  className?: string;
}) {
  switch (iconKey) {
    case 'pill':
      return (
        <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
          <g transform="rotate(-45 24 24)">
            <rect
              x="14"
              y="6"
              width="20"
              height="36"
              rx="10"
              stroke="#0284c7"
              strokeWidth="2.5"
              fill="#f0f9ff"
            />
            <path d="M14 24H34" stroke="#0284c7" strokeWidth="2.5" />
            <path
              d="M15 24H33V32C33 36.9706 28.9706 41 24 41C19.0294 41 15 36.9706 15 32V24Z"
              fill="#bae6fd"
            />
          </g>
        </svg>
      );
    case 'leaf':
      return (
        <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
          <path
            d="M25 38C25 25 33 13 42 11C42 24 36 35 25 38Z"
            fill="#22c55e"
            stroke="#15803d"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M23 38C14 35 8 26 9 15C18 16 24 25 23 38Z"
            fill="#dcfce7"
            stroke="#15803d"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M24 38V43" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case 'supplement':
      return (
        <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
          <rect x="17" y="7" width="14" height="6" rx="2" fill="#dcfce7" stroke="#146c43" strokeWidth="2.2" />
          <rect x="13" y="13" width="22" height="28" rx="5" fill="#ffffff" stroke="#146c43" strokeWidth="2.2" />
          <line x1="13" y1="20" x2="35" y2="20" stroke="#146c43" strokeWidth="2" />
          <line x1="13" y1="34" x2="35" y2="34" stroke="#146c43" strokeWidth="2" />
          <path d="M24 23V31M20 27H28" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case 'stethoscope':
      return (
        <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
          <path
            d="M14 10V20C14 25.5228 18.4772 30 24 30C29.5228 30 34 25.5228 34 20V10"
            stroke="#146c43"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M24 30V35C24 38.866 27.134 42 31 42C34.866 42 38 38.866 38 35V29"
            stroke="#146c43"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="38" cy="26" r="3.5" fill="#dcfce7" stroke="#146c43" strokeWidth="2.2" />
          <circle cx="14" cy="10" r="2" fill="#146c43" />
          <circle cx="34" cy="10" r="2" fill="#146c43" />
        </svg>
      );
    case 'skincare':
      return (
        <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
          <rect x="13" y="18" width="11" height="22" rx="3" fill="#fce7f3" stroke="#db2777" strokeWidth="2" />
          <path d="M16 18V12H21V18" stroke="#db2777" strokeWidth="2" />
          <path d="M18.5 12V9H23" stroke="#db2777" strokeWidth="2" strokeLinecap="round" />
          <rect x="27" y="23" width="10" height="17" rx="3" fill="#fbcfe8" stroke="#db2777" strokeWidth="2" />
          <rect x="29" y="18" width="6" height="5" rx="1" stroke="#db2777" strokeWidth="2" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
          <rect x="11" y="12" width="26" height="28" rx="4" fill="#ecfdf5" stroke="#146c43" strokeWidth="2.2" />
          <path d="M18 12V9C18 7.89543 18.8954 7 20 7H28C29.1046 7 30 7.89543 30 9V12" stroke="#146c43" strokeWidth="2.2" />
          <circle cx="24" cy="23" r="4" fill="#146c43" />
          <path d="M17 34C18.5 30.5 21 29 24 29C27 29 29.5 30.5 31 34" stroke="#146c43" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
  }
}

export function BkashBadge() {
  return (
    <span className="inline-flex items-center gap-1 font-display-brand font-bold text-xs text-[#e2136e]">
      <span>bKash</span>
      <svg viewBox="0 0 20 16" className="w-4 h-3.5 fill-[#e2136e]" aria-hidden="true">
        <polygon points="2,14 9,2 14,9" />
        <polygon points="9,2 19,6 14,9" opacity="0.8" />
      </svg>
    </span>
  );
}

export function NagadBadge() {
  return (
    <span className="inline-flex items-center gap-1 font-display-brand font-bold text-xs text-[#ed1c24]">
      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#f7941d] text-white text-[9px] font-extrabold">
        ন
      </span>
      <span>নগদ</span>
    </span>
  );
}
