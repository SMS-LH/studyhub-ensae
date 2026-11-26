import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart2,
  Bookmark,
  Calendar,
  GraduationCap,
  Heart,
  Loader2,
  MessageCircle,
  Pin,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

const KIND_META = {
  post: { label: "Publication", cls: "bg-slate-100 text-slate-700" },
  question: { label: "Question", cls: "bg-blue-50 text-primary border border-blue-200" },
  binome: { label: "Cherche binôme", cls: "bg-amber-50 text-amber-800 border border-amber-200" },
  annonce: { label: "Annonce classe", cls: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
};

const renderTextWithMentions = (text) => {
  const parts = (text || "").split(/(@[A-Za-zÀ-ÿ0-9_-]{2,30})/g);
  return parts.map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="font-semibold text-primary bg-blue-50 px-1 rounded">
        {part}
      </span>
    ) : (
      part
    ),
  );
};

export default function ClassFeedPage() {
  const { user } = useAuth();
  const isAdmin = ["moderator", "admin", "class_admin"].includes(user?.role);
  const classLabel = user?.class_name || (user?.filiere && user?.annee ? `${user.filiere} ${user.annee}` : "ENSAE");

  const [posts, setPosts] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");

  // Composer state
  const [text, setText] = useState("");
  const [kind, setKind] = useState("post");
  const [subject, setSubject] = useState("");
  const [showPoll, setShowPoll] = useState(false);
  const [pollOpts, setPollOpts] = useState(["", ""]);
  const [posting, setPosting] = useState(false);

  // Comments state
  const [openComments, setOpenComments] = useState({});
  const [commentText, setCommentText] = useState({});

  // Event composer (admin only)
  const [showEventForm, setShowEventForm] = useState(false);
  const [evForm, setEvForm] = useState({
    title: "",
    subject: "",
    event_date: "",
    kind: "DS",
  });

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: feedData }, { data: evData }] = await Promise.all([
        api.get("/feed", { params: { filter, ...(q.trim() ? { q: q.trim() } : {}) } }),
        api.get("/feed/events").catch(() => ({ data: [] })),
      ]);
      setPosts(feedData);
      setEvents(evData);
    } catch (e) {
      toast.error(formatError(e));
    } finally {
      setLoading(false);
    }
  }, [filter, q]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const publish = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setPosting(true);
    try {
      const cleanOpts = showPoll ? pollOpts.map((o) => o.trim()).filter(Boolean) : [];
      if (showPoll && cleanOpts.length < 2) {
        toast.error("Ajoute au moins 2 options pour le sondage.");
        setPosting(false);
        return;
      }
      await api.post("/feed", {
        text: text.trim(),
        kind,
        subject: subject === "none" ? "" : subject,
        poll_options: cleanOpts,
      });
      setText("");
      setKind("post");
      setSubject("");
      setShowPoll(false);
      setPollOpts(["", ""]);
      toast.success("Publié dans le fil de ta classe !");
      loadFeed();
    } catch (err) {
      toast.error(formatError(err));
    } finally {
      setPosting(false);
    }
  };

  const react = async (postId) => {
    try {
      const { data } = await api.post(`/feed/${postId}/react`);
      setPosts((ps) => ps.map((p) => (p.id === postId ? { ...p, ...data } : p)));
    } catch (err) {
      toast.error(formatError(err));
    }
  };

  const bookmark = async (postId) => {
    try {
      const { data } = await api.post(`/feed/${postId}/bookmark`);
      setPosts((ps) => ps.map((p) => (p.id === postId ? { ...p, ...data } : p)));
      toast.success(data.saved ? "Ajouté aux favoris" : "Retiré des favoris");
    } catch (err) {
      toast.error(formatError(err));
    }
  };

  const votePoll = async (postId, idx) => {
    try {
      const { data } = await api.post(`/feed/${postId}/vote/${idx}`);
      setPosts((ps) => ps.map((p) => (p.id === postId ? data : p)));
    } catch (err) {
      toast.error(formatError(err));
    }
  };

  const pin = async (postId) => {
    try {
      const { data } = await api.post(`/feed/${postId}/pin`);
      toast.success(data.is_pinned ? "Publication épinglée" : "Désépinglée");
      loadFeed();
    } catch (err) {
      toast.error(formatError(err));
    }
  };

  const removePost = async (postId) => {
    if (!window.confirm("Supprimer cette publication ?")) return;
    try {
      await api.delete(`/feed/${postId}`);
      setPosts((ps) => ps.filter((p) => p.id !== postId));
      toast.success("Publication supprimée");
    } catch (err) {
      toast.error(formatError(err));
    }
  };

  const addComment = async (e, postId) => {
    e.preventDefault();
    const val = (commentText[postId] || "").trim();
    if (!val) return;
    try {
      const { data } = await api.post(`/feed/${postId}/comment`, { text: val });
      setPosts((ps) =>
        ps.map((p) =>
          p.id === postId ? { ...p, comments: [...(p.comments || []), data] } : p,
        ),
      );
      setCommentText({ ...commentText, [postId]: "" });
    } catch (err) {
      toast.error(formatError(err));
    }
  };

  const createEvent = async (e) => {
    e.preventDefault();
    try {
      await api.post("/feed/events", evForm);
      setEvForm({ title: "", subject: "", event_date: "", kind: "DS" });
      setShowEventForm(false);
      toast.success("Échéance ajoutée pour la classe");
      loadFeed();
    } catch (err) {
      toast.error(formatError(err));
    }
  };

  const deleteEvent = async (id) => {
    try {
      await api.delete(`/feed/events/${id}`);
      setEvents((es) => es.filter((x) => x.id !== id));
    } catch (err) {
      toast.error(formatError(err));
    }
  };

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow={`Espace Classe · ${classLabel}`}
        title={`Fil de la promo ${classLabel}.`}
        actions={
          <Link to="/tutorat">
            <Button variant="outline" className="rounded-full h-10 px-4">
              <GraduationCap size={16} className="mr-2 text-primary" /> Trouver un
              tuteur (toutes classes)
            </Button>
          </Link>
        }
      >
        Échanges, questions, sondages, annonces de ton administrateur de classe et
        partage d'entraide entre camarades de {classLabel}.
      </PageHeader>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Main Feed */}
        <div className="lg:col-span-8 space-y-5 min-w-0">
          {/* Composer */}
          <form onSubmit={publish} className="surface p-5 space-y-3">
            <div className="flex items-start gap-3">
              <Initials
                name={user.name}
                userId={user.id}
                avatarV={user.avatar_v}
                className="h-10 w-10 shrink-0"
              />
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`Partage une question, une astuce R/Python ou un sondage avec ${classLabel}… (utilise @Prénom pour mentionner)`}
                rows={3}
                className="resize-none bg-slate-50/70 border-slate-200 focus-visible:ring-primary"
              />
            </div>

            {showPoll && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <BarChart2 size={14} className="text-primary" /> Options du sondage
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPoll(false)}
                    className="text-slate-400 hover:text-rose-500"
                  >
                    <X size={14} />
                  </button>
                </div>
                {pollOpts.map((opt, idx) => (
                  <Input
                    key={idx}
                    value={opt}
                    onChange={(e) => {
                      const next = [...pollOpts];
                      next[idx] = e.target.value;
                      setPollOpts(next);
                    }}
                    placeholder={`Option ${idx + 1}`}
                    className="h-9 bg-white text-sm"
                  />
                ))}
                {pollOpts.length < 5 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPollOpts([...pollOpts, ""])}
                    className="text-xs text-primary"
                  >
                    <Plus size={13} className="mr-1" /> Ajouter une option
                  </Button>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <div className="flex flex-wrap gap-1.5">
                {[
                  ["post", "Post"],
                  ["question", "Question"],
                  ["binome", "Binôme"],
                  ...(isAdmin ? [["annonce", "Annonce"]] : []),
                ].map(([k, l]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                      kind === k
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-slate-600 border-slate-200 hover:border-primary/40"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>

              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger className="h-8 w-44 rounded-full text-xs bg-white">
                  <SelectValue placeholder="Matière (optionnel)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune matière</SelectItem>
                  {SUBJECTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowPoll(!showPoll)}
                className={`rounded-full h-8 text-xs ${showPoll ? "border-primary text-primary bg-blue-50" : ""}`}
              >
                <BarChart2 size={13} className="mr-1" /> Sondage
              </Button>

              <Button
                type="submit"
                disabled={posting || !text.trim()}
                className="ml-auto rounded-full h-9 px-5"
              >
                {posting ? (
                  <Loader2 size={14} className="animate-spin mr-1.5" />
                ) : (
                  <Send size={14} className="mr-1.5" />
                )}
                Publier
              </Button>
            </div>
          </form>

          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="flex flex-wrap gap-1.5">
              {[
                ["all", "Tout"],
                ["pinned", "Épinglés"],
                ["questions", "Questions"],
                ["polls", "Sondages"],
                ["binomes", "Binômes"],
                ["saved", "Favoris"],
              ].map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    filter === k
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <div className="relative sm:ml-auto sm:w-56">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher dans le fil…"
                className="pl-8 h-9 rounded-full bg-white text-sm"
              />
            </div>
          </div>

          {/* Posts list */}
          {loading ? (
            <div className="py-16 grid place-items-center">
              <Loader2 className="animate-spin text-primary" />
            </div>
          ) : posts.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="Le fil de ta classe est encore calme"
              text="Publie le premier message, pose une question ou lance un sondage pour lancer les échanges !"
            />
          ) : (
            <div className="space-y-4">
              {posts.map((p) => {
                const km = KIND_META[p.kind] || KIND_META.post;
                const isPostAdmin = ["moderator", "admin", "class_admin"].includes(
                  p.author_role,
                );
                return (
                  <article
                    key={p.id}
                    className={`surface p-5 space-y-3.5 ${
                      p.is_pinned ? "border-amber-300 bg-amber-50/20" : ""
                    }`}
                  >
                    {p.is_pinned && (
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                        <Pin size={12} /> Épinglé par l'administrateur
                      </div>
                    )}

                    {/* Author header */}
                    <div className="flex items-start gap-3">
                      <Link to={`/profil/${p.author_id}`}>
                        <Initials
                          name={p.author_name}
                          userId={p.author_id}
                          avatarV={p.author_avatar_v}
                          className="h-10 w-10"
                        />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Link
                            to={`/profil/${p.author_id}`}
                            className="font-bold text-slate-900 hover:text-primary text-sm"
                          >
                            {p.author_name}
                          </Link>
                          {isPostAdmin && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 rounded px-1.5 py-0.5">
                              <ShieldCheck size={10} /> Admin
                            </span>
                          )}
                          {p.author_is_tutor && (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-800 rounded px-1.5 py-0.5">
                              Tuteur
                            </span>
                          )}
                          <span className="text-xs text-slate-400">
                            · {timeAgo(p.created_at)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className={`text-[11px] font-semibold rounded px-2 py-0.5 ${km.cls}`}>
                            {km.label}
                          </span>
                          {p.subject && (
                            <span className="text-[11px] bg-slate-100 text-slate-600 rounded px-2 py-0.5">
                              {p.subject}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {isAdmin && (
                          <button
                            onClick={() => pin(p.id)}
                            title={p.is_pinned ? "Désépingler" : "Épingler"}
                            className={`p-1.5 rounded-full transition-colors ${
                              p.is_pinned
                                ? "text-amber-600 bg-amber-50"
                                : "text-slate-400 hover:text-amber-600 hover:bg-slate-100"
                            }`}
                          >
                            <Pin size={14} />
                          </button>
                        )}
                        {(p.author_id === user.id || isAdmin) && (
                          <button
                            onClick={() => removePost(p.id)}
                            title="Supprimer"
                            className="p-1.5 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Body */}
                    <p className="text-sm sm:text-[15px] text-slate-800 whitespace-pre-line leading-relaxed">
                      {renderTextWithMentions(p.text)}
                    </p>

                    {/* Poll */}
                    {p.poll && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                        {p.poll.options.map((opt, idx) => {
                          const pct = p.poll.total_votes
                            ? Math.round((opt.votes / p.poll.total_votes) * 100)
                            : 0;
                          const mine = p.poll.my_vote === idx;
                          return (
                            <button
                              key={idx}
                              onClick={() => votePoll(p.id, idx)}
                              className={`w-full text-left relative overflow-hidden rounded-lg border p-2.5 text-sm transition-colors ${
                                mine
                                  ? "border-primary bg-blue-50/40 font-semibold"
                                  : "border-slate-200 bg-white hover:border-primary/40"
                              }`}
                            >
                              <div
                                className={`absolute inset-y-0 left-0 transition-all ${
                                  mine ? "bg-primary/15" : "bg-slate-100"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                              <div className="relative flex items-center justify-between gap-2">
                                <span>{opt.text}</span>
                                <span className="text-xs font-mono text-slate-600">
                                  {pct}% ({opt.votes})
                                </span>
                              </div>
                            </button>
                          );
                        })}
                        <div className="text-[11px] text-slate-400 text-right">
                          {p.poll.total_votes} vote(s)
                        </div>
                      </div>
                    )}

                    {/* Actions bar */}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => react(p.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                          p.liked
                            ? "bg-rose-50 text-rose-600"
                            : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <Heart size={14} className={p.liked ? "fill-rose-600" : ""} />
                        {p.like_count || 0}
                      </button>
                      <button
                        onClick={() =>
                          setOpenComments({
                            ...openComments,
                            [p.id]: !openComments[p.id],
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        <MessageCircle size={14} />
                        {(p.comments || []).length} commentaire(s)
                      </button>
                      <button
                        onClick={() => bookmark(p.id)}
                        title="Enregistrer dans mes favoris"
                        className={`ml-auto inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                          p.saved
                            ? "bg-amber-50 text-amber-700"
                            : "text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        <Bookmark size={14} className={p.saved ? "fill-amber-600" : ""} />
                      </button>
                    </div>

                    {/* Comments */}
                    {(openComments[p.id] || (p.comments || []).length > 0) && (
                      <div className="pt-2 space-y-2 border-t border-dashed border-slate-200">
                        {(p.comments || []).map((c) => (
                          <div
                            key={c.id}
                            className="bg-slate-50 rounded-xl px-3.5 py-2.5 text-sm"
                          >
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-semibold text-slate-900 text-xs">
                                {c.author_name}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {timeAgo(c.created_at)}
                              </span>
                            </div>
                            <p className="text-slate-700 text-sm">
                              {renderTextWithMentions(c.text)}
                            </p>
                          </div>
                        ))}
                        <form onSubmit={(e) => addComment(e, p.id)} className="flex gap-2">
                          <Input
                            value={commentText[p.id] || ""}
                            onChange={(e) =>
                              setCommentText({ ...commentText, [p.id]: e.target.value })
                            }
                            placeholder="Commenter… (@Prénom pour mentionner)"
                            className="h-9 rounded-full bg-white text-sm"
                          />
                          <Button type="submit" size="sm" className="rounded-full h-9 px-4">
                            <Send size={13} />
                          </Button>
                        </form>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <aside className="lg:col-span-4 space-y-5">
          {/* Ma semaine / Examens */}
          <div className="surface p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <Calendar size={16} className="text-primary" />
                <span>Échéances {classLabel}</span>
              </div>
              {isAdmin && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowEventForm(!showEventForm)}
                  className="h-7 px-2 text-xs text-primary"
                >
                  <Plus size={14} className="mr-1" /> Ajouter
                </Button>
              )}
            </div>

            {showEventForm && isAdmin && (
              <form
                onSubmit={createEvent}
                className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2"
              >
                <Input
                  required
                  value={evForm.title}
                  onChange={(e) => setEvForm({ ...evForm, title: e.target.value })}
                  placeholder="Ex. Partiel d'Économétrie"
                  className="h-8 bg-white text-xs"
                />
                <div className="flex gap-2">
                  <Input
                    required
                    type="date"
                    value={evForm.event_date}
                    onChange={(e) =>
                      setEvForm({ ...evForm, event_date: e.target.value })
                    }
                    className="h-8 bg-white text-xs flex-1"
                  />
                  <Select
                    value={evForm.kind}
                    onValueChange={(v) => setEvForm({ ...evForm, kind: v })}
                  >
                    <SelectTrigger className="h-8 w-24 bg-white text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DS">DS</SelectItem>
                      <SelectItem value="Partiel">Partiel</SelectItem>
                      <SelectItem value="TD">TD</SelectItem>
                      <SelectItem value="Autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" size="sm" className="w-full h-8 rounded-full text-xs">
                  Enregistrer
                </Button>
              </form>
            )}

            {events.length === 0 ? (
              <p className="text-xs text-slate-500">
                Aucun examen ou rendu prévu pour le moment.
              </p>
            ) : (
              <ul className="space-y-2">
                {events.map((ev) => (
                  <li
                    key={ev.id}
                    className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  >
                    <span className="font-bold bg-blue-100 text-primary rounded px-1.5 py-0.5 shrink-0">
                      {ev.kind}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900 truncate">
                        {ev.title}
                      </div>
                      <div className="text-slate-500">{ev.event_date}</div>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => deleteEvent(ev.id)}
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Open Inter-Class Tutoring Banner */}
          <div className="surface p-5 bg-gradient-to-br from-blue-50/70 to-white border-blue-200 space-y-2.5">
            <div className="flex items-center gap-2 font-bold text-primary">
              <GraduationCap size={18} />
              <span>Tutorat ouvert à toute l'école</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Besoin d'aide d'un étudiant d'une autre classe ? Consulte l'annuaire
              des tuteurs de toutes les promos avec leurs contacts directs.
            </p>
            <Link to="/tutorat" className="block pt-1">
              <Button size="sm" className="w-full rounded-full text-xs">
                Voir les tuteurs & contacts
              </Button>
            </Link>
          </div>

          {/* Groupes TD link */}
          <div className="surface p-5 space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
              <Users size={16} className="text-amber-600" />
              <span>Groupes de TD & Amphi</span>
            </div>
            <p className="text-xs text-slate-500">
              Retrouve le chat de ta classe, tes tableaux Kanban et tes notes de
              projet.
            </p>
            <Link to="/espaces" className="block pt-1">
              <Button variant="outline" size="sm" className="w-full rounded-full text-xs">
                Ouvrir mes espaces
              </Button>
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
