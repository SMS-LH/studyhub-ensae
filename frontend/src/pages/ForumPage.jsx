import { useCallback, useEffect, useState } from "react";
import {
  ArrowBigUp,
  CheckCircle2,
  Flag,
  Loader2,
  MessageSquareText,
  Plus,
  Search,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { EmptyState, Initials, PageHeader, SUBJECTS } from "@/components/common";

export default function ForumPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [replyText, setReplyText] = useState({});
  const [form, setForm] = useState({
    title: "",
    body: "",
    subject: "Statistique mathématique",
    tags: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        ...(subject !== "all" ? { subject } : {}),
        ...(q.trim() ? { q: q.trim() } : {}),
      };
      const { data } = await api.get("/forum/posts", { params });
      setPosts(data);
    } catch (e) {
      toast.error(formatError(e));
    } finally {
      setLoading(false);
    }
  }, [subject, q]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post("/forum/posts", {
        ...form,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      toast.success("Question publiée sur le forum ENSAE");
      setOpen(false);
      setForm({ title: "", body: "", subject: "Statistique mathématique", tags: "" });
      load();
    } catch (err) {
      toast.error(formatError(err));
    }
  };

  const reply = async (e, postId) => {
    e.preventDefault();
    const txt = (replyText[postId] || "").trim();
    if (!txt) return;
    try {
      await api.post(`/forum/posts/${postId}/replies`, { body: txt });
      setReplyText({ ...replyText, [postId]: "" });
      toast.success("Réponse publiée");
      load();
    } catch (err) {
      toast.error(formatError(err));
    }
  };

  const solve = async (postId, replyId) => {
    try {
      await api.post(`/forum/posts/${postId}/solve/${replyId}`);
      toast.success("Réponse marquée comme solution !");
      load();
    } catch (err) {
      toast.error(formatError(err));
    }
  };

  const upvote = async (postId) => {
    try {
      const { data } = await api.post(`/forum/posts/${postId}/upvote`);
      setPosts((ps) =>
        ps.map((p) => (p.id === postId ? { ...p, ...data } : p)),
      );
    } catch (err) {
      toast.error(formatError(err));
    }
  };

  const report = async (postId) => {
    const reason = window.prompt("Raison du signalement (brève description) :");
    if (!reason) return;
    try {
      await api.post("/reports", { target_type: "forum_post", target_id: postId, reason });
      toast.success("Signalement envoyé aux modérateurs.");
    } catch (err) {
      toast.error(formatError(err));
    }
  };

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow="Forum Q&A ENSAE"
        title="Questions rapides, réponses de la promo."
        actions={
          <Button
            data-testid="forum-new-post-button"
            onClick={() => setOpen(true)}
            className="rounded-full h-11 px-5 shadow-[3px_3px_0_#d97706]"
          >
            <Plus size={16} className="mr-2" /> Poser une question
          </Button>
        }
      >
        Un blocage en R, Python, Probabilités ou Économétrie ? Pose ta question à
        toutes les promotions ISE et AS.
      </PageHeader>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
          <Input
            data-testid="forum-search-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher une question, une erreur R, un théorème…"
            className="pl-9 bg-white rounded-full h-10"
          />
        </div>
        <Select value={subject} onValueChange={setSubject}>
          <SelectTrigger
            data-testid="forum-subject-filter"
            className="w-60 bg-white rounded-full h-10"
          >
            <SelectValue />
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

      {loading ? (
        <div className="py-16 grid place-items-center">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={MessageSquareText}
          title="Aucune question pour l'instant"
          text="Pose la première question pour démarrer la discussion."
        />
      ) : (
        <div className="space-y-4">
          {posts.map((p) => (
            <div
              key={p.id}
              data-testid={`forum-post-${p.id}`}
              className="surface p-5 space-y-4"
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={() => upvote(p.id)}
                  className={`flex flex-col items-center px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-colors ${
                    p.upvoted
                      ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:border-primary/40"
                  }`}
                >
                  <ArrowBigUp size={17} />
                  {p.upvote_count}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-bold bg-blue-50 text-primary border border-blue-200 rounded px-2 py-0.5">
                      {p.subject}
                    </span>
                    {p.is_solved && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded px-2 py-0.5">
                        <CheckCircle2 size={12} /> Résolu
                      </span>
                    )}
                    <span className="text-xs text-slate-500">
                      {p.author_name}
                      {p.author_level ? ` (${p.author_level})` : ""} ·{" "}
                      {timeAgo(p.created_at)}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{p.title}</h3>
                  <p className="text-sm text-slate-700 mt-1 whitespace-pre-line">
                    {p.body}
                  </p>
                </div>
                <button
                  onClick={() => report(p.id)}
                  title="Signaler ce post"
                  className="text-slate-300 hover:text-rose-500 transition-colors shrink-0 mt-0.5"
                >
                  <Flag size={14} />
                </button>
              </div>

              <div className="pl-4 sm:pl-12 space-y-2.5 border-l-2 border-slate-100">
                {(p.replies || []).map((r) => {
                  const accepted = p.accepted_reply_id === r.id;
                  return (
                    <div
                      key={r.id}
                      className={`rounded-xl p-3 text-sm border ${
                        accepted
                          ? "bg-emerald-50/70 border-emerald-200"
                          : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Initials name={r.author_name} className="h-6 w-6 text-[10px]" />
                        <span className="font-semibold text-slate-900">
                          {r.author_name}
                        </span>
                        {r.author_level && (
                          <span className="text-[11px] bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-600">
                            {r.author_level}
                          </span>
                        )}
                        {r.is_tutor && (
                          <span className="text-[11px] bg-amber-100 text-amber-800 rounded px-1.5 py-0.5 font-semibold">
                            Tuteur
                          </span>
                        )}
                        {accepted && (
                          <span className="text-[11px] font-bold text-emerald-700 ml-auto flex items-center gap-1">
                            <CheckCircle2 size={12} /> Meilleure réponse
                          </span>
                        )}
                        {!accepted && p.author_id === user.id && (
                          <button
                            onClick={() => solve(p.id, r.id)}
                            className="ml-auto text-xs font-semibold text-primary hover:underline"
                          >
                            Valider comme solution
                          </button>
                        )}
                      </div>
                      <p className="text-slate-700 whitespace-pre-line">{r.body}</p>
                    </div>
                  );
                })}
                <form onSubmit={(e) => reply(e, p.id)} className="flex gap-2 pt-1">
                  <Input
                    data-testid={`forum-reply-input-${p.id}`}
                    value={replyText[p.id] || ""}
                    onChange={(e) =>
                      setReplyText({ ...replyText, [p.id]: e.target.value })
                    }
                    placeholder="Apporter une réponse…"
                    className="h-9 bg-white"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    data-testid={`forum-reply-submit-${p.id}`}
                    className="rounded-full h-9 px-4"
                  >
                    <Send size={13} className="mr-1" /> Répondre
                  </Button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="forum-new-post-modal">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              Poser une question à la promo
            </DialogTitle>
            <DialogDescription>
              Décris clairement ton problème (matière, théorème, ou erreur R/Python).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={create} className="space-y-4">
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
              <Label>Titre de la question</Label>
              <Input
                data-testid="forum-title-input"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex. Comment interpréter le test de Hausman ?"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Détails</Label>
              <Textarea
                data-testid="forum-body-input"
                required
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                rows={4}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Tags (optionnel, séparés par des virgules)</Label>
              <Input
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="econometrie, panel, R"
                className="mt-1.5"
              />
            </div>
            <Button
              type="submit"
              data-testid="forum-submit-button"
              className="w-full rounded-full h-11"
            >
              Publier la question
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
