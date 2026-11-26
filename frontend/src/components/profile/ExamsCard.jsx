import { useEffect, useState } from "react";
import { GraduationCap, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, formatDate, formatError } from "@/lib/api";
import { DatePicker, toLocalISO } from "@/components/DatePicker";

const daysUntil = (d) =>
  Math.round(
    (new Date(`${d}T00:00:00`) - new Date(new Date().toDateString())) /
      86400000,
  );

export const ExamsCard = () => {
  const [exams, setExams] = useState([]);
  const [form, setForm] = useState({ subject: "", date: "" });

  useEffect(() => {
    api.get("/exams").then((r) => setExams(r.data));
  }, []);

  const add = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post("/exams", form);
      setExams((xs) =>
        [...xs.filter((x) => x.id !== data.id), data].sort((a, b) =>
          a.date.localeCompare(b.date),
        ),
      );
      setForm({ subject: "", date: "" });
      toast.success(
        "Examen ajouté : tu recevras des rappels à J-7, J-3 et J-1",
      );
    } catch (err) {
      toast.error(formatError(err));
    }
  };
  const remove = async (id) => {
    try {
      await api.delete(`/exams/${id}`);
      setExams((xs) => xs.filter((x) => x.id !== id));
      toast.success("Examen supprimé");
    } catch (err) {
      toast.error(formatError(err));
    }
  };
  const upcoming = exams.filter((x) => daysUntil(x.date) >= 0);

  return (
    <div className="surface p-5">
      <div className="flex items-center gap-2 mb-3">
        <GraduationCap size={16} className="text-rose-600" />
        <h3 className="text-lg font-bold">Mes examens</h3>
      </div>
      <ul data-testid="exams-list" className="space-y-2 mb-4">
        {upcoming.length === 0 && (
          <li className="text-sm text-slate-500">Aucun examen à venir.</li>
        )}
        {upcoming.map((x) => {
          const d = daysUntil(x.date);
          return (
            <li
              key={x.id}
              data-testid={`exam-${x.id}`}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{x.subject}</div>
                <div className="text-xs text-slate-500">
                  {formatDate(x.date)}
                </div>
              </div>
              <span
                className={`text-[11px] font-semibold rounded px-1.5 py-0.5 ${d <= 3 ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}`}
              >
                {d === 0 ? "Aujourd'hui" : `J-${d}`}
              </span>
              <button
                data-testid={`exam-delete-${x.id}`}
                onClick={() => remove(x.id)}
                className="text-slate-400 hover:text-rose-600"
              >
                <Trash2 size={13} />
              </button>
            </li>
          );
        })}
      </ul>
      <form onSubmit={add} className="space-y-2">
        <Input
          data-testid="exam-subject-input"
          value={form.subject}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
          placeholder="Matière"
          className="h-9"
        />
        <div className="flex gap-2">
          <DatePicker
            testid="exam-date-input"
            value={form.date}
            minDate={toLocalISO(new Date())}
            onChange={(v) => setForm({ ...form, date: v })}
            placeholder="Date de l'examen"
          />
          <Button
            type="submit"
            size="sm"
            data-testid="exam-add-button"
            disabled={!form.subject.trim() || !form.date}
            className="rounded-full h-9 shrink-0"
          >
            <Plus size={14} />
          </Button>
        </div>
      </form>
    </div>
  );
};
