import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, ExternalLink, Link2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, formatError, timeAgo } from "@/lib/api";

const EMPTY = { title: "", url: "", document_id: "none", note: "" };

export const ResourcesPanel = ({ ws, onChange }) => {
  const [items, setItems] = useState([]);
  const [docs, setDocs] = useState([]);
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    api.get(`/workspaces/${ws.id}/resources`).then((r) => setItems(r.data));
    api.get("/documents").then((r) => setDocs(r.data));
  }, [ws.id]);

  const add = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post(`/workspaces/${ws.id}/resources`, {
        ...form,
        document_id: form.document_id === "none" ? null : form.document_id,
      });
      setItems([data, ...items]);
      setForm(EMPTY);
      onChange();
      toast.success("Ressource ajoutée");
    } catch (err) {
      toast.error(formatError(err));
    }
  };
  const remove = async (id) => {
    await api.delete(`/workspaces/${ws.id}/resources/${id}`);
    setItems(items.filter((i) => i.id !== id));
  };

  return (
    <div className="space-y-4">
      <form
        onSubmit={add}
        className="surface p-4 grid sm:grid-cols-2 gap-3"
        data-testid="resource-form"
      >
        <Input
          data-testid="resource-title-input"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Titre (facultatif pour une fiche)"
        />
        <Input
          data-testid="resource-url-input"
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
          placeholder="Lien https://…"
        />
        <Select
          value={form.document_id}
          onValueChange={(v) => setForm({ ...form, document_id: v })}
        >
          <SelectTrigger data-testid="resource-doc-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">
              …ou lier une fiche de la bibliothèque
            </SelectItem>
            {docs.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="submit"
          data-testid="resource-add-button"
          disabled={!form.title.trim() && form.document_id === "none"}
          className="rounded-full"
        >
          <Plus size={15} className="mr-1" /> Ajouter la ressource
        </Button>
      </form>
      <div data-testid="resources-list" className="space-y-2">
        {items.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-6">
            Aucune ressource partagée.
          </p>
        )}
        {items.map((r) => (
          <div
            key={r.id}
            data-testid={`resource-${r.id}`}
            className="surface p-4 flex items-center gap-3"
          >
            <span className="h-9 w-9 rounded-lg bg-amber-50 text-amber-700 grid place-items-center shrink-0">
              {r.document_id ? <BookOpen size={16} /> : <Link2 size={16} />}
            </span>
            <div className="min-w-0 flex-1">
              {r.document_id ? (
                <Link
                  to={`/fiche/${r.document_id}`}
                  className="font-semibold text-slate-900 hover:text-primary"
                >
                  {r.title}
                </Link>
              ) : r.url ? (
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-slate-900 hover:text-primary inline-flex items-center gap-1"
                >
                  {r.title} <ExternalLink size={12} />
                </a>
              ) : (
                <span className="font-semibold text-slate-900">{r.title}</span>
              )}
              <div className="text-xs text-slate-500">
                Ajoutée par {r.added_by} · {timeAgo(r.created_at)}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              data-testid={`resource-delete-${r.id}`}
              onClick={() => remove(r.id)}
              className="text-slate-400 hover:text-rose-600"
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};
