import { Link } from "react-router-dom";
import {
  ArrowBigUp,
  MessageSquare,
  GitBranch,
  Sparkles,
  ShieldCheck,
  FileSpreadsheet,
} from "lucide-react";
import { FormatBadge } from "@/components/common";
import { timeAgo } from "@/lib/api";

export const DocCard = ({ doc, index = 0 }) => (
  <Link
    to={`/fiche/${doc.id}`}
    data-testid={`doc-card-${doc.id}`}
    className="group surface p-5 flex flex-col hover:-translate-y-1 hover:shadow-[6px_6px_0_rgba(30,58,138,0.12)] hover:border-primary/40 transition-[transform,box-shadow,border-color] duration-300 fade-up"
    style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
  >
    <div className="flex items-center gap-1.5 flex-wrap">
      <FormatBadge format={doc.format} />
      {doc.is_annale && (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 rounded-md px-2 py-0.5">
          <FileSpreadsheet size={11} /> Annale {doc.annale_year}
        </span>
      )}
      {doc.is_validated && (
        <span
          data-testid={`doc-validated-${doc.id}`}
          title={`Validé par ${doc.validated_by_name}`}
          className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md px-2 py-0.5"
        >
          <ShieldCheck size={11} /> Validé tuteur
        </span>
      )}
      {doc.current_version > 1 && (
        <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-1.5 py-0.5">
          <GitBranch size={11} /> V{doc.current_version}
        </span>
      )}
    </div>
    <div className="text-xs font-medium text-slate-500 mt-2">
      {doc.subject}
      {(doc.filiere || doc.level) &&
        ` · ${doc.filiere ? `${doc.filiere} ${doc.annee || ""}`.trim() : doc.level}`}
    </div>
    <h3 className="mt-1.5 text-lg font-bold text-slate-900 leading-snug group-hover:text-primary transition-colors">
      {doc.title}
    </h3>
    {doc.reason ? (
      <p className="mt-2 text-sm text-slate-700 bg-amber-50/70 border border-amber-100 rounded-lg p-2 flex gap-1.5">
        <Sparkles size={14} className="text-amber-600 shrink-0 mt-0.5" />
        <span>
          <span className="font-semibold text-amber-800">{doc.relevance}%</span>{" "}
          — {doc.reason}
        </span>
      </p>
    ) : (
      <p className="mt-1.5 text-sm text-slate-500 line-clamp-2">
        {doc.abstract || doc.description}
      </p>
    )}
    {doc.concepts?.length > 0 && (
      <div className="flex flex-wrap gap-1 mt-3">
        {doc.concepts.slice(0, 3).map((c) => (
          <span
            key={c}
            className="text-[11px] bg-slate-100 text-slate-600 rounded px-1.5 py-0.5"
          >
            {c}
          </span>
        ))}
      </div>
    )}
    <div className="pt-4 flex items-center gap-4 text-xs text-slate-500 border-t border-dashed border-slate-200 mt-auto">
      <span className="truncate">
        {doc.author_name} · {timeAgo(doc.updated_at)}
      </span>
      <span
        className={`ml-auto flex items-center gap-0.5 font-semibold ${doc.score > 0 ? "text-emerald-600" : doc.score < 0 ? "text-rose-600" : ""}`}
      >
        <ArrowBigUp size={15} /> {doc.score}
      </span>
      <span className="flex items-center gap-1">
        <MessageSquare size={13} /> {doc.comment_count}
      </span>
    </div>
  </Link>
);
