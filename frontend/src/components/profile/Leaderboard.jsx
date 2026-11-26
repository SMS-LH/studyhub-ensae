import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Medal } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Initials } from "@/components/common";

const RANK = [
  "bg-amber-400 text-white",
  "bg-slate-300 text-slate-700",
  "bg-orange-300 text-white",
];

export const Leaderboard = () => {
  const { user } = useAuth();
  const [scope, setScope] = useState("all");
  const [rows, setRows] = useState([]);
  useEffect(() => {
    api.get("/leaderboard", { params: { scope } }).then((r) => setRows(r.data));
  }, [scope]);

  return (
    <div className="surface p-5">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Medal size={16} className="text-amber-600" />
        <h3 className="text-lg font-bold">Classement ENSAE</h3>
        <div className="ml-auto flex text-[11px] bg-slate-100 rounded-full p-0.5">
          {[
            ["all", "Tous"],
            ["ISE", "ISE"],
            ["AS", "AS"],
          ].map(([k, l]) => (
            <button
              key={k}
              data-testid={`leaderboard-scope-${k}`}
              onClick={() => setScope(k)}
              className={`px-2.5 py-1 rounded-full font-semibold ${scope === k ? "bg-white shadow text-primary" : "text-slate-500"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <ol data-testid="leaderboard-list" className="space-y-1">
        {rows.map((r) => (
          <li key={r.id}>
            <Link
              to={`/profil/${r.id}`}
              data-testid={`leaderboard-row-${r.id}`}
              className={`flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50 ${r.id === user.id ? "bg-blue-50/60" : ""}`}
            >
              <span
                className={`h-6 w-6 rounded-full grid place-items-center text-[11px] font-bold ${RANK[r.rank - 1] || "bg-slate-100 text-slate-500"}`}
              >
                {r.rank}
              </span>
              <Initials
                name={r.name}
                userId={r.id}
                avatarV={r.avatar_v}
                className="h-8 w-8"
              />
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-semibold truncate">
                  <span className="truncate">{r.name}</span>
                  {r.filiere && (
                    <span className="text-[10px] font-bold bg-slate-100 text-slate-700 rounded px-1.5 py-0.5 shrink-0">
                      {r.filiere} {r.annee || ""}
                    </span>
                  )}
                </span>
                <span className="block text-[11px] text-slate-500 truncate">
                  {r.level.title} · {r.badges} badge(s)
                </span>
              </span>
              <span className="font-mono text-sm font-bold text-primary">
                {r.xp}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
};
