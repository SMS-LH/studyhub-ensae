import { useState } from "react";
import {
  CheckCircle2,
  ListChecks,
  RotateCcw,
  XCircle,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, formatError } from "@/lib/api";
import { EmptyState } from "@/components/common";
import {
  GenerateButton,
  SourcePicker,
  Thinking,
  ToolLayout,
  useSource,
} from "@/components/ai/shared";

const Question = ({ q, i, answer, onAnswer }) => (
  <div data-testid={`quiz-question-${i}`} className="surface p-5">
    <div className="text-xs font-mono text-amber-700 mb-1">
      Question {i + 1}
    </div>
    <div className="font-semibold text-slate-900">{q.question}</div>
    <div className="grid gap-2 mt-4">
      {q.options.map((o, j) => {
        const answered = answer !== undefined;
        const correct = j === q.answer_index;
        const cls = !answered
          ? "border-slate-200 hover:border-primary hover:bg-blue-50/50"
          : correct
            ? "border-emerald-400 bg-emerald-50 text-emerald-900"
            : j === answer
              ? "border-rose-400 bg-rose-50 text-rose-900"
              : "border-slate-200 opacity-60";
        return (
          <button
            key={j}
            data-testid={`quiz-q${i}-option-${j}`}
            disabled={answered}
            onClick={() => onAnswer(j)}
            className={`text-left text-sm border rounded-xl px-4 py-2.5 flex items-center gap-2 transition-colors ${cls}`}
          >
            <span className="font-mono text-xs text-slate-400">
              {String.fromCharCode(65 + j)}
            </span>{" "}
            <span className="flex-1">{o}</span>
            {answered && correct && (
              <CheckCircle2 size={16} className="text-emerald-600" />
            )}
            {answered && j === answer && !correct && (
              <XCircle size={16} className="text-rose-600" />
            )}
          </button>
        );
      })}
    </div>
    {answer !== undefined && q.explanation && (
      <p className="text-sm text-slate-600 mt-3 bg-slate-50 rounded-lg p-3 border-l-2 border-primary">
        {q.explanation}
      </p>
    )}
  </div>
);

export const QuizTool = ({ initialDocId }) => {
  const source = useSource(initialDocId);
  const [opts, setOpts] = useState({ count: "8", difficulty: "moyen" });
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setQuiz(null);
    setAnswers({});
    try {
      const { data } = await api.post("/ai/quiz", {
        ...source.payload,
        count: Number(opts.count),
        difficulty: opts.difficulty,
      });
      setQuiz(data);
    } catch (e) {
      toast.error(formatError(e));
    } finally {
      setLoading(false);
    }
  };

  const done = quiz && Object.keys(answers).length === quiz.questions.length;
  const score = quiz
    ? quiz.questions.filter((q, i) => answers[i] === q.answer_index).length
    : 0;
  const answer = (i, j) => {
    const next = { ...answers, [i]: j };
    setAnswers(next);
    if (Object.keys(next).length === quiz.questions.length)
      toast.success("Quiz terminé !");
  };

  return (
    <ToolLayout
      title="Générateur de QCM"
      description="Des questions à choix multiples avec correction et explications, tirées de ton cours."
      controls={
        <>
          <SourcePicker source={source} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Questions</Label>
              <Select
                value={opts.count}
                onValueChange={(v) => setOpts({ ...opts, count: v })}
              >
                <SelectTrigger
                  data-testid="quiz-count-select"
                  className="mt-1.5"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["5", "8", "10", "15"].map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Difficulté</Label>
              <Select
                value={opts.difficulty}
                onValueChange={(v) => setOpts({ ...opts, difficulty: v })}
              >
                <SelectTrigger
                  data-testid="quiz-difficulty-select"
                  className="mt-1.5"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["facile", "moyen", "difficile"].map((n) => (
                    <SelectItem key={n} value={n} className="capitalize">
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <GenerateButton
            loading={loading}
            disabled={!source.ready}
            onClick={run}
          >
            Générer le QCM
          </GenerateButton>
        </>
      }
    >
      {loading && <Thinking label="Rédaction des questions…" />}
      {!loading && !quiz && (
        <EmptyState
          testid="quiz-empty"
          icon={ListChecks}
          title="Ton QCM apparaîtra ici"
          text="Teste tes connaissances avant le partiel."
        />
      )}
      {quiz && (
        <div data-testid="ai-result-content" className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-xl font-bold text-slate-900">{quiz.title}</h3>
            <span
              data-testid="quiz-score"
              className="text-sm font-semibold bg-white border border-slate-200 rounded-full px-3 py-1"
            >
              {score} / {quiz.questions.length}
            </span>
          </div>
          {quiz.questions.map((q, i) => (
            <Question
              key={i}
              q={q}
              i={i}
              answer={answers[i]}
              onAnswer={(j) => answer(i, j)}
            />
          ))}
          {done && (
            <div
              data-testid="quiz-result-banner"
              className="rounded-2xl bg-primary text-white p-6 flex items-center gap-4 flex-wrap"
            >
              <Trophy className="text-amber-300" size={32} />
              <div className="flex-1">
                <div className="font-display text-2xl font-bold">
                  {Math.round((score / quiz.questions.length) * 100)} % de
                  bonnes réponses
                </div>
                <div className="text-sm text-blue-100">
                  {score >= quiz.questions.length * 0.7
                    ? "Excellent, tu maîtrises ce cours !"
                    : "Encore un effort : relis les explications."}
                </div>
              </div>
              <Button
                variant="secondary"
                data-testid="quiz-restart-button"
                onClick={() => setAnswers({})}
                className="rounded-full"
              >
                <RotateCcw size={14} className="mr-1" /> Recommencer
              </Button>
            </div>
          )}
        </div>
      )}
    </ToolLayout>
  );
};
