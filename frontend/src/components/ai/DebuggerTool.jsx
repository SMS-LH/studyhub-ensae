import { useState } from "react";
import { Bug, CheckCircle2, Copy, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, formatError } from "@/lib/api";
import { EmptyState } from "@/components/common";
import { GenerateButton, Thinking, ToolLayout } from "@/components/ai/shared";

const SAMPLE_R = `library(lmtest)
df <- data.frame(y = c(10, 12, NA, 15), x = c(1, 2, 3, 4))
moy <- mean(df$y)
modele <- lm(y ~ x + x2, data = df)
summary(modele)`;

export const DebuggerTool = () => {
  const [language, setLanguage] = useState("R");
  const [code, setCode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data } = await api.post("/ai/debug", {
        language,
        code,
        error_message: errorMsg,
      });
      setResult(data);
    } catch (e) {
      toast.error(formatError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolLayout
      title="Debugger de code R / Python"
      description="Colle un script R, Python, Stata (.do) ou SAS qui plante : l'IA diagnostique l'erreur et propose la version corrigée."
      controls={
        <>
          <div className="flex items-center justify-between gap-2">
            <Label>Langage</Label>
            <button
              type="button"
              onClick={() => {
                setLanguage("R");
                setCode(SAMPLE_R);
                setErrorMsg("Error in eval(predvars, data, env) : objet 'x2' introuvable");
              }}
              className="text-xs text-primary hover:underline font-medium"
            >
              Charger un exemple R
            </button>
          </div>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger data-testid="debugger-language-select" className="bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["R", "Python", "Stata", "SAS", "Auto"].map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div>
            <Label>Code qui pose problème</Label>
            <Textarea
              data-testid="debugger-code-input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              rows={9}
              placeholder="Colle ton script R (lm, tidyverse, sandwich...) ou Python (pandas, statsmodels...)"
              className="mt-1.5 font-mono text-xs bg-white"
            />
          </div>
          <div>
            <Label>Message d'erreur (optionnel)</Label>
            <Input
              data-testid="debugger-error-input"
              value={errorMsg}
              onChange={(e) => setErrorMsg(e.target.value)}
              placeholder="Ex. Error in solve.default(...): system is computationally singular"
              className="mt-1.5 bg-white font-mono text-xs"
            />
          </div>
          <GenerateButton
            loading={loading}
            disabled={code.trim().length < 5}
            onClick={run}
          >
            Analyser et corriger
          </GenerateButton>
        </>
      }
    >
      {loading && <Thinking label="Analyse du script statistique…" />}
      {!loading && !result && (
        <EmptyState
          testid="debugger-empty"
          icon={Bug}
          title="Le diagnostic du code apparaîtra ici"
          text="Idéal pour débloquer un TD sous R, pandas, statsmodels, Stata ou SAS."
        />
      )}
      {result && (
        <div data-testid="ai-result-content" className="space-y-4">
          <div className="surface p-5 border-l-4 border-l-amber-500">
            <div className="eyebrow mb-1">Diagnostic</div>
            <h3 className="text-lg font-bold text-slate-900">
              {result.diagnosis}
            </h3>
            <p className="text-sm text-slate-700 mt-2 leading-relaxed">
              {result.explanation}
            </p>
          </div>
          <div className="surface p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 font-bold text-emerald-700 text-sm">
                <CheckCircle2 size={16} /> Code corrigé ({language})
              </div>
              <Button
                size="sm"
                variant="outline"
                data-testid="debugger-copy-button"
                onClick={() => {
                  navigator.clipboard.writeText(result.fixed_code || "");
                  toast.success("Code corrigé copié");
                }}
                className="rounded-full"
              >
                <Copy size={13} className="mr-1" /> Copier
              </Button>
            </div>
            <pre
              data-testid="debugger-fixed-code"
              className="bg-slate-950 text-slate-100 rounded-xl p-4 font-mono text-xs overflow-x-auto leading-relaxed"
            >
              {result.fixed_code}
            </pre>
          </div>
          {result.tips?.length > 0 && (
            <div className="surface p-5">
              <div className="flex items-center gap-2 font-semibold text-slate-900 mb-2">
                <Lightbulb size={16} className="text-amber-600" /> Bonnes
                pratiques ENSAE
              </div>
              <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
                {result.tips.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </ToolLayout>
  );
};
