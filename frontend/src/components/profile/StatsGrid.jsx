import { BarChart3 } from "lucide-react";

const LABELS = [
  ["docs_shared", "Fiches & scripts partagés"],
  ["tutoring_sessions_completed", "Sessions de tutorat"],
  ["thanks_received", "Mercis reçus"],
  ["docs_validated", "Fiches validées (tuteur)"],
  ["comments", "Commentaires d'entraide"],
  ["tasks_completed", "Tâches de groupe terminées"],
];

export const StatsGrid = ({ stats = {} }) => (
  <div className="surface p-5">
    <div className="flex items-center gap-2 mb-4">
      <BarChart3 size={16} className="text-amber-600" />
      <h3 className="text-lg font-bold">Activité & Entraide ENSAE</h3>
    </div>
    <div
      data-testid="profile-stats"
      className="grid grid-cols-2 sm:grid-cols-3 gap-3"
    >
      {LABELS.map(([k, l]) => (
        <div
          key={k}
          data-testid={`stat-${k}`}
          className="rounded-xl bg-slate-50 border border-slate-200 p-3"
        >
          <div className="font-display text-2xl font-extrabold text-slate-900">
            {stats[k] ?? 0}
          </div>
          <div className="text-xs text-slate-500">{l}</div>
        </div>
      ))}
    </div>
  </div>
);
