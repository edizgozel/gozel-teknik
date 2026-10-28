import type { SVGProps } from "react";

type IconName =
  | "home"
  | "wrench"
  | "users"
  | "devices"
  | "boxes"
  | "wallet"
  | "chart"
  | "settings";

const paths: Record<IconName, JSX.Element> = {
  home: (
    <>
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M10 20v-5.5h4V20" />
    </>
  ),
  wrench: (
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
      <path d="M15.5 5.4a3.2 3.2 0 0 1 0 5.2" />
      <path d="M17.5 14.8c1.7.7 2.7 2.3 3 4.7" />
    </>
  ),
  devices: (
    <>
      <rect x="3" y="4.5" width="12.5" height="9.5" rx="1" />
      <path d="M7 17.5h5" />
      <path d="M9.2 14v3.5" />
      <rect x="17.5" y="9" width="4" height="8.5" rx="1" />
      <path d="M19.5 15.4h.01" />
    </>
  ),
  boxes: (
    <>
      <path d="M12 3.5 20 7v10l-8 3.5L4 17V7z" />
      <path d="M4 7l8 3.5L20 7" />
      <path d="M12 10.5V20.5" />
      <path d="M8 5.2l8 3.5" />
    </>
  ),
  wallet: (
    <>
      <rect x="3.5" y="6" width="17" height="12.5" rx="1.5" />
      <path d="M3.5 9.5h17" />
      <path d="M15.5 14.2h2.5" />
    </>
  ),
  chart: (
    <>
      <path d="M4 4v16h16" />
      <path d="M8 16v-5" />
      <path d="M12.5 16V8" />
      <path d="M17 16v-3" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="2.8" />
      <path d="M12 3.8v2.4M12 17.8v2.4M4.9 7.9l2.1 1.2M17 14.9l2.1 1.2M4.9 16.1 7 14.9M17 9.1l2.1-1.2" />
    </>
  ),
};

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 17, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}

export type { IconName };
