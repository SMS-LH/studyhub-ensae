import { useState } from "react";
import { Copy, SpellCheck, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api, formatError } from "@/lib/api";
import { EmptyState } from "@/components/common";
import { GenerateButton, Thinking, ToolLayout } from "@/components/ai/shared";

const MODES = [
  ["correct", "Corriger l'orthographe"],
  ["style", "Améliorer le style"],
  ["rephrase", "Reformuler"],
];

export const CorrectorTool = () => {
  const [text, setText] = useState("");
  const [mode, setMode] = useState("correct");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data } = await api.post("/ai/correct", { text, mode });
      setResult(data);
    } catch (e) {
      toast.error(formatError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolLayout
      title="Correcteur & reformulateur"
      description="Orthographe, grammaire, style académique pour tes rapports, mémoires et dissertations."
      controls={
        <>
          <div className="flex flex-wrap gap-2">
            {MODES.map(([m, l]) => (
              <button
                key={m}
                data-testid={`corrector-mode-${m}`}
                onClick={() => setMode(m)}
                className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${mode === m ? "bg-blue-50 border-primary text-primary font-semibold" : "border-slate-200 text-slate-600"}`}
              >
                {l}
              </button>
            ))}
          </div>
          <Textarea
            data-testid="corrector-text-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            className="bg-white"
            placeholder="Colle ici un paragraphe de ton rapport…"
          />
          <GenerateButton
            loading={loading}
            disabled={text.trim().length < 3}
            onClick={run}
          >
            Lancer la correction
          </GenerateButton>
        </>
      }
    >
      {loading && <Thinking label="Relecture attentive…" />}
      {!loading && !result && (
        <EmptyState
          testid="corrector-empty"
          icon={SpellCheck}
          title="Le texte corrigé apparaîtra ici"
          text="Chaque modification est expliquée pour que tu progresses."
        />
      )}
      {result && (
        <div data-testid="ai-result-content" className="space-y-5">
          <div className="surface p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="eyebrow">Texte final</div>
              <Button
                size="sm"
                variant="outline"
                data-testid="corrector-copy-button"
                onClick={() => {
                  navigator.clipboard.writeText(result.corrected);
                  toast.success("Copié");
                }}
                className="rounded-full"
              >
                <Copy size={13} className="mr-1" /> Copier
              </Button>
            </div>
            <p
              data-testid="corrector-output"
              className="text-slate-800 leading-relaxed whitespace-pre-line"
            >
              {result.corrected}
            </p>
            {result.comment && (
              <p className="text-sm text-slate-500 mt-4 italic">
                {result.comment}
              </p>
            )}
          </div>
          {result.changes?.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-slate-700">
                {result.changes.length} modification(s)
              </div>
              {result.changes.map((c, i) => (
                <div
                  key={i}
                  data-testid={`corrector-change-${i}`}
                  className="surface p-4 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="line-through text-rose-600 bg-rose-50 px-1.5 rounded">
                      {c.original}
                    </span>
                    <ArrowRight size={14} className="text-slate-400" />
                    <span className="text-emerald-700 bg-emerald-50 px-1.5 rounded font-medium">
                      {c.correction}
                    </span>
                  </div>
                  <p className="text-slate-500 mt-1.5">{c.explanation}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </ToolLayout>
  );
};
