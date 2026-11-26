import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Initials } from "@/components/common";

const Stat = ({ label, value }) => (
  <div>
    <div className="font-display text-xl font-bold text-slate-900">{value}</div>
    <div className="text-[11px] text-slate-500">{label}</div>
  </div>
);

export const ContributionPanel = ({ wsId, tick }) => {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    api.get(`/workspaces/${wsId}/contributions`).then((r) => setRows(r.data));
  }, [wsId, tick]);
  const fair = rows.length ? 100 / rows.length : 0;

  return (
    <div data-testid="contribution-panel" className="space-y-3">
      <p className="text-sm text-slate-500">
        Points : 1 par tranche de 50 mots écrits, 5 par tâche terminée, 3 par
        ressource, 2 par tâche créée, 1 par déplacement.
      </p>
      {rows.map((r) => {
        const low = rows.length > 1 && r.share < fair / 2;
        return (
          <div
            key={r.user_id}
            data-testid={`contribution-${r.user_id}`}
            className={`surface p-5 ${low ? "border-rose-200" : ""}`}
          >
            <div className="flex items-center gap-3">
              <Initials name={r.name} className="h-10 w-10" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    to={`/profil/${r.user_id}`}
                    className="font-semibold text-slate-900 hover:text-primary"
                  >
                    {r.name}
                  </Link>
                  {low && (
                    <span
                      data-testid={`contribution-low-${r.user_id}`}
                      className="text-[11px] font-semibold text-rose-700 bg-rose-100 rounded px-1.5 py-0.5 flex items-center gap-1"
                    >
                      <AlertTriangle size={11} /> Participation faible
                    </span>
                  )}
                </div>
                <div className="mt-2 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-[width] duration-700"
                    style={{ width: `${r.share}%` }}
                  />
                </div>
              </div>
              <div className="text-right">
                <div className="font-display text-2xl font-extrabold text-primary">
                  {r.share}%
                </div>
                <div className="text-[11px] text-slate-500">{r.points} pts</div>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-2 mt-4 pt-4 border-t border-dashed border-slate-200">
              <Stat label="mots écrits" value={r.words_written} />
              <Stat label="tâches terminées" value={r.tasks_completed} />
              <Stat label="ressources" value={r.resources_added} />
              <Stat label="tâches créées" value={r.tasks_created} />
              <Stat label="en cours assignées" value={r.assigned_open} />
            </div>
          </div>
        );
      })}
    </div>
  );
};
