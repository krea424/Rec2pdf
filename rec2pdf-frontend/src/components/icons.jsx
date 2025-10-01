import React from "react";

function IconBase({ children, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const Mic = (props) => (
  <IconBase {...props}>
    <path d="M12 3.25a3.25 3.25 0 0 0-3.25 3.25v5.5a3.25 3.25 0 0 0 6.5 0V6.5A3.25 3.25 0 0 0 12 3.25z" />
    <path d="M5.75 11a6.25 6.25 0 0 0 12.5 0" />
    <path d="M12 17.25v3.5" />
    <path d="M8.5 20.75h7" />
  </IconBase>
);

export const Square = (props) => (
  <IconBase {...props}>
    <rect x="5" y="5" width="14" height="14" rx="2" />
  </IconBase>
);

export const Settings = (props) => (
  <IconBase {...props}>
    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
    <path d="m19.4 13.5-.6-1a1.2 1.2 0 0 1 0-1l.6-1a1.2 1.2 0 0 0-.44-1.64l-1.06-.6a1.2 1.2 0 0 1-.6-.9l-.16-1.2A1.2 1.2 0 0 0 15.96 4h-1.2a1.2 1.2 0 0 1-.9-.6l-.6-1.06a1.2 1.2 0 0 0-2.12 0l-.6 1.06a1.2 1.2 0 0 1-.9.6h-1.2a1.2 1.2 0 0 0-1.18 1.06l-.16 1.2a1.2 1.2 0 0 1-.6.9l-1.06.6A1.2 1.2 0 0 0 4.6 10.5l.6 1a1.2 1.2 0 0 1 0 1l-.6 1a1.2 1.2 0 0 0 .44 1.64l1.06.6a1.2 1.2 0 0 1 .6.9l.16 1.2A1.2 1.2 0 0 0 8.04 20h1.2a1.2 1.2 0 0 1 .9.6l.6 1.06a1.2 1.2 0 0 0 2.12 0l.6-1.06a1.2 1.2 0 0 1 .9-.6h1.2a1.2 1.2 0 0 0 1.18-1.06l.16-1.2a1.2 1.2 0 0 1 .6-.9l1.06-.6a1.2 1.2 0 0 0 .44-1.64z" />
  </IconBase>
);

export const Folder = (props) => (
  <IconBase {...props}>
    <path d="M3.5 7.5a2.5 2.5 0 0 1 2.5-2.5h4l2 2.5h6.5A2.5 2.5 0 0 1 21 10v7.5A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z" />
  </IconBase>
);

export const FileText = (props) => (
  <IconBase {...props}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6" />
    <path d="M9 13h6" />
    <path d="M9 17h6" />
  </IconBase>
);

export const FileCode = (props) => (
  <IconBase {...props}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6" />
    <path d="m10 15-2-2 2-2" />
    <path d="m14 11 2 2-2 2" />
  </IconBase>
);

export const Cpu = (props) => (
  <IconBase {...props}>
    <rect x="5" y="5" width="14" height="14" rx="2" />
    <rect x="9" y="9" width="6" height="6" rx="1" />
    <path d="M9 1v3" />
    <path d="M15 1v3" />
    <path d="M9 20v3" />
    <path d="M15 20v3" />
    <path d="M1 9h3" />
    <path d="M1 15h3" />
    <path d="M20 9h3" />
    <path d="M20 15h3" />
  </IconBase>
);

export const Download = (props) => (
  <IconBase {...props}>
    <path d="M12 3v12" />
    <path d="m7.5 11 4.5 4.5L16.5 11" />
    <path d="M5 19h14" />
  </IconBase>
);

export const Timer = (props) => (
  <IconBase {...props}>
    <path d="M10 2h4" />
    <path d="M12 7v5l3 2" />
    <circle cx="12" cy="13" r="8" />
  </IconBase>
);

export const Waves = (props) => (
  <IconBase {...props}>
    <path d="M3 12s2-3 5-3 4 3 7 3 5-3 6-3" />
    <path d="M3 17s2-3 5-3 4 3 7 3 5-3 6-3" />
  </IconBase>
);

export const CheckCircle2 = (props) => (
  <IconBase {...props}>
    <path d="m9 12 2 2 4-4" />
    <circle cx="12" cy="12" r="9" />
  </IconBase>
);

export const AlertCircle = (props) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v4" />
    <path d="M12 16h.01" />
  </IconBase>
);

export const Link = (props) => (
  <IconBase {...props}>
    <path d="M9.5 14.5 7 17a3 3 0 0 1-4.24-4.24l3.54-3.54A3 3 0 0 1 9.94 8" />
    <path d="M14.5 9.5 17 7a3 3 0 0 1 4.24 4.24l-3.54 3.54A3 3 0 0 1 14.06 16" />
    <path d="m8.5 15.5 7-7" />
  </IconBase>
);

export const Upload = (props) => (
  <IconBase {...props}>
    <path d="M12 21V9" />
    <path d="m7.5 12.5 4.5-4.5 4.5 4.5" />
    <path d="M5 21h14" />
  </IconBase>
);

export const RefreshCw = (props) => (
  <IconBase {...props}>
    <path d="M20 11a8 8 0 1 0-1.89 5.12" />
    <path d="M20 7v4h-4" />
  </IconBase>
);

export const Bug = (props) => (
  <IconBase {...props}>
    <path d="M8 7v-2a4 4 0 1 1 8 0v2" />
    <path d="M4 13h16" />
    <path d="M4 19h16" />
    <path d="M19 7l1.5-1.5" />
    <path d="M5 7 3.5 5.5" />
    <path d="M12 7a7 7 0 0 0-7 7v2a7 7 0 0 0 14 0v-2a7 7 0 0 0-7-7z" />
    <path d="M12 12v6" />
  </IconBase>
);

export const XCircle = (props) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="m9 9 6 6" />
    <path d="m15 9-6 6" />
  </IconBase>
);

