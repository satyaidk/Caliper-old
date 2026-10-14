interface Props {
  size?: number;
  className?: string;
}

/* Every glyph is drawn on a 20×20 grid with a 1.5px rounded stroke, the way
   Bambu Studio's toolbar icons are: outline only, one weight, no fills except
   for a single dot of emphasis. Colour comes from `currentColor`, so a glyph
   turns green with its button and never carries a colour of its own. */
const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

/* --- workspaces ----------------------------------------------------------- */

export const IconHome = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <path d="M3.5 9.2 10 3.8l6.5 5.4V16a.8.8 0 0 1-.8.8H12v-4.6H8v4.6H4.3a.8.8 0 0 1-.8-.8z" />
  </svg>
);

export const IconPrepare = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <path d="M10 2.8 16.2 6.4v7.2L10 17.2l-6.2-3.6V6.4z" />
    <path d="M3.8 6.4 10 10l6.2-3.6M10 10v7.2" />
  </svg>
);

export const IconPreview = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <path d="M10 3.4 17 7l-7 3.6L3 7z" />
    <path d="m3 10.3 7 3.6 7-3.6M3 13.6l7 3.6 7-3.6" />
  </svg>
);

/* --- render modes --------------------------------------------------------- */

export const IconShaded = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <path d="M10 2.8 16.2 6.4v7.2L10 17.2l-6.2-3.6V6.4z" />
    <path d="M10 10v7.2M10 10l6.2-3.6" opacity=".5" />
    <path d="M10 10 3.8 6.4v7.2L10 17.2z" fill="currentColor" stroke="none" opacity=".28" />
  </svg>
);

export const IconWire = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <path d="M10 2.8 16.2 6.4v7.2L10 17.2l-6.2-3.6V6.4z" />
    <path d="M3.8 6.4 10 10l6.2-3.6M10 10v7.2M3.8 13.6 10 10l6.2 3.6M10 2.8V10" opacity=".7" />
  </svg>
);

export const IconEdges = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <path d="M10 2.8 16.2 6.4v7.2L10 17.2l-6.2-3.6V6.4z" fill="currentColor" fillOpacity=".18" />
    <path d="M3.8 6.4 10 10l6.2-3.6M10 10v7.2" />
  </svg>
);

/* --- stage ---------------------------------------------------------------- */

export const IconPlate = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <path d="M2.6 14.6 5.4 6.4h12l-2.8 8.2z" />
    <path d="M8.4 6.4 6.6 14.6M11.4 6.4l-1.8 8.2M14.4 6.4l-1.8 8.2M4.3 10.5h12" opacity=".55" />
  </svg>
);

export const IconShadow = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <circle cx="10" cy="8" r="4.6" />
    <ellipse cx="10" cy="16" rx="6" ry="1.4" fill="currentColor" stroke="none" opacity=".4" />
  </svg>
);

export const IconPerspective = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <path d="M2.8 7.6 8 8.8v2.4l-5.2 1.2z" />
    <path d="m8 8.8 9.2-3.6v9.6L8 11.2" opacity=".7" />
  </svg>
);

export const IconOrthographic = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <rect x="3" y="5.6" width="5" height="8.8" rx=".6" />
    <path d="M8 5.6h9.2M8 14.4h9.2M17.2 5.6v8.8" opacity=".7" />
  </svg>
);

export const IconFit = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <path d="M3 7V3.6h3.4M13.6 3h3.4v3.4M17 13.6V17h-3.4M6.4 17H3v-3.4" />
    <rect x="7.2" y="7.2" width="5.6" height="5.6" rx=".8" opacity=".6" />
  </svg>
);

export const IconLabels = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <path d="M3.4 5h7.9l5.3 5-5.3 5H3.4a.8.8 0 0 1-.8-.8V5.8a.8.8 0 0 1 .8-.8z" />
    <circle cx="6.6" cy="10" r="1.1" />
  </svg>
);

/** A part with a cantilevered shelf, the shelf's underside picked out. */
export const IconOverhang = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <path d="M3 16.8h14" opacity=".55" />
    <path d="M6.2 16.8V7.4H16v3.4H9.6v6" />
    <path d="M10.6 13.2l1.4 1.4M13.2 13.2l1.4 1.4" opacity=".75" />
  </svg>
);

/* --- prepare tools -------------------------------------------------------- */

export const IconAutoOrient = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <path d="M15.6 8.2A5.8 5.8 0 0 0 4.9 6.1" />
    <path d="M4.4 2.9v3.4h3.4" />
    <path d="M3 17h14" opacity=".55" />
    <rect x="6.6" y="10.6" width="6.8" height="6.4" rx=".6" />
  </svg>
);

export const IconLayFace = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <path d="M6 3.4h8v6.4H6z" />
    <path d="M10 11.2v3.4M8.4 13 10 14.6 11.6 13" />
    <path d="M3 17.2h14" opacity=".55" />
  </svg>
);

export const IconDistance = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <path d="M3.4 13.4 13.4 3.4l3.2 3.2-10 10z" />
    <path d="m6.2 10.6 1.4 1.4M8.6 8.2 10 9.6M11 5.8l1.4 1.4" />
  </svg>
);

