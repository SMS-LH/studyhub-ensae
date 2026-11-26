import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarClock,
  CheckCircle2,
  GraduationCap,
  HelpCircle,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Send,
  Star,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, formatError, timeAgo } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  EmptyState,
  EnsaeBadge,
  ENSAE_CLASSES,
  Initials,
  PageHeader,
  SUBJECTS,
} from "@/components/common";

const STATUS_META = {
  open: { label: "En attente", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  accepted: { label: "Planifiée", cls: "bg-blue-50 text-primary border-blue-200" },
  completed: { label: "Terminée", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelled: { label: "Annulée", cls: "bg-slate-100 text-slate-500 border-slate-200" },
};

const Stars = ({ value, onChange }) => (
  <div className="flex items-center gap-1">
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        key={n}
        type="button"
        data-testid={`rate-star-${n}`}
        onClick={() => onChange(n)}
        className="p-0.5"
      >
        <Star
          size={22}
          className={
            n <= value
              ? "fill-amber-400 text-amber-500"
              : "text-slate-300 hover:text-amber-300"
          }
        />
      </button>
    ))}
  </div>
);

const SessionChat = ({ reqId }) => {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  useEffect(() => {
    api.get(`/tutoring/requests/${reqId}/messages`).then((r) => setMsgs(r.data));
  }, [reqId]);
  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      const { data } = await api.post(`/tutoring/requests/${reqId}/messages`, {
        text,
      });
      setMsgs([...msgs, data]);
      setText("");
    } catch (err) {
      toast.error(formatError(err));
    }
  };
  return (
    <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
      <div className="max-h-40 overflow-y-auto space-y-1.5">
        {msgs.length === 0 ? (
          <p className="text-xs text-slate-400">
            Aucun message — propose un créneau ou un lien visio.
          </p>
        ) : (
          msgs.map((m) => (
            <div key={m.id} className="text-xs bg-slate-50 rounded-lg px-3 py-1.5">
              <span className="font-semibold text-slate-800">{m.user_name} : </span>
              <span className="text-slate-600">{m.text}</span>
            </div>
          ))
        )}
      </div>
      <form onSubmit={send} className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message pour la session…"
          className="h-8 text-xs"
        />
        <Button type="submit" size="sm" className="h-8 rounded-full px-3">
          <Send size={12} />
        </Button>
      </form>
    </div>
  );
};

