import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowBigDown,
  ArrowBigUp,
  ArrowLeft,
  Bookmark,
  Download,
  Flag,
  GitBranch,
  Loader2,
  Sparkles,
  Trash2,
  Brain,
  Layers,
  ListChecks,
  ShieldCheck,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, fileUrl, formatDate, formatError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { FormatBadge } from "@/components/common";
import { DocViewer } from "@/components/library/DocViewer";
import { CommentsPanel } from "@/components/library/CommentsPanel";
import {
  VersionsPanel,
  NewVersionDialog,
} from "@/components/library/VersionsPanel";

const VoteBox = ({ doc, onVote }) => (
  <div className="flex items-center gap-1 surface px-1.5 py-1 rounded-full">
    <button
      data-testid="doc-vote-up-button"
      onClick={() => onVote(doc.my_vote === 1 ? 0 : 1)}
      className={`p-1.5 rounded-full transition-colors ${doc.my_vote === 1 ? "bg-emerald-100 text-emerald-700" : "hover:bg-slate-100 text-slate-500"}`}
    >
      <ArrowBigUp size={20} />
    </button>
    <span
      data-testid="doc-score"
      className={`min-w-[2ch] text-center font-bold ${doc.score > 0 ? "text-emerald-600" : doc.score < 0 ? "text-rose-600" : "text-slate-700"}`}
    >
      {doc.score}
    </span>
    <button
      data-testid="doc-vote-down-button"
      onClick={() => onVote(doc.my_vote === -1 ? 0 : -1)}
      className={`p-1.5 rounded-full transition-colors ${doc.my_vote === -1 ? "bg-rose-100 text-rose-700" : "hover:bg-slate-100 text-slate-500"}`}
    >
      <ArrowBigDown size={20} />
    </button>
  </div>
);

const AI_ACTIONS = [
  ["summary", "Générer une fiche de révision", Brain],
  ["quiz", "Créer un QCM ENSAE", ListChecks],
  ["flashcards", "Créer des flashcards", Layers],
];

