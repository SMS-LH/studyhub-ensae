import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { DatePicker } from "@/components/DatePicker";

const EMPTY = {
  title: "",
  description: "",
  assignee_id: "none",
  due_date: "",
  status: "todo",
};

export const TaskDialog = ({ ws, task, onClose, onSaved }) => {
  const [form, setForm] = useState(EMPTY);
  const isEdit = !!task?.id;

  useEffect(() => {
    if (task)
      setForm(
        task.id
          ? {
              title: task.title,
              description: task.description || "",
              assignee_id: task.assignee_id || "none",
              due_date: task.due_date || "",
              status: task.status,
            }
          : EMPTY,
      );
  }, [task]);

  const submit = async (e) => {
    e.preventDefault();
    const body = {
      ...form,
      assignee_id: form.assignee_id === "none" ? null : form.assignee_id,
      due_date: form.due_date || null,
    };
    try {
      const { data } = isEdit
        ? await api.patch(`/workspaces/${ws.id}/tasks/${task.id}`, body)
        : await api.post(`/workspaces/${ws.id}/tasks`, body);
      toast.success(isEdit ? "Tâche mise à jour" : "Tâche créée");
      onSaved(data);
      onClose();
    } catch (err) {
      toast.error(formatError(err));
    }
  };

  const remove = async () => {
    await api.delete(`/workspaces/${ws.id}/tasks/${task.id}`);
    toast.success("Tâche supprimée");
    onSaved(task, true);
    onClose();
  };

  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="task-modal">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {isEdit ? "Modifier la tâche" : "Nouvelle tâche"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label>Titre</Label>
            <Input
              data-testid="task-title-input"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              data-testid="task-description-input"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={2}
              className="mt-1.5"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Assignée à</Label>
              <Select
                value={form.assignee_id}
                onValueChange={(v) => setForm({ ...form, assignee_id: v })}
              >
                <SelectTrigger
                  data-testid="task-assignee-select"
                  className="mt-1.5"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Personne</SelectItem>
                  {ws.members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date limite</Label>
              <DatePicker
                testid="task-due-input"
                value={form.due_date}
                onChange={(v) => setForm({ ...form, due_date: v })}
                className="mt-1.5 h-10"
              />
            </div>
          </div>
          <div className="flex gap-2">
            {isEdit && (
              <Button
                type="button"
                variant="ghost"
                data-testid="task-delete-button"
                onClick={remove}
                className="text-rose-600 hover:bg-rose-50"
              >
                <Trash2 size={15} className="mr-1" /> Supprimer
              </Button>
            )}
            <Button
              type="submit"
              data-testid="task-submit-button"
              className="ml-auto rounded-full px-6"
            >
              {isEdit ? "Enregistrer" : "Créer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
