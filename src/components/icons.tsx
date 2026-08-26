import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

const base = (size?: number) => ({
  width: size ?? 16,
  height: size ?? 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const IconShield = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 3 5 6v5c0 4.4 2.9 8.1 7 10 4.1-1.9 7-5.6 7-10V6l-7-3Z" />
    <path d="M9 12l2 2 4-4.5" />
  </svg>
);

export const IconRadar = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="4.5" opacity="0.55" />
    <path d="M12 12 18.5 6.5" />
    <circle cx="15" cy="14.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export const IconTerminal = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="3" y="4.5" width="18" height="15" rx="1.5" />
    <path d="m7 9 3 3-3 3M12.5 15H17" />
  </svg>
);

export const IconMatrix = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="3.5" y="3.5" width="7" height="7" />
    <rect x="13.5" y="3.5" width="7" height="7" />
    <rect x="3.5" y="13.5" width="7" height="7" />
    <rect x="13.5" y="13.5" width="7" height="7" opacity="0.45" />
  </svg>
);

export const IconRoute = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="6" cy="18" r="2.5" />
    <circle cx="18" cy="6" r="2.5" />
    <path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5" />
  </svg>
);

export const IconScope = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="12" cy="12" r="7.5" />
    <path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" />
  </svg>
);

export const IconLock = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="5" y="10.5" width="14" height="9.5" rx="1.5" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    <path d="M12 14.5v2" />
  </svg>
);

export const IconWrench = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M14.5 6.5a4 4 0 0 0-5.2 5L4 16.8V20h3.2l5.3-5.3a4 4 0 0 0 5-5.2l-2.6 2.6-2.5-.6-.6-2.5 2.7-2.5Z" />
  </svg>
);

export const IconCheckCircle = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.5 12 2.5 2.5 4.5-5" />
  </svg>
);

export const IconWarn = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 4 2.8 19.5h18.4L12 4Z" />
    <path d="M12 10v4.2M12 17.2v.1" />
  </svg>
);

export const IconCopy = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="8.5" y="8.5" width="12" height="12" rx="1.5" />
    <path d="M15.5 5.5v-1a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 4.5V14a1.5 1.5 0 0 0 1.5 1.5h1" />
  </svg>
);

export const IconDownload = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 3.5v10M8 10l4 4 4-4M4.5 19.5h15" />
  </svg>
);

export const IconPlay = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M7 4.5v15l12-7.5-12-7.5Z" />
  </svg>
);

export const IconPulse = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M2.5 12h4l2.5-6.5L13.5 18l2.5-6h5.5" />
  </svg>
);

export const IconDb = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <ellipse cx="12" cy="5.5" rx="7.5" ry="2.8" />
    <path d="M4.5 5.5v13c0 1.6 3.4 2.8 7.5 2.8s7.5-1.2 7.5-2.8v-13" />
    <path d="M4.5 12c0 1.6 3.4 2.8 7.5 2.8s7.5-1.2 7.5-2.8" />
  </svg>
);

export const IconCloud = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M7 18.5a4.5 4.5 0 0 1-.6-8.96 6 6 0 0 1 11.7 1.46A3.75 3.75 0 0 1 17.5 18.5H7Z" />
  </svg>
);

export const IconGit = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="6" cy="6" r="2.5" />
    <circle cx="6" cy="18" r="2.5" />
    <circle cx="18" cy="9" r="2.5" />
    <path d="M6 8.5v7M8.3 7.2c4 1 7.4 1 9.7 1.8" />
  </svg>
);

export const IconDoc = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M6 3.5h8l4 4v13H6v-17Z" />
    <path d="M14 3.5v4h4M9 12h6M9 15.5h6" />
  </svg>
);

export const IconLink = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M10 14a4 4 0 0 0 6 .5l2.5-2.5a4 4 0 1 0-5.7-5.7L11.5 7.5" />
    <path d="M14 10a4 4 0 0 0-6-.5L5.5 12a4 4 0 1 0 5.7 5.7l1.3-1.2" />
  </svg>
);

export const IconClock = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7v5l3.5 2" />
  </svg>
);