export default function TutoringPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [tutors, setTutors] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [dirFiliere, setDirFiliere] = useState("all");
  const [dirSearch, setDirSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [rateTarget, setRateTarget] = useState(null);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const [chatOpenId, setChatOpenId] = useState(null);
  const [form, setForm] = useState({
    subject: "Économétrie",
    title: "",
    description: "",
    preferred_date: "",
    mode: "visio",
    slot_label: "",
    target_tutor_id: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const reqParams = subjectFilter !== "all" ? { subject: subjectFilter } : {};
      const dirParams = {
        ...(dirFiliere !== "all" ? { class_name: dirFiliere } : {}),
        ...(dirSearch.trim() ? { q: dirSearch.trim() } : {}),
      };
      const [r1, r2, r3] = await Promise.all([
        api.get("/tutoring/requests", { params: reqParams }),
        api.get("/tutoring/tutors", { params: reqParams }),
        api.get("/auth/users", { params: dirParams }),
      ]);
      setRequests(r1.data);
      setTutors(r2.data);
      setDirectory(r3.data);
    } catch (e) {
      toast.error(formatError(e));
    } finally {
      setLoading(false);
    }
  }, [subjectFilter, dirFiliere, dirSearch]);

  useEffect(() => {
    load();
  }, [load]);

  const submitRequest = async (e) => {
    e.preventDefault();
    try {
      await api.post("/tutoring/requests", {
        ...form,
        target_tutor_id: form.target_tutor_id || null,
      });
      toast.success("Demande publiée ! Les tuteurs correspondants ont été notifiés.");
      setCreateOpen(false);
      setForm({
        subject: "Économétrie",
        title: "",
        description: "",
        preferred_date: "",
        mode: "visio",
        slot_label: "",
        target_tutor_id: "",
      });
      load();
    } catch (err) {
      toast.error(formatError(err));
    }
  };

  const accept = async (req) => {
    try {
      await api.post(`/tutoring/requests/${req.id}/accept`, {
        scheduled_at: req.preferred_date || "",
      });
      toast.success("Tu accompagnes cet étudiant ! Il a été notifié.");
      load();
    } catch (err) {
      toast.error(formatError(err));
    }
  };

  const complete = async (reqId) => {
    try {
      await api.post(`/tutoring/requests/${reqId}/complete`);
      toast.success("Session marquée comme terminée !");
      load();
    } catch (err) {
      toast.error(formatError(err));
    }
  };

  const thankTutor = async (tutorId) => {
    try {
      const { data } = await api.post(`/tutoring/tutors/${tutorId}/thank`);
      setTutors((ts) =>
        ts.map((t) =>
          t.id === tutorId
            ? { ...t, thanked_by_me: data.thanked, thanks_count: data.thanks_count }
            : t,
        ),
      );
      toast.success(data.thanked ? "Merci envoyé au tuteur !" : "Merci retiré");
    } catch (err) {
      toast.error(formatError(err));
    }
  };

  const toggleAvailability = async () => {
    try {
      const { data } = await api.post("/tutoring/availability");
      toast.success(
        data.tutor_available_this_week
          ? "Tu es maintenant indiqué comme disponible cette semaine"
          : "Statut mis en indisponible cette semaine",
      );
      load();
    } catch (err) {
      toast.error(formatError(err));
    }
  };

  const submitRating = async (e) => {
    e.preventDefault();
    if (!rateTarget) return;
    try {
      await api.post(`/tutoring/requests/${rateTarget.id}/rate`, {
        rating,
        review,
      });
      toast.success("Merci pour ton évaluation !");
      setRateTarget(null);
      setReview("");
      setRating(5);
      load();
    } catch (err) {
      toast.error(formatError(err));
    }
  };

  const openRequests = requests.filter((r) => r.status === "open");
  const mySessions = requests.filter(
    (r) => r.student_id === user.id || r.tutor_id === user.id,
  );

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow="Tutorat École · Toutes classes ENSAE"
        title="Entraide ouverte entre toutes les promotions."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              data-testid="tutoring-new-request-button"
              onClick={() => setCreateOpen(true)}
              className="rounded-full h-11 px-5 shadow-[3px_3px_0_#d97706]"
            >
              <Plus size={16} className="mr-2" /> Demander de l'aide
            </Button>
          </div>
        }
      >
        Accès libre aux tuteurs de toutes les classes (ISE & AS) avec leurs
        contacts directs, disponibilités et matières fortes.
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
          <SelectTrigger
            data-testid="tutoring-subject-filter"
            className="w-60 h-10 bg-white rounded-full"
          >
            <SelectValue placeholder="Toutes les matières" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les matières</SelectItem>
            {SUBJECTS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="requests">
        <TabsList className="rounded-full mb-6 flex-wrap h-auto">
          <TabsTrigger value="requests" data-testid="tutoring-tab-requests" className="rounded-full">
            Demandes ouvertes ({openRequests.length})
          </TabsTrigger>
          <TabsTrigger value="tutors" data-testid="tutoring-tab-tutors" className="rounded-full">
            Tuteurs ({tutors.length})
          </TabsTrigger>
          <TabsTrigger value="sessions" data-testid="tutoring-tab-sessions" className="rounded-full">
            Mes sessions ({mySessions.length})
          </TabsTrigger>
          <TabsTrigger value="directory" data-testid="tutoring-tab-directory" className="rounded-full">
            Annuaire ENSAE ({directory.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
          {loading ? (
            <div className="py-16 grid place-items-center">
              <Loader2 className="animate-spin text-primary" />
            </div>
          ) : openRequests.length === 0 ? (
            <EmptyState
              icon={HelpCircle}
              title="Aucune demande en attente"
              text="Tu bloques sur un TD de Probabilités ou d'Économétrie ? Poste la première demande."
            />
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {openRequests.map((req) => (
                <div
                  key={req.id}
                  data-testid={`tutoring-request-${req.id}`}
                  className="surface p-5 flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="text-xs font-bold bg-blue-50 text-primary border border-blue-200 rounded-md px-2 py-0.5">
                        {req.subject}
                      </span>
                      {req.student_level && (
                        <span className="text-xs font-semibold bg-slate-900 text-white rounded-md px-2 py-0.5">
                          {req.student_level}
                        </span>
                      )}
                      <span className="text-xs text-slate-400 ml-auto">
                        {timeAgo(req.created_at)}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {req.title}
                    </h3>
                    {req.description && (
                      <p className="text-sm text-slate-600 mt-1.5">
                        {req.description}
                      </p>
                    )}
                    {req.preferred_date && (
                      <div className="flex items-center gap-1.5 text-xs text-amber-700 mt-2">
                        <CalendarClock size={13} /> Souhaité : {req.preferred_date}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <Link
                      to={`/profil/${req.student_id}`}
                      className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-primary"
                    >
                      <Initials name={req.student_name} className="h-7 w-7" />
                      {req.student_name}
                    </Link>
                    {req.student_id !== user.id && (
                      <Button
                        size="sm"
                        data-testid={`tutoring-accept-${req.id}`}
                        onClick={() => accept(req)}
                        className="rounded-full"
                      >
                        <GraduationCap size={14} className="mr-1.5" /> Aider (Accepter)
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tutors">
          {tutors.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title="Aucun tuteur dans cette matière"
              text="Active l'option Tuteur depuis ton profil pour aider les promos plus jeunes !"
            />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {tutors.map((t) => (
                <div
                  key={t.id}
                  data-testid={`tutor-card-${t.id}`}
                  className="surface p-5 flex flex-col gap-3"
                >
                  <div className="flex items-center gap-3">
                    <Initials
                      name={t.name}
                      userId={t.id}
                      avatarV={t.avatar_v}
                      className="h-12 w-12"
                    />
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/profil/${t.id}`}
                        className="font-bold text-slate-900 hover:text-primary block truncate"
                      >
                        {t.name}
                      </Link>
                      <EnsaeBadge
                        class_name={t.class_name}
                        filiere={t.filiere}
                        annee={t.annee}
                        isTutor={t.is_tutor}
                        className="mt-1"
                      />
                    </div>
                    {t.match_score > 0 && (
                      <span className="text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2.5 py-0.5 shrink-0">
                        {t.match_score}% match
                      </span>
                    )}
                  </div>
                  {t.matched_weaknesses?.length > 0 && (
                    <div className="text-[11px] text-emerald-700 bg-emerald-50/70 rounded-lg px-2.5 py-1">
                      Recommandé pour : <strong>{t.matched_weaknesses.join(", ")}</strong>
                    </div>
                  )}
                  {t.bio && (
                    <p className="text-sm text-slate-600 line-clamp-2">{t.bio}</p>
                  )}
                  {t.contact_info && (
                    <div className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700">
                      Contact : <strong>{t.contact_info}</strong>
                    </div>
                  )}
                  {t.tutor_slots?.length > 0 && (
                    <div className="text-xs text-slate-500">
                      Créneaux : <span className="text-slate-700 font-medium">{t.tutor_slots.join(" · ")}</span>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {(t.tutor_subjects || []).map((s) => (
                      <span
                        key={s}
                        className="text-xs bg-blue-50 text-primary border border-blue-100 rounded-md px-2 py-0.5"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                  <div className="mt-auto pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span>
                      {t.completed_sessions} session(s) ·{" "}
                      {t.avg_rating ? `★ ${t.avg_rating}/5` : "Tuteur"}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {t.id !== user.id && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => thankTutor(t.id)}
                            className={`rounded-full h-8 px-2.5 text-xs ${
                              t.thanked_by_me ? "bg-rose-50 text-rose-600" : "text-slate-600"
                            }`}
                          >
                            ♥ Merci ({t.thanks_count || 0})
                          </Button>
                          <Link to={`/messages?user=${t.id}`}>
                            <Button size="sm" variant="outline" className="rounded-full h-8 px-2.5 text-xs">
                              Message
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            onClick={() => {
                              setForm({
                                ...form,
                                subject: t.tutor_subjects?.[0] || "Économétrie",
                                target_tutor_id: t.id,
                              });
                              setCreateOpen(true);
                            }}
                            className="rounded-full h-8 px-3 text-xs"
                          >
                            Solliciter
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="sessions">
          {mySessions.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="Aucune session pour l'instant"
              text="Tes demandes de tutorat et les étudiants que tu accompagnes apparaîtront ici."
            />
          ) : (
            <div className="space-y-4">
              {mySessions.map((s) => {
                const meta = STATUS_META[s.status] || STATUS_META.open;
                const isStudent = s.student_id === user.id;
                return (
                  <div
                    key={s.id}
                    data-testid={`session-card-${s.id}`}
                    className="surface p-5"
                  >
                    <div className="flex flex-wrap items-center gap-2 justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs font-semibold border rounded-full px-2.5 py-0.5 ${meta.cls}`}
                        >
                          {meta.label}
                        </span>
                        <span className="text-xs font-bold text-primary bg-blue-50 rounded px-2 py-0.5">
                          {s.subject}
                        </span>
                        <h3 className="font-bold text-slate-900">{s.title}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        {s.status === "accepted" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setChatOpenId(chatOpenId === s.id ? null : s.id)
                              }
                              className="rounded-full"
                            >
                              <MessageSquare size={13} className="mr-1" /> Chat
                            </Button>
                            <Button
                              size="sm"
                              data-testid={`tutoring-complete-${s.id}`}
                              onClick={() => complete(s.id)}
                              className="rounded-full bg-emerald-600 hover:bg-emerald-700"
                            >
                              <CheckCircle2 size={13} className="mr-1" /> Terminer
                            </Button>
                          </>
                        )}
                        {s.status === "completed" &&
                          isStudent &&
                          !s.rating && (
                            <Button
                              size="sm"
                              data-testid={`tutoring-rate-open-${s.id}`}
                              onClick={() => setRateTarget(s)}
                              className="rounded-full bg-amber-600 hover:bg-amber-700"
                            >
                              <Star size={13} className="mr-1" /> Noter le tuteur
                            </Button>
                          )}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 mt-2 flex flex-wrap gap-3">
                      <span>Élève : {s.student_name}</span>
                      {s.tutor_name && (
                        <span>
                          Tuteur : {s.tutor_name}{" "}
                          {s.tutor_level ? `(${s.tutor_level})` : ""}
                        </span>
                      )}
                      {s.scheduled_at && <span>Date : {s.scheduled_at}</span>}
                      {s.rating && (
                        <span className="font-semibold text-amber-700">
                          Note : {s.rating}/5 ★ {s.review && `— « ${s.review} »`}
                        </span>
                      )}
                    </div>
                    {chatOpenId === s.id && <SessionChat reqId={s.id} />}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="directory">
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1">
              <Search
                size={15}
                className="absolute left-3.5 top-3 text-slate-400"
              />
              <Input
                data-testid="directory-search-input"
                value={dirSearch}
                onChange={(e) => setDirSearch(e.target.value)}
                placeholder="Chercher un étudiant, une compétence (R, Python, Économétrie)…"
                className="pl-9 bg-white rounded-full h-10"
              />
            </div>
            <Select value={dirFiliere} onValueChange={setDirFiliere}>
              <SelectTrigger
                data-testid="directory-filiere-filter"
                className="w-44 bg-white rounded-full h-10"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes classes</SelectItem>
                {ENSAE_CLASSES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {directory.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Aucun étudiant trouvé"
              text="Essaie une autre filière ou un autre mot-clé."
            />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {directory.map((u) => (
                <Link
                  key={u.id}
                  to={`/profil/${u.id}`}
                  data-testid={`directory-user-${u.id}`}
                  className="surface p-4 flex items-center gap-3 hover:border-primary/40 transition-colors"
                >
                  <Initials
                    name={u.name}
                    userId={u.id}
                    avatarV={u.avatar_v}
                    className="h-11 w-11"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900 truncate">
                      {u.name}
                    </div>
                    <EnsaeBadge
                      class_name={u.class_name}
                      filiere={u.filiere}
                      annee={u.annee}
                      isTutor={u.is_tutor}
                      className="mt-1"
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent data-testid="tutoring-request-modal">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              Nouvelle demande de tutorat
            </DialogTitle>
            <DialogDescription>
              Les tuteurs ISE 3-5 et AS 2-3 de cette matière recevront une alerte.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitRequest} className="space-y-4">
            <div>
              <Label>Matière</Label>
              <Select
                value={form.subject}
                onValueChange={(v) => setForm({ ...form, subject: v })}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sujet / Notion qui bloque</Label>
              <Input
                data-testid="tutoring-title-input"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex. Test de Dickey-Fuller et stationnarité"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Détails</Label>
              <Textarea
                data-testid="tutoring-desc-input"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={3}
                placeholder="TD, exercice, erreur R/Python…"
                className="mt-1.5"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Format</Label>
                <Select
                  value={form.mode}
                  onValueChange={(v) => setForm({ ...form, mode: v })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="visio">Visio</SelectItem>
                    <SelectItem value="presentiel">Présentiel ENSAE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date souhaitée</Label>
                <Input
                  type="date"
                  value={form.preferred_date}
                  onChange={(e) =>
                    setForm({ ...form, preferred_date: e.target.value })
                  }
                  className="mt-1.5"
                />
              </div>
            </div>
            <div>
              <Label>Créneau horaire (optionnel)</Label>
              <Input
                value={form.slot_label}
                onChange={(e) => setForm({ ...form, slot_label: e.target.value })}
                placeholder="Ex. Samedi 14h, Mardi 18h30"
                className="mt-1.5"
              />
            </div>
            <Button
              type="submit"
              data-testid="tutoring-submit-request"
              className="w-full rounded-full h-11"
            >
              Publier la demande
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rateTarget} onOpenChange={(o) => !o && setRateTarget(null)}>
        <DialogContent data-testid="tutoring-rate-modal">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              Évaluer {rateTarget?.tutor_name}
            </DialogTitle>
            <DialogDescription>
              Ton avis aide les autres étudiants et valorise les tuteurs ENSAE.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitRating} className="space-y-4">
            <div>
              <Label className="mb-2 block">Note (1 à 5 étoiles)</Label>
              <Stars value={rating} onChange={setRating} />
            </div>
            <div>
              <Label>Commentaire (optionnel)</Label>
              <Textarea
                data-testid="tutoring-review-input"
                value={review}
                onChange={(e) => setReview(e.target.value)}
                rows={3}
                placeholder="Clarté des explications, aide sur R/Python…"
                className="mt-1.5"
              />
            </div>
            <Button
              type="submit"
              data-testid="tutoring-submit-rating"
              className="w-full rounded-full h-11"
            >
              Envoyer la note
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