export const Info = (props) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5" />
    <path d="M12 8h.01" />
  </IconBase>
);

export const Maximize = (props) => (
  <IconBase {...props}>
    <path d="M8 3H5a2 2 0 0 0-2 2v3" />
    <path d="M16 3h3a2 2 0 0 1 2 2v3" />
    <path d="M3 16v3a2 2 0 0 0 2 2h3" />
    <path d="M21 16v3a2 2 0 0 1-2 2h-3" />
  </IconBase>
);

export const Sparkles = (props) => (
  <IconBase {...props}>
    <path d="m5 3 1.5 3.5L10 8l-3.5 1.5L5 13 3.5 9.5 0 8l3.5-1.5z" transform="translate(4 2)" />
    <path d="m17 11 1 2 2 1-2 1-1 2-1-2-2-1 2-1z" />
    <path d="m4 15 .8 1.5L7 17l-2.2.5L4 19l-.8-1.5L1 17l2.2-.5z" />
  </IconBase>
);

export const Trash2 = (props) => (
  <IconBase {...props}>
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </IconBase>
);

export const Search = (props) => (
  <IconBase {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </IconBase>
);

export const ExternalLink = (props) => (
  <IconBase {...props}>
    <path d="M18 13v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <path d="m15 3 6 6" />
    <path d="M15 9V3h6" />
  </IconBase>
);

export const TagIcon = (props) => (
  <IconBase {...props}>
    <path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9-7-7a2 2 0 0 1-2-2z" />
    <path d="M7.5 7.5h.01" />
  </IconBase>
);

export const ChevronLeft = (props) => (
  <IconBase {...props}>
    <path d="m14 6-6 6 6 6" />
  </IconBase>
);

export const ChevronRight = (props) => (
  <IconBase {...props}>
    <path d="m10 6 6 6-6 6" />
  </IconBase>
);

export const TimerIcon = Timer;
export const LinkIcon = Link;

export default {
  Mic,
  Square,
  Settings,
  Folder,
  FileText,
  FileCode,
  Cpu,
  Download,
  Timer,
  Waves,
  CheckCircle2,
  AlertCircle,
  Link,
  Upload,
  RefreshCw,
  Bug,
  XCircle,
  Info,
  Maximize,
  Sparkles,
  Trash2,
  Search,
  ExternalLink,
  TagIcon,
  ChevronLeft,
  ChevronRight,
};
