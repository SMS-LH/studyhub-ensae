import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Copy, Quote } from "lucide-react";
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

const TYPES = {
  livre: ["Auteur(s)", "Année", "Titre", "Éditeur", "Édition"],
  article: [
    "Auteur(s)",
    "Année",
    "Titre de l'article",
    "Revue",
    "Volume",
    "Numéro",
    "Pages",
    "DOI",
  ],
  site: [
    "Auteur / organisme",
    "Date de publication",
    "Titre de la page",
    "Nom du site",
    "URL",
  ],
  chapitre: [
    "Auteur(s)",
    "Année",
    "Titre du chapitre",
    "Directeur(s) de l'ouvrage",
    "Titre de l'ouvrage",
    "Pages",
    "Éditeur",
  ],
};
const LABELS = {
  livre: "Livre",
  article: "Article scientifique",
  site: "Page web",
  chapitre: "Chapitre d'ouvrage",
};

const Row = ({ label, value, testid }) => (
  <div className="surface p-5">
    <div className="flex items-center justify-between mb-2">
      <div className="eyebrow">{label}</div>
      <Button
        size="sm"
        variant="ghost"
        data-testid={`${testid}-copy`}
        onClick={() => {
          navigator.clipboard.writeText(value.replace(/\*/g, ""));
          toast.success("Copié");
        }}
      >
        <Copy size={13} />
      </Button>
    </div>
    <div data-testid={testid} className="markdown text-slate-800 [&_p]:my-0">
      <ReactMarkdown>{value}</ReactMarkdown>
    </div>
  </div>
);

export const ApaTool = () => {
  const [type, setType] = useState("livre");
  const [fields, setFields] = useState({});
  const [free, setFree] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const filled =
    free.trim().length > 4 || Object.values(fields).some((v) => v.trim());

  const run = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data } = await api.post("/ai/citation", {
        source_type: LABELS[type],
        fields,
        free_text: free,
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
      title="Citations APA 7"
      description="Génère la référence bibliographique et la citation dans le texte, aux normes APA."
      controls={
        <>
          <Select
            value={type}
            onValueChange={(v) => {
              setType(v);
              setFields({});
            }}
          >
            <SelectTrigger data-testid="apa-type-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(LABELS).map(([k, l]) => (
                <SelectItem key={k} value={k}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="space-y-2.5">
            {TYPES[type].map((f, i) => (
              <div key={f}>
                <Label className="text-xs">{f}</Label>
                <Input
                  data-testid={`apa-field-${i}`}
                  value={fields[f] || ""}
                  onChange={(e) =>
                    setFields({ ...fields, [f]: e.target.value })
                  }
                  className="mt-1 h-9"
                />
              </div>
            ))}
          </div>
          <div>
            <Label className="text-xs">…ou colle les infos en vrac</Label>
            <Textarea
              data-testid="apa-free-input"
              value={free}
              onChange={(e) => setFree(e.target.value)}
              rows={3}
              className="mt-1"
              placeholder="Bourdieu, La distinction, Minuit 1979"
            />
          </div>
          <GenerateButton loading={loading} disabled={!filled} onClick={run}>
            Générer la citation
          </GenerateButton>
        </>
      }
    >
      {loading && <Thinking label="Mise en forme APA…" />}
      {!loading && !result && (
        <EmptyState
          testid="apa-empty"
          icon={Quote}
          title="Ta référence apparaîtra ici"
          text="Prête à copier dans ta bibliographie."
        />
      )}
      {result && (
        <div data-testid="ai-result-content" className="space-y-4">
          <Row
            label="Référence bibliographique"
            value={result.reference || ""}
            testid="apa-reference"
          />
          <div className="grid sm:grid-cols-2 gap-4">
            <Row
              label="Citation entre parenthèses"
              value={result.in_text || ""}
              testid="apa-in-text"
            />
            <Row
              label="Citation narrative"
              value={result.in_text_narrative || ""}
              testid="apa-narrative"
            />
          </div>
          {result.missing?.length > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
              <span className="font-semibold">À compléter :</span>{" "}
              {result.missing.join(", ")}
            </div>
          )}
        </div>
      )}
    </ToolLayout>
  );
};
