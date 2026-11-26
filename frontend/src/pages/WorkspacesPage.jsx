import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FolderKanban,
  Globe,
  Loader2,
  Lock,
  LogIn,
  Plus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, formatError, timeAgo } from "@/lib/api";
import { EmptyState, Initials, PageHeader } from "@/components/common";

const IMG =
  "https://images.unsplash.com/photo-1523240795612-9a054b0db644?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=900";

const WsCard = ({ ws, i, onJoinPublic }) => {
  const c = ws.task_counts || {};
  const total = (c.todo || 0) + (c.doing || 0) + (c.done || 0);
  const isPromo = ws.type === "promo";
  return (
    <div
      data-testid={`workspace-card-${ws.id}`}
      style={{ animationDelay: `${i * 40}ms` }}
      className="surface p-5 flex flex-col hover:-translate-y-1 hover:shadow-[6px_6px_0_rgba(30,58,138,0.12)] transition-[transform,box-shadow] duration-300 fade-up"
    >
      <div className="flex items-center gap-2 text-xs text-slate-500">
        {isPromo ? (
          <span className="inline-flex items-center gap-1 font-bold text-primary bg-blue-50 border border-blue-200 rounded-md px-2 py-0.5">
            <Globe size={12} /> Amphi public
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-0.5">
            <Lock size={12} /> Projet privé
          </span>
        )}
        <span className="truncate">
          {ws.subject || "Projet"} · {timeAgo(ws.created_at)}
        </span>
      </div>
      <Link to={`/espaces/${ws.id}`}>
        <h3 className="text-xl font-bold text-slate-900 mt-2.5 hover:text-primary transition-colors">
          {ws.name}
        </h3>
      </Link>
      <p className="text-sm text-slate-500 mt-1 line-clamp-2">
        {ws.description}
      </p>
      {!isPromo && (
        <>
          <div className="mt-4 h-2 rounded-full bg-slate-100 overflow-hidden flex">
            <span
              className="bg-emerald-500"
              style={{ width: `${total ? (c.done / total) * 100 : 0}%` }}
            />
            <span
              className="bg-amber-400"
              style={{ width: `${total ? (c.doing / total) * 100 : 0}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {c.done || 0}/{total} tâches terminées
          </div>
        </>
      )}
      {isPromo && (
        <div className="mt-4 text-xs text-slate-500 flex items-center gap-3">
          <span>{ws.members?.length || 0} étudiant(s)</span>
          <span>·</span>
          <span>{ws.binome_count || 0} annonce(s) binôme</span>
        </div>
      )}
      <div className="mt-auto pt-4 flex items-center justify-between gap-2">
        <div className="flex -space-x-2">
          {ws.members.slice(0, 5).map((m) => (
            <Initials key={m.id} name={m.name} />
          ))}
        </div>
        {isPromo && !ws.is_member ? (
          <Button
            size="sm"
            variant="outline"
            data-testid={`workspace-join-public-${ws.id}`}
            onClick={() => onJoinPublic(ws.id)}
            className="rounded-full text-xs"
          >
            Rejoindre l'amphi
          </Button>
        ) : (
          <Button size="sm" asChild className="rounded-full text-xs">
            <Link to={`/espaces/${ws.id}`}>Ouvrir</Link>
          </Button>
        )}
      </div>
    </div>
  );
};

export default function WorkspacesPage() {
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", subject: "" });
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/workspaces").then((r) => setItems(r.data));
  useEffect(() => {
    load();
  }, []);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/workspaces", { ...form, type: "projet" });
      toast.success("Projet privé créé");
      setOpen(false);
      setForm({ name: "", description: "", subject: "" });
      load();
    } catch (err) {
      toast.error(formatError(err));
    } finally {
      setBusy(false);
    }
  };
  const join = async (e) => {
    e.preventDefault();
    try {
      await api.post("/workspaces/join", { code });
      toast.success("Tu as rejoint le projet !");
      setCode("");
      load();
    } catch (err) {
      toast.error(formatError(err));
    }
  };
  const joinPublic = async (wsId) => {
    try {
      await api.post(`/workspaces/${wsId}/join-public`);
      toast.success("Bienvenue dans l'amphi virtuel !");
      load();
    } catch (err) {
      toast.error(formatError(err));
    }
  };

  const promos = (items || []).filter((w) => w.type === "promo");
  const projects = (items || []).filter((w) => w.type !== "promo");

  return (
    <div>
      <PageHeader
        eyebrow="Collaboration ENSAE"
        title="Amphis virtuels & Projets de TD."
        actions={
          <Button
            data-testid="workspace-create-button"
            onClick={() => setOpen(true)}
            className="rounded-full h-11 px-5 shadow-[3px_3px_0_#d97706]"
          >
            <Plus size={16} className="mr-2" /> Nouveau projet TD
          </Button>
        }
      >
        Espaces publics par promotion (ISE 1-5, AS 1-3) avec recherche de
        binômes, et projets privés avec Kanban et notes en direct.
      </PageHeader>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-8">
          {items === null ? (
            <div className="py-20 grid place-items-center">
              <Loader2 className="animate-spin text-primary" />
            </div>
          ) : (
            <>
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Globe size={16} className="text-primary" />
                  <h2 className="text-xl font-bold text-slate-900">
                    Amphis virtuels des promos ({promos.length})
                  </h2>
                </div>
                <div
                  data-testid="promo-workspaces-grid"
                  className="grid sm:grid-cols-2 gap-4"
                >
                  {promos.map((ws, i) => (
                    <WsCard
                      key={ws.id}
                      ws={ws}
                      i={i}
                      onJoinPublic={joinPublic}
                    />
                  ))}
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-3">
                  <FolderKanban size={16} className="text-amber-600" />
                  <h2 className="text-xl font-bold text-slate-900">
                    Mes projets de TD privés ({projects.length})
                  </h2>
                </div>
                {projects.length === 0 ? (
                  <EmptyState
                    testid="workspaces-empty"
                    icon={Users}
                    title="Aucun projet de TD privé"
                    text="Crée un espace pour ton prochain projet R/Python ou rejoins un groupe avec son code d'invitation."
                  />
                ) : (
                  <div
                    data-testid="workspaces-grid"
                    className="grid sm:grid-cols-2 gap-4"
                  >
                    {projects.map((ws, i) => (
                      <WsCard key={ws.id} ws={ws} i={i} />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
        <aside className="lg:col-span-4 space-y-5">
          <form onSubmit={join} className="surface p-5">
            <div className="eyebrow mb-2">Rejoindre un projet privé</div>
            <p className="text-sm text-slate-500 mb-3">
              Demande le code d'invitation à un membre de ton groupe de TD.
            </p>
            <div className="flex gap-2">
              <Input
                data-testid="workspace-join-code-input"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="EX. ENSAE1"
                className="font-mono uppercase"
              />
              <Button
                type="submit"
                data-testid="workspace-join-button"
                disabled={!code.trim()}
                className="rounded-full"
              >
                <LogIn size={15} />
              </Button>
            </div>
          </form>
          <div className="rounded-2xl overflow-hidden relative h-56">
            <img
              src={IMG}
              alt="Étudiants en groupe"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent" />
            <p className="absolute bottom-4 left-4 right-4 text-white text-sm font-medium">
              Trouve un binôme dans l'amphi virtuel de ta promo, puis passe en
              projet privé pour le Kanban et les notes en direct.
            </p>
          </div>
        </aside>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="workspace-create-modal">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              Nouveau projet de TD privé
            </DialogTitle>
            <DialogDescription>
              Ex. « Projet Économétrie R », « Mémoire de fin d'études ».
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={create} className="space-y-4">
            <div>
              <Label>Nom du projet</Label>
              <Input
                data-testid="workspace-name-input"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Matière</Label>
              <Input
                data-testid="workspace-subject-input"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="mt-1.5"
                placeholder="Économétrie, Séries temporelles…"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                data-testid="workspace-description-input"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={3}
                className="mt-1.5"
              />
            </div>
            <Button
              type="submit"
              data-testid="workspace-create-submit"
              disabled={busy}
              className="w-full rounded-full h-11"
            >
              Créer le projet privé
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
