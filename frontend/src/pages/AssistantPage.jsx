import { useSearchParams } from "react-router-dom";
import {
  Brain,
  Bug,
  CalendarRange,
  Layers,
  ListChecks,
  Quote,
  SpellCheck,
} from "lucide-react";
import { PageHeader } from "@/components/common";
import { SummaryTool } from "@/components/ai/SummaryTool";
import { DebuggerTool } from "@/components/ai/DebuggerTool";
import { QuizTool } from "@/components/ai/QuizTool";
import { FlashcardsTool } from "@/components/ai/FlashcardsTool";
import { CorrectorTool } from "@/components/ai/CorrectorTool";
import { ApaTool } from "@/components/ai/ApaTool";
import { PlannerTool } from "@/components/ai/PlannerTool";

const TOOLS = [
  {
    id: "summary",
    label: "Résumé Stats/Éco",
    icon: Brain,
    testid: "ai-tab-summary",
    el: SummaryTool,
  },
  {
    id: "debugger",
    label: "Debugger R/Python",
    icon: Bug,
    testid: "ai-tab-debugger",
    el: DebuggerTool,
  },
  {
    id: "quiz",
    label: "Quiz QCM",
    icon: ListChecks,
    testid: "ai-tab-quiz",
    el: QuizTool,
  },
  {
    id: "flashcards",
    label: "Flashcards",
    icon: Layers,
    testid: "ai-tab-flashcards",
    el: FlashcardsTool,
  },
  {
    id: "corrector",
    label: "Correcteur",
    icon: SpellCheck,
    testid: "ai-tab-corrector",
    el: CorrectorTool,
  },
  {
    id: "apa",
    label: "Citations APA",
    icon: Quote,
    testid: "ai-tab-apa",
    el: ApaTool,
  },
  {
    id: "planner",
    label: "Planificateur",
    icon: CalendarRange,
    testid: "ai-tab-planner",
    el: PlannerTool,
  },
];

export default function AssistantPage() {
  const [params, setParams] = useSearchParams();
  const current = TOOLS.find((t) => t.id === params.get("tool")) || TOOLS[0];
  const docId = params.get("doc") || "";
  const Tool = current.el;

  return (
    <div>
      <PageHeader
        eyebrow="Assistant IA ENSAE · Gemini"
        title="Ton assistant Stats, Économétrie & Code 24h/24."
      >
        Synthétise tes cours quantitatifs, débogue tes scripts R/Python/Stata,
        entraîne-toi avec des QCM et planifie tes partiels ENSAE.
      </PageHeader>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6" role="tablist">
        {TOOLS.map(({ id, label, icon: Icon, testid }) => (
          <button
            key={id}
            role="tab"
            data-testid={testid}
            onClick={() =>
              setParams(docId ? { tool: id, doc: docId } : { tool: id })
            }
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap border transition-[background-color,color,box-shadow] duration-200 ${
              current.id === id
                ? "bg-primary text-white border-primary shadow-[3px_3px_0_#d97706]"
                : "bg-white text-slate-600 border-slate-200 hover:border-primary/40"
            }`}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>
      <div key={current.id} className="fade-up">
        <Tool initialDocId={docId} />
      </div>
    </div>
  );
}
