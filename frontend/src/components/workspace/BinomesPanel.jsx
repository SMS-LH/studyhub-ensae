import { useEffect, useState } from "react";
import { Plus, Trash2, UserPlus, Users } from "lucide-react";
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
import { api, formatError, timeAgo } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { EmptyState, Initials, SUBJECTS } from "@/components/common";

export const BinomesPanel = ({ ws, onChange }) => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({
    subject: "Économétrie",
    title: "",
    description: "",
    spots_needed: 1,
  });

  useEffect(() => {
    api.get(`/workspaces/${ws.id}/binomes`).then((r) => setItems(r.data));
  }, [ws.id]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post(`/workspaces/${ws.id}/binomes`, {
        ...form,
        spots_needed: Number(form.spots_needed) || 1,
      });
      setItems([data, ...items]);
      setForm({
        subject: "Économétrie",
        title: "",
        description: "",
        spots_needed: 1,
      });
      toast.success("Annonce de binôme publiée !");
      onChange?.();
    } catch (err) {
      toast.error(formatError(err));
    }
  };

  const toggleJoin = async (bid) => {
    try {
      const { data } = await api.post(`/workspaces/${ws.id}/binomes/${bid}/join`);
      setItems(items.map((x) => (x.id === bid ? data : x)));
      toast.success("Participation mise à jour");
    } catch (err) {
      toast.error(formatError(err));
    }
  };

  const remove = async (bid) => {
    await api.delete(`/workspaces/${ws.id}/binomes/${bid}`);
    setItems(items.filter((x) => x.id !== bid));
    toast.success("Annonce supprimée");
  };

  return (
    <div className="space-y-5">
      <form
        onSubmit={submit}
        data-testid="binome-form"
        className="surface p-4 space-y-3"
      >
        <div className="eyebrow">Publier une annonce « Cherche un binôme »</div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Matière / TD</Label>
            <Select
              value={form.subject}
              onValueChange={(v) => setForm({ ...form, subject: v })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUBJECTS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Places recherchées</Label>
            <Input
              type="number"
              min="1"
              max="5"
              value={form.spots_needed}
              onChange={(e) =>
                setForm({ ...form, spots_needed: e.target.value })
              }
              className="mt-1"
            />
          </div>
        </div>
        <Input
          data-testid="binome-title-input"
          required
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Ex. Cherche binôme pour projet R d'Économétrie"
        />
        <Textarea
          data-testid="binome-desc-input"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={2}
          placeholder="Précise tes disponibilités ou tes outils (R, Python, SAS)…"
        />
        <Button
          type="submit"
          data-testid="binome-submit-button"
          className="rounded-full"
        >
          <Plus size={14} className="mr-1.5" /> Publier l'annonce
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Aucune annonce de binôme"
          text="Publie une annonce pour trouver un partenaire de TD ou de projet."
        />
      ) : (
        <div data-testid="binomes-list" className="space-y-3">
          {items.map((b) => {
            const joined = (b.interested || []).some((p) => p.id === user.id);
            return (
              <div
                key={b.id}
                data-testid={`binome-card-${b.id}`}
                className="surface p-4 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-bold bg-blue-50 text-primary border border-blue-200 rounded px-2 py-0.5">
                        {b.subject}
                      </span>
                      <span className="text-xs text-slate-500">
                        {b.spots_needed} place(s) · {timeAgo(b.created_at)}
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-900">{b.title}</h4>
                  </div>
                  {b.author_id === user.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(b.id)}
                      className="text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
                {b.description && (
                  <p className="text-sm text-slate-600">{b.description}</p>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Initials name={b.author_name} className="h-6 w-6 text-[10px]" />
                    <span>
                      {b.author_name}
                      {b.author_level ? ` (${b.author_level})` : ""}
                    </span>
                    {b.interested?.length > 0 && (
                      <span className="text-emerald-700 font-semibold">
                        · {b.interested.length} intéressé(s) (
                        {b.interested.map((p) => p.name).join(", ")})
                      </span>
                    )}
                  </div>
                  {b.author_id !== user.id && (
                    <Button
                      size="sm"
                      variant={joined ? "secondary" : "outline"}
                      data-testid={`binome-join-${b.id}`}
                      onClick={() => toggleJoin(b.id)}
                      className="rounded-full text-xs"
                    >
                      <UserPlus size={13} className="mr-1" />
                      {joined ? "Me retirer" : "Je suis dispo"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
