import { useCallback, useEffect, useState } from "react";
import {
  Search,
  Sparkles,
  Upload,
  Loader2,
  BookOpen,
  X,
  ShieldCheck,
  FileSpreadsheet,
  GraduationCap,
  Code2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, formatError } from "@/lib/api";
import {
  ENSAE_FILIERES,
  EmptyState,
  FORMATS,
  PageHeader,
  SUBJECTS,
} from "@/components/common";
import { DocCard } from "@/components/library/DocCard";
import { UploadDialog } from "@/components/library/UploadDialog";

const FilterSelect = ({ value, onChange, placeholder, options, testid }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger
      data-testid={testid}
      className="h-10 w-full sm:w-44 bg-white rounded-full"
    >
      <SelectValue placeholder={placeholder} />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">{placeholder}</SelectItem>
      {options.map(([v, l]) => (
        <SelectItem key={v} value={v}>
          {l}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

const StatPill = ({ icon: Icon, value, label, cls }) => (
  <div className="surface px-4 py-3 flex items-center gap-3">
    <span className={`h-9 w-9 rounded-xl grid place-items-center shrink-0 ${cls}`}>
      <Icon size={17} />
    </span>
    <div>
      <div className="font-display text-xl font-extrabold text-slate-900 leading-none">
        {value}
      </div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  </div>
);

export default function LibraryPage() {
  const [docs, setDocs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all"); // all | courses | annales | validated
  const [filters, setFilters] = useState({
    filiere: "all",
    annee: "all",
    subject: "all",
    format: "all",
    professor: "",
    sort: "recent",
  });
  const [query, setQuery] = useState("");
  const [semantic, setSemantic] = useState(null);
  const [searching, setSearching] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v !== "all" && v !== ""),
    );
    if (tab === "annales") params.is_annale = true;
    if (tab === "courses") params.is_annale = false;
    if (tab === "validated") params.validated_only = true;
    if (tab === "saved") params.saved_only = true;
    try {
      const [{ data }, ov] = await Promise.all([
        api.get("/documents", { params }),
        api.get("/stats/overview").catch(() => ({ data: null })),
      ]);
      setDocs(data);
      if (ov?.data) setStats(ov.data);
    } catch (e) {
      toast.error(formatError(e));
    } finally {
      setLoading(false);
    }
  }, [filters, tab]);

  useEffect(() => {
    load();
  }, [load]);

  const search = async (e) => {
    e.preventDefault();
    if (!query.trim()) return setSemantic(null);
    setSearching(true);
    try {
      const { data } = await api.post("/documents/search", { query });
      setSemantic({ query, results: data.results });
    } catch (err) {
      toast.error(formatError(err));
    } finally {
      setSearching(false);
    }
  };

  const setF = (k) => (v) => {
    if (k === "filiere") {
      setFilters({ ...filters, filiere: v, annee: "all" });
    } else {
      setFilters({ ...filters, [k]: v });
    }
  };
  const yearOptions =
    filters.filiere !== "all"
      ? (ENSAE_FILIERES[filters.filiere] || []).map((y) => [
          String(y),
          `${filters.filiere} ${y}`,
        ])
      : [1, 2, 3, 4, 5].map((y) => [String(y), `${y}e année`]);

  const list = semantic ? semantic.results : docs;

  return (
    <div>
      <PageHeader
        eyebrow="Bibliothèque ENSAE · ISE & AS"
        title="Fiches, code R/Python et annales de la promo."
        actions={
          <Button
            data-testid="library-upload-trigger-button"
            onClick={() => setUploadOpen(true)}
            className="rounded-full h-11 px-5 shadow-[3px_3px_0_#d97706]"
          >
            <Upload size={16} className="mr-2" /> Déposer une ressource
          </Button>
        }
      >
        Cours, scripts <code className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded">.R</code>,{" "}
        <code className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded">.py</code>,{" "}
        <code className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded">.do</code>,{" "}
        <code className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded">.sas</code> et annales corrigées validées par les tuteurs.
      </PageHeader>

      {stats && (
        <div
          data-testid="ensae-overview-stats"
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6 fade-up"
        >
          <StatPill
            icon={BookOpen}
            value={stats.total_docs}
            label="Fiches & ressources"
            cls="bg-blue-50 text-primary"
          />
          <StatPill
            icon={FileSpreadsheet}
            value={stats.total_annales}
            label="Annales d'examens"
            cls="bg-amber-50 text-amber-700"
          />
          <StatPill
            icon={Code2}
            value={stats.total_code}
            label="Scripts R / Python"
            cls="bg-emerald-50 text-emerald-700"
          />
          <StatPill
            icon={GraduationCap}
            value={stats.total_tutors}
            label="Tuteurs actifs"
            cls="bg-rose-50 text-rose-700"
          />
        </div>
      )}

      <form
        onSubmit={search}
        className="surface p-2 flex items-center gap-2 fade-up"
        style={{ animationDelay: "80ms" }}
      >
        <Sparkles className="text-amber-600 ml-3 shrink-0" size={18} />
        <Input
          data-testid="library-search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ex. « théorème de Gauss-Markov », « test de Breusch-Pagan sous R », « processus AR(1) »…"
          className="border-0 shadow-none focus-visible:ring-0 text-base h-11"
        />
        {semantic && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            data-testid="library-search-clear"
            onClick={() => {
              setSemantic(null);
              setQuery("");
            }}
          >
            <X size={16} />
          </Button>
        )}
        <Button
          type="submit"
          data-testid="library-search-submit"
          disabled={searching}
          className="rounded-xl h-11 px-5"
        >
          {searching ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <Search size={16} />
          )}
          <span className="ml-2 hidden sm:inline">Recherche IA</span>
        </Button>
      </form>

      <div className="flex flex-wrap gap-2 mt-5">
        {[
          ["all", "Tout voir"],
          ["courses", "Fiches & Code"],
          ["annales", "Annales"],
          ["validated", "Validées par tuteurs"],
          ["saved", "Mes favoris"],
        ].map(([k, l]) => (
          <button
            key={k}
            data-testid={`library-tab-${k}`}
            onClick={() => {
              setSemantic(null);
              setTab(k);
            }}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
              tab === k
                ? "bg-primary text-white border-primary"
                : "bg-white text-slate-600 border-slate-200 hover:border-primary/40"
            }`}
          >
            {k === "validated" && <ShieldCheck size={14} />}
            {l}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-2 mt-3 mb-8">
        <FilterSelect
          testid="library-filiere-filter"
          value={filters.filiere}
          onChange={setF("filiere")}
          placeholder="Filière (ISE / AS)"
          options={[
            ["ISE", "ISE"],
            ["AS", "AS"],
          ]}
        />
        <FilterSelect
          testid="library-level-filter"
          value={filters.annee}
          onChange={setF("annee")}
          placeholder="Toutes les années"
          options={yearOptions}
        />
        <FilterSelect
          testid="library-faculty-filter"
          value={filters.subject}
          onChange={setF("subject")}
          placeholder="Toutes les matières"
          options={SUBJECTS.map((s) => [s, s])}
        />
        <FilterSelect
          testid="library-format-filter"
          value={filters.format}
          onChange={setF("format")}
          placeholder="Tous les formats"
          options={Object.entries(FORMATS).map(([k, v]) => [k, v.label])}
        />
        <Input
          data-testid="library-professor-filter"
          value={filters.professor}
          onChange={(e) => setFilters({ ...filters, professor: e.target.value })}
          placeholder="Filtrer par professeur…"
          className="h-10 w-full sm:w-48 bg-white rounded-full"
        />
        <Select value={filters.sort} onValueChange={setF("sort")}>
          <SelectTrigger
            data-testid="library-sort-select"
            className="h-10 w-full sm:w-44 bg-white rounded-full"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Plus récentes</SelectItem>
            <SelectItem value="top">Mieux notées</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {semantic && (
        <div
          data-testid="semantic-results-header"
          className="mb-4 text-sm text-slate-600"
        >
          <span className="font-semibold text-slate-900">
            {semantic.results.length} fiche(s)
          </span>{" "}
          liée(s) au concept « {semantic.query} »
        </div>
      )}

      {loading && !semantic ? (
        <div className="py-20 grid place-items-center">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          testid="library-empty"
          icon={BookOpen}
          title={
            semantic
              ? "Aucune fiche ne traite ce concept"
              : "Aucune ressource trouvée"
          }
          text={
            semantic
              ? "Essaie une formulation plus large ou dépose la première fiche sur ce sujet."
              : "Ajuste tes filtres ou sois le premier à partager un cours ou une annale."
          }
        />
      ) : (
        <div
          data-testid="library-doc-grid"
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {list.map((d, i) => (
            <DocCard key={d.id} doc={d} index={i} />
          ))}
        </div>
      )}

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={() => {
          setSemantic(null);
          load();
        }}
      />
    </div>
  );
}