export default function DocumentPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [version, setVersion] = useState(null);
  const [versionOpen, setVersionOpen] = useState(false);

  const load = useCallback(
    () =>
      api
        .get(`/documents/${id}`)
        .then((r) => {
          setDoc(r.data);
          setVersion(r.data.current_version);
        })
        .catch((e) => {
          toast.error(formatError(e));
          navigate("/bibliotheque");
        }),
    [id, navigate],
  );
  useEffect(() => {
    load();
  }, [load]);

  if (!doc)
    return (
      <div className="py-24 grid place-items-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );

  const entry =
    doc.versions.find((v) => v.version === version) ||
    doc.versions[doc.versions.length - 1];

  const isSeniorTutor =
    user.role === "admin" ||
    (user.is_tutor &&
      ((user.filiere === "ISE" && Number(user.annee) >= 3) ||
        (user.filiere === "AS" && Number(user.annee) >= 2) ||
        (doc.annee && Number(user.annee) > Number(doc.annee))));

  const vote = async (value) => {
    try {
      const { data } = await api.post(`/documents/${id}/vote`, { value });
      setDoc({ ...doc, ...data });
      toast.success(value === 0 ? "Vote retiré" : "Merci pour ton avis !");
    } catch (e) {
      toast.error(formatError(e));
    }
  };

  const toggleValidate = async () => {
    try {
      const { data } = await api.post(`/documents/${id}/validate`);
      setDoc(data);
      toast.success(
        data.is_validated
          ? "Fiche validée pour la promo !"
          : "Validation retirée",
      );
    } catch (e) {
      toast.error(formatError(e));
    }
  };

  const remove = async () => {
    if (!window.confirm("Supprimer définitivement cette fiche ?")) return;
    await api.delete(`/documents/${id}`);
    toast.success("Fiche supprimée");
    navigate("/bibliotheque");
  };

  return (
    <div className="fade-up">
      <Link
        to="/bibliotheque"
        data-testid="doc-back-link"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary mb-5"
      >
        <ArrowLeft size={15} /> Bibliothèque ENSAE
      </Link>
      <div className="flex flex-col lg:flex-row gap-6 lg:items-start justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <FormatBadge format={doc.format} size="lg" />
            {doc.is_annale && (
              <span className="inline-flex items-center gap-1 text-sm font-bold bg-amber-100 text-amber-800 border border-amber-300 rounded-md px-2.5 py-1">
                <FileSpreadsheet size={14} /> Annale {doc.annale_year}
              </span>
            )}
            {doc.is_validated && (
              <span
                data-testid="doc-validated-badge"
                className="inline-flex items-center gap-1 text-sm font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md px-2.5 py-1"
              >
                <ShieldCheck size={15} /> Validé par {doc.validated_by_name}
                {doc.validated_by_level ? ` (${doc.validated_by_level})` : ""}
              </span>
            )}
            {doc.shared_from_level && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-blue-50 text-primary border border-blue-200 rounded-md px-2 py-1">
                Transmis depuis {doc.shared_from_level}
              </span>
            )}
            <span className="text-sm text-slate-600 font-medium">
              {doc.subject}
              {(doc.filiere || doc.level) &&
                ` · ${doc.filiere ? `${doc.filiere} ${doc.annee || ""}`.trim() : doc.level}`}
            </span>
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1 flex items-center gap-1">
              <GitBranch size={12} /> V{doc.current_version}
            </span>
          </div>
          <h1
            data-testid="doc-title"
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 leading-[1.05]"
          >
            {doc.title}
          </h1>
          <p className="text-sm text-slate-500 mt-3">
            Par{" "}
            <Link
              to={`/profil/${doc.author_id}`}
              data-testid="doc-author-link"
              className="font-semibold text-slate-700 hover:text-primary underline-offset-2 hover:underline"
            >
              {doc.author_name}
            </Link>{" "}
            · publiée le {formatDate(doc.created_at)} · mise à jour le{" "}
            {formatDate(doc.updated_at)}
          </p>
        </div>
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 shrink-0">
          <VoteBox doc={doc} onVote={vote} />
          {isSeniorTutor && doc.author_id !== user.id && (
            <Button
              variant={doc.is_validated ? "outline" : "default"}
              data-testid="doc-validate-button"
              onClick={toggleValidate}
              className={`rounded-full ${doc.is_validated ? "border-emerald-300 text-emerald-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
            >
              <ShieldCheck size={15} className="mr-1.5" />
              {doc.is_validated ? "Validée" : "Valider (Tuteur)"}
            </Button>
          )}
          <Button variant="outline" asChild className="rounded-full">
            <a
              data-testid="doc-download-button"
              href={fileUrl(doc.id, entry.version)}
              download={entry.filename}
            >
              <Download size={15} className="mr-2" /> Télécharger
            </a>
          </Button>
          <Button
            data-testid="doc-new-version-button"
            onClick={() => setVersionOpen(true)}
            className="rounded-full"
          >
            <GitBranch size={15} className="mr-2" /> Proposer V
            {doc.current_version + 1}
          </Button>
          <Button
            variant="outline"
            size="icon"
            title="Enregistrer dans mes favoris"
            onClick={async () => {
              try {
                const { data } = await api.post(`/documents/${doc.id}/bookmark`);
                setDoc({ ...doc, saved: data.saved });
                toast.success(data.saved ? "Fiche enregistrée" : "Retirée des favoris");
              } catch (e) {
                toast.error(formatError(e));
              }
            }}
            className={`rounded-full ${doc.saved ? "border-amber-300 bg-amber-50 text-amber-700" : ""}`}
          >
            <Bookmark size={15} className={doc.saved ? "fill-amber-600" : ""} />
          </Button>
          {(doc.author_id === user.id || user.role === "admin") && (
            <Button
              variant="ghost"
              size="icon"
              data-testid="doc-delete-button"
              onClick={remove}
              className="text-rose-600 hover:bg-rose-50"
            >
              <Trash2 size={16} />
            </Button>
          )}
          {doc.author_id !== user.id && (
            <Button
              variant="ghost"
              size="icon"
              title="Signaler ce document"
              onClick={async () => {
                const reason = window.prompt("Raison du signalement :");
                if (!reason) return;
                try {
                  await api.post("/reports", { target_type: "document", target_id: doc.id, reason });
                  toast.success("Signalement envoyé aux modérateurs.");
                } catch (e) {
                  toast.error(formatError(e));
                }
              }}
              className="text-slate-400 hover:text-rose-500 hover:bg-rose-50"
            >
              <Flag size={16} />
            </Button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 mt-8">
        <div className="lg:col-span-8 min-w-0">
          <Tabs defaultValue="reader">
            <div className="flex flex-wrap items-center gap-3 justify-between mb-3">
              <TabsList className="rounded-full max-w-full overflow-x-auto justify-start">
                <TabsTrigger
                  value="reader"
                  data-testid="doc-tab-reader"
                  className="rounded-full"
                >
                  Lecteur
                </TabsTrigger>
                <TabsTrigger
                  value="comments"
                  data-testid="doc-tab-comments"
                  className="rounded-full"
                >
                  Commentaires & erreurs ({doc.comment_count})
                </TabsTrigger>
                <TabsTrigger
                  value="versions"
                  data-testid="doc-tab-versions"
                  className="rounded-full"
                >
                  Versions ({doc.versions.length})
                </TabsTrigger>
              </TabsList>
              {doc.versions.length > 1 && (
                <Select
                  value={String(version)}
                  onValueChange={(v) => setVersion(Number(v))}
                >
                  <SelectTrigger
                    data-testid="doc-version-select"
                    className="w-40 rounded-full bg-white"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[...doc.versions].reverse().map((v) => (
                      <SelectItem key={v.version} value={String(v.version)}>
                        V{v.version}
                        {v.version === doc.current_version ? " (actuelle)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <TabsContent value="reader">
              <DocViewer doc={doc} entry={entry} />
            </TabsContent>
            <TabsContent value="comments">
              <CommentsPanel
                docId={doc.id}
                onCount={(n) => setDoc((d) => ({ ...d, comment_count: n }))}
              />
            </TabsContent>
            <TabsContent value="versions">
              <VersionsPanel doc={doc} onView={setVersion} />
            </TabsContent>
          </Tabs>
        </div>
        <aside className="lg:col-span-4 space-y-5">
          <div className="surface p-5">
            <div className="eyebrow mb-2">À propos</div>
            <p
              data-testid="doc-description"
              className="text-sm text-slate-700 leading-relaxed"
            >
              {doc.description || "Pas de description."}
            </p>
            {doc.abstract && (
              <p className="text-sm text-slate-600 mt-3 italic border-l-2 border-amber-400 pl-3">
                {doc.abstract}
              </p>
            )}
            {doc.concepts?.length > 0 && (
              <div className="mt-4">
                <div className="text-xs font-semibold text-slate-500 mb-2">
                  Concepts détectés par l'IA
                </div>
                <div
                  data-testid="doc-concepts"
                  className="flex flex-wrap gap-1.5"
                >
                  {doc.concepts.map((c) => (
                    <span
                      key={c}
                      className="text-xs bg-blue-50 text-primary border border-blue-100 rounded-md px-2 py-0.5"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {doc.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {doc.tags.map((t) => (
                  <span key={t} className="text-xs text-slate-500">
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-2xl bg-primary text-white p-5 relative overflow-hidden">
            <Sparkles
              className="absolute -right-4 -top-4 text-white/10"
              size={110}
            />
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300 mb-3">
              Réviser avec l'IA
            </div>
            <div className="space-y-2 relative">
              {AI_ACTIONS.map(([tool, label, Icon]) => (
                <button
                  key={tool}
                  data-testid={`doc-ai-${tool}-button`}
                  disabled={!doc.text_content}
                  onClick={() =>
                    navigate(`/assistant?tool=${tool}&doc=${doc.id}`)
                  }
                  className="w-full flex items-center gap-2 bg-white/10 hover:bg-white/20 disabled:opacity-40 border border-white/15 rounded-xl px-3 py-2.5 text-sm font-medium text-left transition-colors"
                >
                  <Icon size={16} className="text-amber-300" /> {label}
                </button>
              ))}
              {!doc.text_content && (
                <p className="text-xs text-blue-100/80">
                  Aucun texte extractible (vidéo ou document scanné).
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>
      <NewVersionDialog
        open={versionOpen}
        onOpenChange={setVersionOpen}
        doc={doc}
        onDone={load}
      />
    </div>
  );
}
