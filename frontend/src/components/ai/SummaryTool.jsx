import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Brain, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatError, streamSSE } from "@/lib/api";
import { EmptyState } from "@/components/common";
import {
  GenerateButton,
  SourcePicker,
  Thinking,
  ToolLayout,
  useSource,
} from "@/components/ai/shared";

export const SummaryTool = ({ initialDocId }) => {
  const source = useSource(initialDocId);
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setOutput("");
    try {
      await streamSSE("/ai/summary", source.payload, (delta) =>
        setOutput((cur) => cur + delta),
      );
    } catch (e) {
      toast.error(formatError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolLayout
      title="Synthèse & Fiche ENSAE"
      description="Transforme un cours de Stats, Économétrie, Probabilités ou Macro en fiche structurée avec théorèmes, tests et points de vigilance."
      controls={
        <>
          <SourcePicker source={source} />
          <GenerateButton
            loading={loading}
            disabled={!source.ready}
            onClick={run}
          >
            Générer la fiche
          </GenerateButton>
        </>
      }
    >
      {loading && !output && <Thinking label="Synthèse Gemini en cours…" />}
      {!loading && !output && (
        <EmptyState
          testid="summary-empty"
          icon={Brain}
          title="Ta fiche de révision apparaîtra ici"
          text="Sélectionne une fiche ENSAE ou colle un extrait de cours à gauche."
        />
      )}
      {output && (
        <div data-testid="ai-result-content" className="surface p-6 sm:p-8">
          <div className="flex items-center justify-between mb-4">
            <span className="eyebrow">Fiche générée par Gemini</span>
            <Button
              size="sm"
              variant="outline"
              data-testid="summary-copy-button"
              onClick={() => {
                navigator.clipboard.writeText(output);
                toast.success("Fiche copiée");
              }}
              className="rounded-full"
            >
              <Copy size={13} className="mr-1" /> Copier
            </Button>
          </div>
          <div className="markdown">
            <ReactMarkdown>{output}</ReactMarkdown>
          </div>
        </div>
      )}
    </ToolLayout>
  );
};
