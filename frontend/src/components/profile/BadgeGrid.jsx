import {
  Award,
  Bug,
  Code2,
  FileCheck2,
  GitBranch,
  GraduationCap,
  Library,
  Lock,
  PenLine,
  Star,
  Trophy,
  Upload,
  Users,
} from "lucide-react";

const ICONS = {
  upload: Upload,
  code: Code2,
  filecheck: FileCheck2,
  graduation: GraduationCap,
  library: Library,
  star: Star,
  users: Users,
  branch: GitBranch,
  bug: Bug,
  pen: PenLine,
  trophy: Trophy,
};

export const BadgeGrid = ({ badges }) => (
  <div className="surface p-5">
    <div className="flex items-center gap-2 mb-4">
      <Award size={16} className="text-amber-600" />
      <h3 className="text-lg font-bold">Badges ENSAE</h3>
      <span className="text-xs text-slate-500 ml-auto">
        {badges.filter((b) => b.unlocked).length} / {badges.length} débloqués
      </span>
    </div>
    <div
      data-testid="profile-badges"
      className="grid grid-cols-2 sm:grid-cols-4 gap-3"
    >
      {badges.map((b) => {
        const Icon = ICONS[b.icon] || Award;
        return (
          <div
            key={b.id}
            data-testid={`badge-${b.id}`}
            data-unlocked={b.unlocked}
            title={b.description}
            className={`rounded-xl border p-3 text-center transition-transform duration-200 hover:-translate-y-0.5 ${b.unlocked ? "border-amber-300 bg-gradient-to-b from-amber-50 to-white" : "border-slate-200 bg-slate-50"}`}
          >
            <div
              className={`mx-auto h-12 w-12 rounded-full grid place-items-center ${b.unlocked ? "bg-amber-500 text-white shadow-[3px_3px_0_#1e3a8a]" : "bg-slate-200 text-slate-400"}`}
            >
              {b.unlocked ? <Icon size={20} /> : <Lock size={16} />}
            </div>
            <div
              className={`text-sm font-bold mt-2 leading-tight ${b.unlocked ? "text-slate-900" : "text-slate-500"}`}
            >
              {b.name}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 leading-snug">
              {b.description}
            </div>
            {!b.unlocked && (
              <div className="mt-2 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${(b.progress / b.goal) * 100}%` }}
                />
              </div>
            )}
            {!b.unlocked && (
              <div className="text-[10px] font-mono text-slate-400 mt-1">
                {b.progress} / {b.goal}
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
);
