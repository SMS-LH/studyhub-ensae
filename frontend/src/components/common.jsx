import { avatarUrl } from "@/lib/api";
import {
  FileText,
  FileType2,
  Presentation,
  Video,
  Code2,
  File,
  NotebookText,
  GraduationCap,
  Table2,
  ShieldCheck,
  Clock,
} from "lucide-react";

export const ENSAE_CLASSES = [
  "ISEP1",
  "ISEP2",
  "ISE1-Cycle Long",
  "ISE1 Math",
  "ISE1 Eco",
  "ISE2",
  "ISE3",
  "AS1",
  "AS2",
  "AS3",
];

export const ENSAE_FILIERES = {
  ISE: [1, 2, 3, 4, 5],
  AS: [1, 2, 3],
};

export const SUBJECTS = [
  "Probabilités",
  "Statistique mathématique",
  "Économétrie",
  "Macroéconomie",
  "Microéconomie",
  "Séries temporelles",
  "Machine Learning / Data Science",
  "Logiciel R",
  "Python / Data",
  "SAS / Stata",
  "Algèbre linéaire",
  "Sondages",
  "Démographie",
  "Comptabilité nationale",
  "Autre",
];

export const LEVELS = [
  "ISE 1",
  "ISE 2",
  "ISE 3",
  "ISE 4",
  "ISE 5",
  "AS 1",
  "AS 2",
  "AS 3",
];

export const FORMATS = {
  pdf: {
    label: "PDF",
    icon: FileText,
    cls: "bg-rose-50 text-rose-700 border-rose-200",
  },
  word: {
    label: "Word",
    icon: FileType2,
    cls: "bg-blue-50 text-blue-700 border-blue-200",
  },
  powerpoint: {
    label: "PowerPoint",
    icon: Presentation,
    cls: "bg-orange-50 text-orange-700 border-orange-200",
  },
  video: {
    label: "Vidéo",
    icon: Video,
    cls: "bg-violet-50 text-violet-700 border-violet-200",
  },
  code: {
    label: "Code R/Py",
    icon: Code2,
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  dataset: {
    label: "Données CSV/XLSX",
    icon: Table2,
    cls: "bg-teal-50 text-teal-700 border-teal-200",
  },
  texte: {
    label: "Texte",
    icon: NotebookText,
    cls: "bg-slate-100 text-slate-700 border-slate-200",
  },
};

export const ACCEPT =
  ".pdf,.doc,.docx,.odt,.ppt,.pptx,.odp,.mp4,.webm,.mov,.mkv,.m4v,.txt,.md,.csv,.xlsx,.py,.r,.R,.rmd,.Rmd,.qmd,.do,.sas,.jl,.js,.jsx,.ts,.tsx,.java,.c,.cpp,.h,.hpp,.cs,.go,.rs,.rb,.php,.sql,.m,.swift,.kt,.scala,.sh,.html,.css,.json,.ipynb,.tex";

export const EnsaeLogo = ({ className = "h-9 w-9" }) => (
  <span
    className={`${className} rounded-xl bg-primary text-white grid place-items-center shadow-[3px_3px_0_#d97706] shrink-0`}
  >
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18h18" />
      <path d="M5 15c2.5-6 4.5-9 7-9s4.5 3 7 9" className="stroke-amber-300" />
      <circle cx="12" cy="6" r="1.4" className="fill-amber-300 stroke-amber-300" />
    </svg>
  </span>
);

export const EnsaeBadge = ({
  class_name,
  filiere,
  annee,
  isTutor,
  isParallel,
  verificationStatus,
  className = "",
}) => {
  const label = class_name || (filiere ? `${filiere}${annee ? ` ${annee}` : ""}` : "");
  if (!label && !isTutor && !isParallel) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
      {label && (
        <span className="text-[11px] font-bold bg-blue-900 text-white rounded-md px-2 py-0.5">
          {label}
        </span>
      )}
      {isParallel && (
        <span className="text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md px-2 py-0.5">
          Admission parallèle
        </span>
      )}
      {isTutor && (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 rounded-md px-2 py-0.5">
          <GraduationCap size={11} /> Tuteur
        </span>
      )}
      {verificationStatus === "pending" && (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-300 rounded-md px-2 py-0.5">
          <Clock size={11} /> En attente BDE
        </span>
      )}
      {verificationStatus === "verified" && (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md px-2 py-0.5">
          <ShieldCheck size={11} /> Vérifié ENSAE
        </span>
      )}
    </span>
  );
};

export const FormatBadge = ({ format, size = "sm" }) => {
  const f = FORMATS[format] || {
    label: "Fichier",
    icon: File,
    cls: "bg-slate-100 text-slate-700 border-slate-200",
  };
  const Icon = f.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 border rounded-md font-medium ${f.cls} ${size === "lg" ? "px-2.5 py-1 text-sm" : "px-2 py-0.5 text-xs"}`}
    >
      <Icon size={size === "lg" ? 15 : 12} /> {f.label}
    </span>
  );
};

const COLORS = [
  "bg-blue-900",
  "bg-amber-600",
  "bg-emerald-600",
  "bg-rose-600",
  "bg-sky-700",
  "bg-orange-600",
  "bg-teal-700",
];

export const Initials = ({
  name = "?",
  className = "h-8 w-8",
  testid,
  userId,
  avatarV,
}) => {
  if (userId && avatarV)
    return (
      <img
        data-testid={testid}
        src={avatarUrl(userId, avatarV)}
        alt={name}
        title={name}
        className={`${className} rounded-full object-cover ring-2 ring-white shrink-0`}
      />
    );
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const color =
    COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
  return (
    <span
      data-testid={testid}
      title={name}
      className={`${color} ${className} rounded-full text-white grid place-items-center text-xs font-bold ring-2 ring-white shrink-0`}
    >
      {initials}
    </span>
  );
};

export const PageHeader = ({ eyebrow, title, children, actions }) => (
  <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8 fade-up">
    <div className="max-w-2xl">
      {eyebrow && <div className="eyebrow mb-3">{eyebrow}</div>}
      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 leading-[1.05]">
        {title}
      </h1>
      {children && (
        <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
          {children}
        </p>
      )}
    </div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </div>
);

export const EmptyState = ({ icon: Icon, title, text, testid, children }) => (
  <div data-testid={testid} className="surface border-dashed p-10 text-center">
    {Icon && <Icon className="mx-auto text-slate-400 mb-3" size={32} />}
    <div className="font-display font-bold text-lg text-slate-800">{title}</div>
    {text && (
      <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">{text}</p>
    )}
    {children && <div className="mt-4">{children}</div>}
  </div>
);
