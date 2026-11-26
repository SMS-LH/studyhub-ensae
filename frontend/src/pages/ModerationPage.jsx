import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserX,
  BarChart3,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, formatError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { EmptyState, Initials, PageHeader } from "@/components/common";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

/* ─── Reports Tab ─────────────────────────────────────────── */
function ReportsTab() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/moderation/reports?status=open");
      setReports(data);
    } catch (e) {
      toast.error(formatError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resolve = async (id, action) => {
    try {
      await api.post(`/moderation/reports/${id}/resolve`, { action });
      toast.success(action === "dismiss" ? "Signalement ignoré" : "Contenu supprimé");
      load();
    } catch (e) {
      toast.error(formatError(e));
    }
  };

  if (loading)
    return (
      <div className="py-16 grid place-items-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );

  if (reports.length === 0)
    return (
      <EmptyState
        icon={CheckCircle2}
        title="Aucun signalement en attente"
        text="Tout est clean ! Revenez si de nouveaux signalements arrivent."
      />
    );

  return (
    <div className="space-y-3">
      {reports.map((r) => (
        <div key={r.id} className="surface p-5 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 rounded px-2 py-0.5">
                {r.target_type === "document"
                  ? "Fiche"
                  : r.target_type === "forum_post"
                    ? "Post forum"
                    : "Utilisateur"}
              </span>
              <span className="text-xs text-slate-500">
                Signalé par <strong>{r.reporter_name}</strong>
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-900 truncate">
              {r.target_title || r.target_id}
            </p>
            <p className="text-sm text-slate-600 mt-1 line-clamp-2">{r.reason}</p>
          </div>
          <div className="flex gap-2 items-start shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => resolve(r.id, "dismiss")}
              className="rounded-full text-slate-600"
            >
              <CheckCircle2 size={13} className="mr-1" /> Ignorer
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => resolve(r.id, "delete_content")}
              className="rounded-full"
            >
              <Trash2 size={13} className="mr-1" /> Supprimer
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Users Tab ───────────────────────────────────────────── */
function UsersTab() {
  const { user: currentUser } = useAuth();
  const isGlobalMod = ["moderator", "admin"].includes(currentUser?.role);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/moderation/users");
      setUsers(data);
    } catch (e) {
      toast.error(formatError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const verify = async (id, approved) => {
    try {
      await api.post(`/moderation/users/${id}/verify?approved=${approved}`);
      toast.success(approved ? "Étudiant vérifié ✓" : "Vérification refusée");
      load();
    } catch (e) {
      toast.error(formatError(e));
    }
  };

  const setUserRole = async (id, role) => {
    try {
      await api.post(`/moderation/users/${id}/role`, { role });
      toast.success(
        role === "moderator"
          ? "Modérateur BDE promu"
          : role === "class_admin"
            ? "Délégué de classe nommé"
            : "Rôle réinitialisé (étudiant)",
      );
      load();
    } catch (e) {
      toast.error(formatError(e));
    }
  };

  const deleteUser = async (u) => {
    if (
      !window.confirm(
        `Supprimer définitivement le compte de ${u.name} (${u.email}) ?`,
      )
    )
      return;
    try {
      await api.delete(`/moderation/users/${u.id}`);
      toast.success("Utilisateur supprimé");
      load();
    } catch (e) {
      toast.error(formatError(e));
    }
  };

  if (loading)
    return (
      <div className="py-16 grid place-items-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );

  const pending = users.filter((u) => u.verification_status === "pending");
  const others = users.filter((u) => u.verification_status !== "pending");

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-amber-700 mb-3 flex items-center gap-2">
            <AlertTriangle size={14} /> {pending.length} étudiant(s) en attente de vérification
          </h3>
          <div className="space-y-2">
            {pending.map((u) => (
              <UserRow
                key={u.id}
                u={u}
                currentUser={currentUser}
                isGlobalMod={isGlobalMod}
                onVerify={verify}
                onSetRole={setUserRole}
                onDelete={deleteUser}
              />
            ))}
          </div>
        </div>
      )}
      {others.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-slate-500 mb-3 flex items-center gap-2">
            <Users size={14} /> Tous les étudiants ({others.length})
          </h3>
          <div className="space-y-2">
            {others.map((u) => (
              <UserRow
                key={u.id}
                u={u}
                currentUser={currentUser}
                isGlobalMod={isGlobalMod}
                onVerify={verify}
                onSetRole={setUserRole}
                onDelete={deleteUser}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UserRow({ u, currentUser, isGlobalMod, onVerify, onSetRole, onDelete }) {
  const isMod = u.role === "moderator" || u.role === "admin";
  const isClassAdmin = u.role === "class_admin";
  const clsLabel = u.class_name || (u.filiere ? `${u.filiere} ${u.annee}` : "");
  return (
    <div className="surface p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <Initials name={u.name} className="h-9 w-9 text-sm shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-slate-900">{u.name}</div>
        <div className="text-xs text-slate-500 truncate">{u.email}</div>
        <div className="flex gap-1 mt-1 flex-wrap">
          {clsLabel && (
            <span className="text-[10px] bg-blue-50 border border-blue-200 text-primary rounded px-1.5 py-0.5">
              {clsLabel}
            </span>
          )}
          {u.is_verified && (
            <span className="text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-700 rounded px-1.5 py-0.5 flex items-center gap-0.5">
              <ShieldCheck size={10} /> Vérifié
            </span>
          )}
          {u.verification_status === "pending" && (
            <span className="text-[10px] bg-amber-50 border border-amber-200 text-amber-700 rounded px-1.5 py-0.5">
              En attente
            </span>
          )}
          {isClassAdmin && (
            <Badge className="text-[10px] h-5 bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100">
              Délégué de classe
            </Badge>
          )}
          {isMod && (
            <Badge className="text-[10px] h-5 bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100">
              Modérateur BDE
            </Badge>
          )}
        </div>
      </div>
      <div className="flex gap-2 flex-wrap shrink-0">
        {u.verification_status === "pending" && (
          <>
            <Button
              size="sm"
              className="rounded-full h-8 px-3 text-xs"
              onClick={() => onVerify(u.id, true)}
            >
              <UserCheck size={12} className="mr-1" /> Valider
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full h-8 px-3 text-xs text-rose-600"
              onClick={() => onVerify(u.id, false)}
            >
              <UserX size={12} className="mr-1" /> Refuser
            </Button>
          </>
        )}
        {u.role !== "admin" && (
          <>
            <Button
              size="sm"
              variant="ghost"
              className={`rounded-full h-8 px-3 text-xs ${isClassAdmin ? "text-slate-500" : "text-primary"}`}
              onClick={() => onSetRole(u.id, isClassAdmin ? "student" : "class_admin")}
            >
              {isClassAdmin ? "Retirer délégué" : "Nommer délégué"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className={`rounded-full h-8 px-3 text-xs ${isMod ? "text-slate-500" : "text-purple-600"}`}
              onClick={() => onSetRole(u.id, isMod ? "student" : "moderator")}
            >
              {isMod ? "Retirer modérateur" : "Promouvoir modérateur"}
            </Button>
            {isGlobalMod && u.id !== currentUser?.id && (
              <Button
                size="sm"
                variant="ghost"
                title="Supprimer cet utilisateur"
                className="rounded-full h-8 px-3 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                onClick={() => onDelete(u)}
              >
                <Trash2 size={12} className="mr-1" /> Supprimer
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Stats Tab ───────────────────────────────────────────── */
function StatsTab() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/moderation/stats")
      .then(({ data }) => setStats(data))
      .catch((e) => toast.error(formatError(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="py-16 grid place-items-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Étudiants inscrits", value: stats.total_users, color: "text-primary bg-blue-50" },
          { label: "Documents partagés", value: stats.total_documents, color: "text-amber-700 bg-amber-50" },
          { label: "Tuteurs actifs", value: stats.tutors_count, color: "text-emerald-700 bg-emerald-50" },
          { label: "Signalements ouverts", value: stats.open_reports, color: "text-rose-700 bg-rose-50" },
        ].map(({ label, value, color }) => (
          <div key={label} className="surface p-4 flex flex-col gap-1">
            <span
              className={`font-display text-3xl font-extrabold ${color.split(" ")[0]}`}
            >
              {value}
            </span>
            <span className="text-xs text-slate-500">{label}</span>
          </div>
        ))}
      </div>

      {/* By Promo */}
      {stats.by_promo && stats.by_promo.length > 0 && (
        <div className="surface p-5">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-primary" /> Étudiants par filière &
            niveau
          </h3>
          <div className="space-y-2">
            {stats.by_promo.map(({ promo, count }) => (
              <div key={promo} className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-700 w-24 shrink-0">
                  {promo}
                </span>
                <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-primary h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (count / (stats.total_users || 1)) * 100 * 3)}%`,
                    }}
                  />
                </div>
                <span className="text-sm font-bold text-slate-900 w-6 text-right">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top subjects */}
      {stats.top_subjects && stats.top_subjects.length > 0 && (
        <div className="surface p-5">
          <h3 className="font-bold text-slate-900 mb-4">📚 Matières les plus partagées</h3>
          <div className="flex flex-wrap gap-2">
            {stats.top_subjects.map(({ subject, count }) => (
              <span
                key={subject}
                className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-primary rounded-full px-3 py-1 text-sm font-medium"
              >
                {subject}
                <span className="bg-primary text-white text-[10px] font-bold rounded-full px-1.5">
                  {count}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Top tutors */}
      {stats.top_tutors && stats.top_tutors.length > 0 && (
        <div className="surface p-5">
          <h3 className="font-bold text-slate-900 mb-4">🏆 Top tuteurs</h3>
          <ol className="space-y-2">
            {stats.top_tutors.map((t, i) => (
              <li key={t.id} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 text-xs font-bold grid place-items-center shrink-0">
                  {i + 1}
                </span>
                <Initials name={t.name} className="h-8 w-8 text-sm" />
                <span className="font-medium text-sm text-slate-900 flex-1">{t.name}</span>
                <span className="text-xs text-slate-500">
                  {t.sessions} session(s) · {t.avg_rating != null ? t.avg_rating.toFixed(1) : "—"} ★
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

/* ─── ModerationPage ─────────────────────────────────────── */
export default function ModerationPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const isMod = ["moderator", "admin", "class_admin"].includes(user?.role);

  useEffect(() => {
    if (!isMod) {
      toast.error("Accès réservé aux modérateurs BDE.");
      navigate("/bibliotheque");
    }
  }, [isMod, navigate]);

  if (!isMod) return null;

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow="Tableau de bord BDE · ENSAE"
        title="Modération & statistiques de l'école."
      >
        Validez les inscriptions, traitez les signalements et consultez les statistiques
        de la plateforme.
      </PageHeader>

      <Tabs defaultValue="reports">
        <TabsList className="rounded-full mb-6 flex-wrap h-auto">
          <TabsTrigger value="reports" className="rounded-full">
            <AlertTriangle size={14} className="mr-1.5" /> Signalements
          </TabsTrigger>
          <TabsTrigger value="users" className="rounded-full">
            <Users size={14} className="mr-1.5" /> Utilisateurs
          </TabsTrigger>
          <TabsTrigger value="stats" className="rounded-full">
            <BarChart3 size={14} className="mr-1.5" /> Statistiques
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reports">
          <ReportsTab />
        </TabsContent>
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
        <TabsContent value="stats">
          <StatsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
