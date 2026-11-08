import type { SiteSearchKind } from "@/lib/search/types";

const common = {
  width: 14,
  height: 14,
  viewBox: "0 0 24 24",
  fill: "none",
  "aria-hidden": true as const,
};

export default function SearchKindIcon({ kind }: { kind: SiteSearchKind }) {
  if (kind === "stock") {
    return (
      <svg {...common}>
        <path d="M4 19V9M10 19V5M16 19v-7M21 19H3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "index") {
    return (
      <svg {...common}>
        <path d="M4 16l5-5 3.5 3.5L20 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 7h6v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === "education") {
    return (
      <svg {...common}>
        <path d="M4 6.5 12 4l8 2.5L12 9 4 6.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M8 8.2V14c1.2.8 2.6 1.2 4 1.2s2.8-.4 4-1.2V8.2" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M20 7.2V14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M7 4.5h7l4 4V19.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14 4.5V9h4.5M8.5 13h7M8.5 16.5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