export const IconDiameter = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <circle cx="10" cy="10" r="6.4" />
    <path d="m5.5 14.5 9-9" />
  </svg>
);

export const IconAngle = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <path d="M3.4 16.4h13.2M3.4 16.4l9-11.4" />
    <path d="M8.8 16.4a5.4 5.4 0 0 0-2.1-4.2" />
  </svg>
);

export const IconSection = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <path d="M5.4 6.8 10 4.2l4.6 2.6" opacity=".45" />
    <path d="M5.4 10.6v3.6l4.6 2.6 4.6-2.6v-3.6" />
    <path d="M2.6 10.6 10 7.6l7.4 3-7.4 3z" fill="currentColor" fillOpacity=".22" />
  </svg>
);

export const IconExplode = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <rect x="3" y="3" width="5" height="5" rx=".6" />
    <rect x="12" y="3" width="5" height="5" rx=".6" />
    <rect x="3" y="12" width="5" height="5" rx=".6" />
    <rect x="12" y="12" width="5" height="5" rx=".6" />
  </svg>
);

export const IconReset = ({ size = 16 }: Props) => (
  <svg {...base(size)}>
    <path d="M4.2 8.6A6 6 0 1 1 5 13.8" />
    <path d="M3.6 4.6v4h4" />
  </svg>
);

/* --- objects -------------------------------------------------------------- */

export const IconEye = ({ size = 16 }: Props) => (
  <svg {...base(size)}>
    <path d="M2.4 10S5.2 4.8 10 4.8s7.6 5.2 7.6 5.2-2.8 5.2-7.6 5.2S2.4 10 2.4 10z" />
    <circle cx="10" cy="10" r="2.2" />
  </svg>
);

export const IconEyeOff = ({ size = 16 }: Props) => (
  <svg {...base(size)}>
    <path d="M8 5.1A7 7 0 0 1 10 4.8c4.8 0 7.6 5.2 7.6 5.2a13 13 0 0 1-1.9 2.5M12.6 14.6a7 7 0 0 1-2.6.6C5.2 15.2 2.4 10 2.4 10a13 13 0 0 1 3.2-3.6" />
    <path d="m3.4 3.4 13.2 13.2" />
  </svg>
);

export const IconIsolate = ({ size = 16 }: Props) => (
  <svg {...base(size)}>
    <circle cx="10" cy="10" r="5.6" />
    <circle cx="10" cy="10" r="1.6" fill="currentColor" stroke="none" />
    <path d="M10 1.8v2.6M10 15.6v2.6M1.8 10h2.6M15.6 10h2.6" />
  </svg>
);

export const IconSearch = ({ size = 15 }: Props) => (
  <svg {...base(size)}>
    <circle cx="8.8" cy="8.8" r="5" />
    <path d="m12.6 12.6 4 4" />
  </svg>
);

/* --- sidebar sections ----------------------------------------------------- */

export const IconPrinter = ({ size = 16 }: Props) => (
  <svg {...base(size)}>
    <rect x="3" y="2.8" width="14" height="14.4" rx="1.4" />
    <path d="M3 6.6h14M6.2 13.6h7.6M10 6.6v4.2" />
    <path d="M8.6 10.8h2.8" />
  </svg>
);

export const IconSpool = ({ size = 16 }: Props) => (
  <svg {...base(size)}>
    <circle cx="10" cy="10" r="7" />
    <circle cx="10" cy="10" r="2.2" />
    <path d="M10 3v4.8M10 12.2V17M3 10h4.8M12.2 10H17" opacity=".55" />
  </svg>
);

export const IconObjects = ({ size = 16 }: Props) => (
  <svg {...base(size)}>
    <path d="M7.6 5.4h9M7.6 10h9M7.6 14.6h9" />
    <rect x="3" y="4.2" width="2.4" height="2.4" rx=".4" />
    <rect x="3" y="8.8" width="2.4" height="2.4" rx=".4" />
    <rect x="3" y="13.4" width="2.4" height="2.4" rx=".4" />
  </svg>
);

export const IconSize = ({ size = 16 }: Props) => (
  <svg {...base(size)}>
    <path d="M3 3v14h14" />
    <path d="M6.6 13.4 13.4 6.6M10.2 6.6h3.2v3.2" />
  </svg>
);

export const IconFile = ({ size = 16 }: Props) => (
  <svg {...base(size)}>
    <path d="M5 2.8h6.4L15 6.4v10a.8.8 0 0 1-.8.8H5a.8.8 0 0 1-.8-.8V3.6A.8.8 0 0 1 5 2.8z" />
    <path d="M11.2 2.8v3.8H15" />
  </svg>
);

export const IconCheckup = ({ size = 16 }: Props) => (
  <svg {...base(size)}>
    <path d="M10 2.8 16 5v5c0 3.6-2.6 6-6 7.2C6.6 16 4 13.6 4 10V5z" />
    <path d="m7.4 10 1.8 1.8 3.6-3.8" />
  </svg>
);

