import { Briefcase, Plus, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const SkillsCard = ({ skills = [], weaknesses = [], isMe, onEdit }) => (
  <div className="surface p-5 space-y-4">
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Briefcase size={16} className="text-amber-600" />
        <h3 className="text-lg font-bold">Points forts & Compétences</h3>
      </div>
      {skills.length === 0 ? (
        <div className="text-sm text-slate-500">
          Aucune compétence renseignée.
          {isMe && (
            <Button
              size="sm"
              variant="outline"
              data-testid="skills-add-button"
              onClick={onEdit}
              className="rounded-full mt-3 w-full"
            >
              <Plus size={13} className="mr-1" /> Ajouter mes compétences
            </Button>
          )}
        </div>
      ) : (
        <ul data-testid="profile-skills" className="space-y-2">
          {skills.map((s, i) => (
            <li
              key={i}
              data-testid={`skill-${i}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2"
            >
              <span className="font-medium text-sm text-slate-800">{s.name}</span>
              {s.level && (
                <span className="text-xs font-semibold text-primary bg-blue-50 rounded px-2 py-0.5">
                  {s.level}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
    {weaknesses?.length > 0 && (
      <div className="pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 mb-2">
          <AlertCircle size={13} /> Matières à renforcer
        </div>
        <div className="flex flex-wrap gap-1.5">
          {weaknesses.map((w) => (
            <span
              key={w}
              className="text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded-full px-2.5 py-0.5"
            >
              {w}
            </span>
          ))}
        </div>
      </div>
    )}
  </div>
);
