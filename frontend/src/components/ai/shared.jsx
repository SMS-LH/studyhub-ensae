import { useEffect, useState } from "react";
import { BookOpen, ClipboardPaste, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";

export const useSource = (initialDocId) => {
  const [mode, setMode] = useState(initialDocId ? "doc" : "doc");
  const [docId, setDocId] = useState(initialDocId || "");
  const [text, setText] = useState("");
  const payload = mode === "doc" ? { document_id: docId } : { text };
  const ready = mode === "doc" ? !!docId : text.trim().length >= 30;
  return { mode, setMode, docId, setDocId, text, setText, payload, ready };
};

export const SourcePicker = ({ source }) => {
  const [docs, setDocs] = useState([]);
  useEffect(() => {
    api
      .get("/documents")
      .then((r) => setDocs(r.data.filter((d) => d.format !== "video")));
  }, []);
  const { mode, setMode, docId, setDocId, text, setText } = source;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-full">
        {[
          ["doc", "Fiche de la bibliothèque", BookOpen, "ai-source-doc-tab"],
          ["text", "Coller un texte", ClipboardPaste, "ai-source-text-tab"],
        ].map(([m, l, Icon, t]) => (
          <button
            key={m}
            type="button"
            data-testid={t}
            onClick={() => setMode(m)}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors ${mode === m ? "bg-white shadow text-primary" : "text-slate-500"}`}
          >
            <Icon size={14} /> {l}
          </button>
        ))}
      </div>
      {mode === "doc" ? (
        <Select value={docId} onValueChange={setDocId}>
          <SelectTrigger
            data-testid="ai-source-doc-select"
            className="bg-white h-11"
          >
            <SelectValue placeholder="Choisis une fiche…" />
          </SelectTrigger>
          <SelectContent>
            {docs.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Textarea
          data-testid="ai-source-text-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder="Colle ici le contenu de ton cours (30 caractères minimum)…"
          className="bg-white"
        />
      )}
    </div>
  );
};

export const GenerateButton = ({
  loading,
  disabled,
  onClick,
  children = "Générer",
}) => (
  <Button
    data-testid="ai-generate-button"
    onClick={onClick}
    disabled={loading || disabled}
    className="w-full h-11 rounded-full shadow-[3px_3px_0_#d97706]"
  >
    {loading ? (
      <Loader2 size={16} className="animate-spin mr-2" />
    ) : (
      <Wand2 size={16} className="mr-2" />
    )}{" "}
    {loading ? "L'IA réfléchit…" : children}
  </Button>
);

export const ToolLayout = ({ title, description, controls, children }) => (
  <div className="grid lg:grid-cols-12 gap-6">
    <div className="lg:col-span-4 surface p-5 space-y-4 h-fit lg:sticky lg:top-24">
      <div>
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500 mt-1">{description}</p>
      </div>
      {controls}
    </div>
    <div className="lg:col-span-8 min-w-0">{children}</div>
  </div>
);

export const Thinking = ({ label = "Analyse du cours en cours…" }) => (
  <div
    data-testid="ai-thinking"
    className="surface p-10 flex flex-col items-center gap-3 text-slate-500"
  >
    <div className="flex gap-1.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-bounce"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </div>
    <span className="text-sm">{label}</span>
  </div>
);
