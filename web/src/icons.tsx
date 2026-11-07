// One icon family: 16px grid, 1.5 stroke, round caps. Decorative unless given a label.
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = ({ size = 16, ...p }: P) => ({
  width: size, height: size, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor",
  strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  "aria-hidden": true, ...p,
});

export const Plus = (p: P) => <svg {...base(p)}><path d="M8 3.5v9M3.5 8h9" /></svg>;
export const ArrowRight = (p: P) => <svg {...base(p)}><path d="M3.5 8h9M9 4.5 12.5 8 9 11.5" /></svg>;
export const ArrowUp = (p: P) => <svg {...base(p)}><path d="M8 12.5v-9M4.5 7 8 3.5 11.5 7" /></svg>;
export const Check = (p: P) => <svg {...base(p)}><path className="check-path" d="m3.5 8.5 3 3 6-7" /></svg>;
export const Stop = (p: P) => <svg {...base(p)}><rect x="4" y="4" width="8" height="8" rx="1.5" /></svg>;
export const PanelRight = (p: P) => <svg {...base(p)}><rect x="2" y="3" width="12" height="10" rx="2" /><path d="M10 3v10" /></svg>;
export const Doc = (p: P) => <svg {...base(p)}><path d="M4.5 2h4.5L12 5v8.5a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5Z" /><path d="M9 2v3h3M6 8.5h4M6 11h3" /></svg>;
export const Video = (p: P) => <svg {...base(p)}><rect x="2" y="4" width="9" height="8" rx="1.5" /><path d="m11 7 3-1.5v5L11 9" /></svg>;
export const Sun = (p: P) => <svg {...base(p)}><circle cx="8" cy="8" r="2.75" /><path d="M8 1.5v1.25M8 13.25v1.25M1.5 8h1.25M13.25 8h1.25M3.4 3.4l.9.9M11.7 11.7l.9.9M3.4 12.6l.9-.9M11.7 4.3l.9-.9" /></svg>;
export const Moon = (p: P) => <svg {...base(p)}><path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5Z" /></svg>;
export const Monitor = (p: P) => <svg {...base(p)}><rect x="2" y="2.5" width="12" height="8.5" rx="1.5" /><path d="M6 14h4M8 11v3" /></svg>;
export const Chevron = (p: P) => <svg {...base(p)}><path d="m4.5 6.5 3.5 3.5 3.5-3.5" /></svg>;
export const More = (p: P) => <svg {...base(p)}><circle cx="3.5" cy="8" r=".75" fill="currentColor" /><circle cx="8" cy="8" r=".75" fill="currentColor" /><circle cx="12.5" cy="8" r=".75" fill="currentColor" /></svg>;
export const Trash = (p: P) => <svg {...base(p)}><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.6a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.6-8.6M6.75 7v4.5M9.25 7v4.5" /></svg>;
export const Chat = (p: P) => <svg {...base(p)}><path d="M3 3.5h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H7l-3 2.5v-2.5H3a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1Z" /></svg>;

export function Spinner({ size = 16, label }: { size?: number; label?: string }) {
  return (
    <svg className="spinner" width={size} height={size} viewBox="0 0 16 16" role={label ? "img" : undefined}
      aria-label={label} aria-hidden={label ? undefined : true}>
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
      <path d="M8 2a6 6 0 0 1 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** The Stoa mark: a colonnade reduced to three strokes under a lintel. */
export function Mark({ size = 20 }: { size?: number }) {
  return (
    <svg className="mark" width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <rect width="20" height="20" rx="6" fill="currentColor" />
      <path d="M5 6h10M6.5 8.5v5.5M10 8.5v5.5M13.5 8.5v5.5M5 15h10" stroke="var(--bg)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export const Paperclip = (p: P) => <svg {...base(p)}><path d="M13 7.5 8.1 12.4a3 3 0 0 1-4.25-4.24l5.3-5.3a2 2 0 0 1 2.83 2.83L6.7 10.98a1 1 0 0 1-1.41-1.41L10 4.86" /></svg>;
export const X = (p: P) => <svg {...base(p)}><path d="m4.5 4.5 7 7M11.5 4.5l-7 7" /></svg>;
export const Settings = (p: P) => <svg {...base(p)}><path d="M2.5 4.5h6M11.5 4.5h2M2.5 11.5h2M7.5 11.5h6" /><circle cx="10" cy="4.5" r="1.5" /><circle cx="6" cy="11.5" r="1.5" /></svg>;