/* --- chrome --------------------------------------------------------------- */

export const IconOpen = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <path d="M2.8 15.2V5.4a1 1 0 0 1 1-1h3.9l1.5 1.9h6a1 1 0 0 1 1 1v7.9a1 1 0 0 1-1 1H3.8a1 1 0 0 1-1-1z" />
    <path d="M10 8.4v4.4M7.9 10.5 10 8.4l2.1 2.1" />
  </svg>
);

export const IconGear = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <circle cx="10" cy="10" r="2.2" />
    <path d="M8.6 2.8h2.8l.4 2 1.6.9 1.9-.7 1.4 2.4-1.5 1.4v1.8l1.5 1.4-1.4 2.4-1.9-.7-1.6.9-.4 2H8.6l-.4-2-1.6-.9-1.9.7-1.4-2.4 1.5-1.4V9.2L3.3 7.8l1.4-2.4 1.9.7 1.6-.9z" />
  </svg>
);

export const IconCamera = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <rect x="2.6" y="5.4" width="14.8" height="10.2" rx="1.6" />
    <circle cx="10" cy="10.5" r="2.9" />
    <path d="m7.2 5.4 1-1.8h3.6l1 1.8" />
  </svg>
);

export const IconSidebar = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <rect x="2.6" y="3.6" width="14.8" height="12.8" rx="1.6" />
    <path d="M7.6 3.6v12.8" />
  </svg>
);

export const IconKeyboard = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <rect x="2.4" y="5" width="15.2" height="10" rx="1.6" />
    <path d="M5.4 8.2h.1M8.2 8.2h.1M11 8.2h.1M13.8 8.2h.8M5.4 11.6h.8M8.2 11.6h3.6M13.8 11.6h.8" strokeWidth="1.7" />
  </svg>
);

export const IconSun = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <circle cx="10" cy="10" r="3.4" />
    <path d="M10 1.8V4M10 16v2.2M3.2 3.2l1.6 1.6M15.2 15.2l1.6 1.6M1.8 10H4M16 10h2.2M3.2 16.8l1.6-1.6M15.2 4.8l1.6-1.6" />
  </svg>
);

export const IconMoon = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <path d="M16.4 12.4A7 7 0 0 1 7.6 3.6a7 7 0 1 0 8.8 8.8z" />
  </svg>
);

export const IconDownload = ({ size = 16 }: Props) => (
  <svg {...base(size)}>
    <path d="M10 3v9.4M6.4 9 10 12.6 13.6 9" />
    <path d="M3.4 13.6v2a1 1 0 0 0 1 1h11.2a1 1 0 0 0 1-1v-2" />
  </svg>
);

export const IconLink = ({ size = 16 }: Props) => (
  <svg {...base(size)}>
    <path d="M8.4 11.6a3.2 3.2 0 0 0 4.6 0l2.8-2.8a3.2 3.2 0 0 0-4.6-4.6l-1 1" />
    <path d="M11.6 8.4a3.2 3.2 0 0 0-4.6 0l-2.8 2.8a3.2 3.2 0 0 0 4.6 4.6l1-1" />
  </svg>
);

export const IconChevron = ({ size = 14 }: Props) => (
  <svg {...base(size)}>
    <path d="m5.6 7.8 4.4 4.4 4.4-4.4" />
  </svg>
);

export const IconUndo = ({ size = 15 }: Props) => (
  <svg {...base(size)}>
    <path d="M3.4 9.2h9a4 4 0 0 1 0 8H8.6" />
    <path d="M6.4 5.8 3 9.2l3.4 3.4" />
  </svg>
);

export const IconTrash = ({ size = 15 }: Props) => (
  <svg {...base(size)}>
    <path d="M3.6 5.6h12.8M8 5.6V3.8h4v1.8" />
    <path d="m5.2 5.6.8 10.2h8l.8-10.2" />
  </svg>
);

export const IconClose = ({ size = 14 }: Props) => (
  <svg {...base(size)}>
    <path d="m4.6 4.6 10.8 10.8M15.4 4.6 4.6 15.4" />
  </svg>
);

export const IconCheck = ({ size = 14 }: Props) => (
  <svg {...base(size)}>
    <path d="m4.4 10.4 3.6 3.6 7.6-8" />
  </svg>
);

export const IconWarn = ({ size = 14 }: Props) => (
  <svg {...base(size)}>
    <path d="M10 3.2 17.6 16.4H2.4z" />
    <path d="M10 8.2v3.6M10 14.2v.1" />
  </svg>
);

/**
 * The mark. Two jaws closing on a span, with the span picked out in green —
 * the app's whole proposition at 22 pixels.
 */
export const IconCaliper = ({ size = 22 }: Props) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M4.6 4.5v15M19.4 4.5v15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M4.6 12h14.8" stroke="#00ae42" strokeWidth="1.8" strokeLinecap="round" />
    <path
      d="M8.2 9.2 5.2 12l3 2.8M15.8 9.2l3 2.8-3 2.8"
      stroke="#00ae42"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
