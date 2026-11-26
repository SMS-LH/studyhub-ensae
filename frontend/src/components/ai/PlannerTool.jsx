import { useEffect, useState } from "react";
import {
  CalendarRange,
  Coffee,
  GraduationCap,
  Lightbulb,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, formatDate, formatError } from "@/lib/api";
import { EmptyState } from "@/components/common";
import { GenerateButton, Thinking, ToolLayout } from "@/components/ai/shared";
import { DatePicker, toLocalISO } from "@/components/DatePicker";

const today = () => toLocalISO(new Date());
const inDays = (n) => toLocalISO(new Date(Date.now() + n * 86400000));

const ExamRow = ({ exam, i, onChange, onRemove }) => (
  <div
    data-testid={`planner-exam-${i}`}
    className="border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50/50"
  >
    <div className="flex gap-2">
      <Input
        data-testid={`planner-exam-subject-${i}`}
        value={exam.subject}
        onChange={(e) => onChange({ ...exam, subject: e.target.value })}
        placeholder="Matière"
        className="h-9 bg-white"
      />
      <Button
        variant="ghost"
        size="icon"
        data-testid={`planner-exam-remove-${i}`}
        onClick={onRemove}
        className="text-slate-400 hover:text-rose-600 shrink-0"
      >
        <Trash2 size={14} />
      </Button>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <DatePicker
        testid={`planner-exam-date-${i}`}
        value={exam.date}
        minDate={today()}
        onChange={(v) => onChange({ ...exam, date: v })}
      />
      <Select
        value={exam.difficulty}
        onValueChange={(v) => onChange({ ...exam, difficulty: v })}
      >
        <SelectTrigger className="h-9 bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {["facile", "moyen", "difficile"].map((d) => (
            <SelectItem key={d} value={d}>
              {d}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  </div>
);

const Day = ({ day, i }) => (
  <div
    data-testid={`planner-day-${i}`}
    className={`rounded-xl border p-4 ${day.is_exam ? "bg-rose-50 border-rose-200" : day.is_rest ? "bg-emerald-50/60 border-emerald-200" : "bg-white border-slate-200"}`}
  >
    <div className="flex items-center gap-2 mb-2">
      {day.is_exam ? (
        <GraduationCap size={15} className="text-rose-600" />
      ) : day.is_rest ? (
        <Coffee size={15} className="text-emerald-600" />
      ) : null}
      <span className="font-semibold text-sm text-slate-900 capitalize">
        {formatDate(day.date, {
          weekday: "short",
          day: "numeric",
          month: "short",
        })}
      </span>
      {day.focus && (
        <span className="text-xs text-slate-500 truncate">· {day.focus}</span>
      )}
    </div>
    <ul className="space-y-1.5">
      {(day.sessions || []).map((s, j) => (
        <li key={j} className="text-sm flex gap-2">
          <span className="font-mono text-[11px] text-amber-700 bg-amber-50 rounded px-1 h-fit mt-0.5 shrink-0">
            {s.duration_min}′
          </span>
          <span>
            <span className="font-semibold text-slate-800">{s.subject}</span> —{" "}
            <span className="text-slate-600">{s.task}</span>
          </span>
        </li>
      ))}
    </ul>
  </div>
);

export const PlannerTool = () => {
  const [exams, setExams] = useState([
    { subject: "", date: inDays(14), difficulty: "moyen" },
  ]);
  const [hours, setHours] = useState("3");
  const [start, setStart] = useState(today());
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/ai/plan").then((r) => r.data && setPlan(r.data));
  }, []);

  const run = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/ai/plan", {
        exams,
        hours_per_day: Number(hours),
        start_date: start,
      });
      setPlan(data);
      toast.success("Rétroplanning créé !");
    } catch (e) {
      toast.error(formatError(e));
    } finally {
      setLoading(false);
    }
  };

  const valid =
    exams.length > 0 && exams.every((e) => e.subject.trim() && e.date);
  const result = plan?.result;

  return (
    <ToolLayout
      title="Rétroplanning Partiels ENSAE"
      description="Entre tes dates de partiels (Économétrie, Micro, Probabilités…), l'IA construit ton planning jour par jour."
      controls={
        <>
          <div className="flex flex-wrap gap-1.5">
            {["Économétrie", "Microéconomie", "Probabilités", "Statistique mathématique"].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() =>
                  setExams((cur) => {
                    const emptyIdx = cur.findIndex((e) => !e.subject.trim());
                    if (emptyIdx >= 0) {
                      return cur.map((e, j) => (j === emptyIdx ? { ...e, subject: m } : e));
                    }
                    return [...cur, { subject: m, date: inDays(14), difficulty: "difficile" }];
                  })
                }
                className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-primary hover:bg-blue-100 font-medium"
              >
                + {m}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {exams.map((ex, i) => (
              <ExamRow
                key={i}
                exam={ex}
                i={i}
                onChange={(v) =>
                  setExams(exams.map((e, j) => (j === i ? v : e)))
                }
                onRemove={() => setExams(exams.filter((_, j) => j !== i))}
              />
            ))}
            <Button
              variant="outline"
              size="sm"
              data-testid="planner-add-exam-button"
              onClick={() =>
                setExams([
                  ...exams,
                  { subject: "", date: inDays(21), difficulty: "moyen" },
                ])
              }
              className="w-full rounded-full border-dashed"
            >
              <Plus size={14} className="mr-1" /> Ajouter un examen
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Début des révisions</Label>
              <DatePicker
                testid="planner-start-input"
                value={start}
                onChange={setStart}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Heures / jour</Label>
              <Input
                type="number"
                min="1"
                max="12"
                step="0.5"
                data-testid="planner-hours-input"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="mt-1 h-9"
              />
            </div>
          </div>
          <GenerateButton loading={loading} disabled={!valid} onClick={run}>
            Créer mon planning
          </GenerateButton>
        </>
      }
    >
      {loading && <Thinking label="Calcul du rétroplanning…" />}
      {!loading && !result && (
        <EmptyState
          testid="planner-empty"
          icon={CalendarRange}
          title="Ton planning apparaîtra ici"
          text="Répétition espacée, matières difficiles prioritaires, jours de repos."
        />
      )}
      {!loading && result && (
        <div data-testid="ai-result-content" className="space-y-5">
          <div className="rounded-2xl bg-primary text-white p-6">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300 mb-2">
              Stratégie
            </div>
            <p data-testid="planner-overview" className="leading-relaxed">
              {result.overview}
            </p>
          </div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {(result.days || []).map((d, i) => (
              <Day key={i} day={d} i={i} />
            ))}
          </div>
          {result.tips?.length > 0 && (
            <div className="surface p-5">
              <div className="flex items-center gap-2 font-semibold text-slate-900 mb-2">
                <Lightbulb size={16} className="text-amber-600" /> Conseils
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
