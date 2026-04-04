import type { ReactNode } from 'react';
import type { IconName } from '@/types/builder';

type IconProps = {
  name: IconName;
  className?: string;
};

const paths: Record<IconName, ReactNode> = {
  architecture: (
    <>
      <path d="M12 4 7 8v8" />
      <path d="M12 4 17 8v8" />
      <path d="M9 12h6" />
      <circle cx="12" cy="4" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="9" height="11" rx="2" />
      <path d="M7 15H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1" />
    </>
  ),
  flask: (
    <>
      <path d="M10 3.5v5l-4.6 7.7A3 3 0 0 0 8 20.5h8a3 3 0 0 0 2.6-4.3L14 8.5v-5" />
      <path d="M8.5 8.5h7" />
      <path d="M8 16c1.1-.8 2.1-1.2 3.1-1.2 1.5 0 2.3 1 3.8 1 .7 0 1.4-.2 2.1-.7" />
    </>
  ),
  dropout: (
    <>
      <path d="M7 7.5h10" />
      <path d="M7 12h10" />
      <path d="M7 16.5h10" />
      <circle cx="9" cy="7.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="11" cy="16.5" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  stack: (
    <>
      <ellipse cx="12" cy="6.5" rx="6.5" ry="2.5" />
      <path d="M5.5 6.5v5c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5v-5" />
      <path d="M5.5 11.5v5c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5v-5" />
    </>
  ),
  chip: (
    <>
      <rect x="7" y="7" width="10" height="10" rx="2" />
      <path d="M9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </>
  ),
  file: (
    <>
      <path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1.5Z" />
      <path d="M14 3.5V8h4" />
      <path d="M9 12h6M9 16h6" />
    </>
  ),
  layers: (
    <>
      <path d="M12 4 4.5 8.5 12 13l7.5-4.5L12 4Z" />
      <path d="M6.5 12 12 15.5 17.5 12" />
    </>
  ),
  panel: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </>
  ),
  pool: (
    <>
      <path d="M5 7h14" />
      <path d="M7 7v4.5c0 2.9 2.2 5.3 5 5.3s5-2.4 5-5.3V7" />
      <path d="M10 17.2v2.3M14 17.2v2.3" />
    </>
  ),
  settings: (
    <>
      <path d="M12 3.8 13.8 5l2.2-.3.8 2 2 1-.4 2.3 1.3 1.7-1.3 1.7.4 2.3-2 1-.8 2-2.2-.3-1.8 1.2-1.8-1.2-2.2.3-.8-2-2-1 .4-2.3L3.7 12l1.3-1.7-.4-2.3 2-1 .8-2 2.2.3L12 3.8Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  bell: (
    <>
      <path d="M12 4.5a4 4 0 0 0-4 4v2.1c0 .7-.2 1.4-.6 2L6 15h12l-1.4-2.4c-.4-.6-.6-1.3-.6-2V8.5a4 4 0 0 0-4-4Z" />
      <path d="M10 18a2 2 0 0 0 4 0" />
    </>
  ),
  zoomIn: (
    <>
      <circle cx="11" cy="11" r="5.5" />
      <path d="M15.5 15.5 20 20M11 8.5v5M8.5 11h5" />
    </>
  ),
  zoomOut: (
    <>
      <circle cx="11" cy="11" r="5.5" />
      <path d="M15.5 15.5 20 20M8.5 11h5" />
    </>
  ),
  play: <path d="m9 7 8 5-8 5V7Z" />,
  pause: (
    <>
      <rect x="8" y="6.5" width="2.8" height="11" rx="1" />
      <rect x="13.2" y="6.5" width="2.8" height="11" rx="1" />
    </>
  ),
  stop: <rect x="7.5" y="7.5" width="9" height="9" rx="1.6" />,
  reset: (
    <>
      <path d="M12 5a7 7 0 1 0 6.2 10.2" />
      <path d="M17 4v5h-5" />
    </>
  ),
  rocket: (
    <>
      <path d="M14.5 5.5c2.9.4 4.5 2 5 5-2.4 2.4-4.9 4.2-7.7 5.5L9 14l-2-2.8c1.3-2.8 3.1-5.3 5.5-7.7Z" />
      <path d="M10 14 7 17M7 10 4 13M8 18l-1 2M4 14l-2 1" />
      <circle cx="14.5" cy="9.5" r="1.3" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4.5h8v3.2A4 4 0 0 1 12 11.7 4 4 0 0 1 8 7.7V4.5Z" />
      <path d="M8 5.5H5.5A1.5 1.5 0 0 0 4 7c0 2 1.7 3.6 3.8 3.6H8" />
      <path d="M16 5.5h2.5A1.5 1.5 0 0 1 20 7c0 2-1.7 3.6-3.8 3.6H16" />
      <path d="M12 11.7v3.1" />
      <path d="M9 20h6" />
      <path d="M8 20a4 4 0 0 1 8 0" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.2a2.8 2.8 0 1 1 4.1 2.5c-1 .6-1.6 1.2-1.6 2.3" />
      <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.4 2.4 4.8-4.8" />
    </>
  ),
  dots: (
    <>
      <circle cx="12" cy="7" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="17" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  chevron: <path d="m8 10 4 4 4-4" />,
};

export function Icon({ name, className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className ?? 'h-5 w-5'}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
