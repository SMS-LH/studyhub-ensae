import { useEffect, useState } from "react";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, formatDate, formatError } from "@/lib/api";
import { Initials } from "@/components/common";
import { TaskDialog } from "@/components/workspace/TaskDialog";

const COLS = [
  {
    id: "todo",
    label: "À faire",
    testid: "kanban-col-todo",
    dot: "bg-slate-400",
  },
  {
    id: "doing",
    label: "En cours",
    testid: "kanban-col-in-progress",
    dot: "bg-amber-500",
  },
  {
    id: "done",
    label: "Terminé",
    testid: "kanban-col-done",
    dot: "bg-emerald-500",
  },
];
const ORDER = COLS.map((c) => c.id);

const dueClass = (task) => {
  if (!task.due_date || task.status === "done")
    return "text-slate-500 bg-slate-100";
  const days =
    (new Date(task.due_date) - new Date(new Date().toDateString())) / 86400000;
  return days < 0
    ? "text-rose-700 bg-rose-100"
    : days <= 3
      ? "text-amber-800 bg-amber-100"
      : "text-slate-600 bg-slate-100";
};

const TaskCard = ({ task, onMove, onEdit }) => {
  const i = ORDER.indexOf(task.status);
  return (
    <div
      data-testid={`kanban-task-${task.id}`}
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", task.id)}
      className="group bg-white border border-slate-200 rounded-xl p-3 shadow-sm cursor-grab active:cursor-grabbing hover:border-primary/40 transition-colors"
    >
      <div className="flex items-start gap-2">
        <span
          className={`text-sm font-semibold flex-1 ${task.status === "done" ? "line-through text-slate-400" : "text-slate-900"}`}
        >
          {task.title}
        </span>
        <button
          data-testid={`kanban-task-edit-${task.id}`}
          onClick={() => onEdit(task)}
          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-primary transition-opacity"
        >
          <Pencil size={13} />
        </button>
      </div>
      {task.description && (
        <p className="text-xs text-slate-500 mt-1 line-clamp-2">
          {task.description}
        </p>
      )}
      <div className="flex items-center gap-2 mt-3">
        {task.assignee_name ? (
          <Initials name={task.assignee_name} className="h-6 w-6 text-[10px]" />
        ) : (
          <span className="text-[11px] text-slate-400">Non assignée</span>
        )}
        {task.due_date && (
          <span
            className={`text-[11px] font-medium rounded px-1.5 py-0.5 flex items-center gap-1 ${dueClass(task)}`}
          >
            <CalendarClock size={11} />{" "}
            {formatDate(task.due_date, { day: "numeric", month: "short" })}
          </span>
        )}
        <div className="ml-auto flex">
          <button
            data-testid={`kanban-task-left-${task.id}`}
            disabled={i === 0}
            onClick={() => onMove(task, ORDER[i - 1])}
            className="p-1 text-slate-400 hover:text-primary disabled:opacity-20"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            data-testid={`kanban-task-right-${task.id}`}
            disabled={i === 2}
            onClick={() => onMove(task, ORDER[i + 1])}
            className="p-1 text-slate-400 hover:text-primary disabled:opacity-20"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};

export const KanbanBoard = ({ ws, onChange }) => {
  const [tasks, setTasks] = useState([]);
  const [editing, setEditing] = useState(null);
  const [over, setOver] = useState(null);

  useEffect(() => {
    api.get(`/workspaces/${ws.id}/tasks`).then((r) => setTasks(r.data));
  }, [ws.id]);

  const move = async (task, status) => {
    if (task.status === status) return;
    const prev = task.status;
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, status } : t)));
    try {
      await api.patch(`/workspaces/${ws.id}/tasks/${task.id}`, { status });
      toast.success(
        `Tâche déplacée vers « ${COLS.find((c) => c.id === status).label} »`,
      );
      onChange();
    } catch (e) {
      setTasks((ts) =>
        ts.map((t) => (t.id === task.id ? { ...t, status: prev } : t)),
      );
      toast.error(formatError(e));
    }
  };

  const saved = (task, deleted) => {
    setTasks((ts) =>
      deleted
        ? ts.filter((t) => t.id !== task.id)
        : ts.some((t) => t.id === task.id)
          ? ts.map((t) => (t.id === task.id ? task : t))
          : [...ts, task],
    );
    onChange();
  };

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button
          data-testid="kanban-add-task-button"
          onClick={() => setEditing({})}
          className="rounded-full"
        >
          <Plus size={15} className="mr-1" /> Nouvelle tâche
        </Button>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {COLS.map((col) => {
          const items = tasks.filter((t) => t.status === col.id);
          return (
            <div
              key={col.id}
              data-testid={col.testid}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(col.id);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                setOver(null);
                const t = tasks.find(
                  (x) => x.id === e.dataTransfer.getData("text/plain"),
                );
                if (t) move(t, col.id);
              }}
              className={`rounded-2xl p-3 min-h-[320px] border transition-colors ${over === col.id ? "bg-blue-50 border-primary/40" : "bg-slate-100/80 border-slate-200"}`}
            >
              <div className="flex items-center gap-2 px-1 mb-3">
                <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                <span className="font-display font-bold text-slate-800">
                  {col.label}
                </span>
                <span className="ml-auto text-xs font-mono text-slate-500">
                  {items.length}
                </span>
              </div>
              <div className="space-y-2.5">
                {items.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    onMove={move}
                    onEdit={setEditing}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <TaskDialog
        ws={ws}
        task={editing}
        onClose={() => setEditing(null)}
        onSaved={saved}
      />
    </div>
  );
};
