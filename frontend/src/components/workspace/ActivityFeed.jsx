import { useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  FilePlus2,
  MoveRight,
  PenLine,
  PlusCircle,
  UserPlus,
  FolderPlus,
  Trash2,
} from "lucide-react";
import { api, timeAgo } from "@/lib/api";

const ICONS = {
  words_written: [PenLine, "text-blue-700 bg-blue-50"],
  task_completed: [CheckCircle2, "text-emerald-700 bg-emerald-50"],
  task_created: [PlusCircle, "text-slate-700 bg-slate-100"],
  task_moved: [MoveRight, "text-amber-700 bg-amber-50"],
  task_deleted: [Trash2, "text-rose-700 bg-rose-50"],
  resource_added: [FilePlus2, "text-orange-700 bg-orange-50"],
  member_joined: [UserPlus, "text-teal-700 bg-teal-50"],
  workspace_created: [FolderPlus, "text-primary bg-blue-50"],
};

export const ActivityFeed = ({ wsId, tick }) => {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const load = () =>
      api.get(`/workspaces/${wsId}/activity`).then((r) => setItems(r.data));
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [wsId, tick]);

  return (
    <div className="surface p-5 lg:sticky lg:top-24">
      <div className="flex items-center gap-2 mb-4">
        <Activity size={16} className="text-amber-600" />
        <span className="font-display font-bold text-lg">
          Journal de contribution
        </span>
      </div>
      <ul
        data-testid="workspace-activity-feed"
        className="space-y-3 max-h-[60vh] overflow-y-auto pr-1"
      >
        {items.length === 0 && (
          <li className="text-sm text-slate-500">Aucune activité.</li>
        )}
        {items.map((a) => {
          const [Icon, cls] = ICONS[a.type] || [
            Activity,
            "text-slate-600 bg-slate-100",
          ];
          return (
            <li
              key={a.id}
              data-testid={`activity-${a.id}`}
              className="flex gap-3"
            >
              <span
                className={`h-7 w-7 rounded-lg grid place-items-center shrink-0 ${cls}`}
              >
                <Icon size={14} />
              </span>
              <div className="min-w-0">
                <p className="text-sm text-slate-700 leading-snug">
                  {a.message}
                </p>
                <span className="text-[11px] text-slate-400">
                  {timeAgo(a.created_at)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
