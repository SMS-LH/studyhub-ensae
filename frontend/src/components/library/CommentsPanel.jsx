import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, formatError, timeAgo } from "@/lib/api";
import { Initials } from "@/components/common";

export const CommentsPanel = ({ docId, onCount }) => {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ text: "", kind: "comment", page: "" });

  useEffect(() => {
    api.get(`/documents/${docId}/comments`).then((r) => setItems(r.data));
  }, [docId]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post(`/documents/${docId}/comments`, form);
      const next = [data, ...items];
      setItems(next);
      onCount(next.length);
      setForm({ text: "", kind: form.kind, page: "" });
      toast.success(
        form.kind === "error"
          ? "Erreur signalée, merci !"
          : "Commentaire publié",
      );
    } catch (err) {
      toast.error(formatError(err));
    }
  };

  const toggle = async (c) => {
    const { data } = await api.patch(`/comments/${c.id}/resolve`);
    setItems(items.map((i) => (i.id === c.id ? data : i)));
  };

  return (
    <div className="space-y-5">
      <form
        onSubmit={submit}
        className="surface p-4 space-y-3"
        data-testid="comment-form"
      >
        <div className="flex gap-2">
          {[
            [
              "comment",
              "Commentaire",
              MessageSquare,
              "doc-comment-kind-button",
            ],
            [
              "error",
              "Signaler une erreur",
              AlertTriangle,
              "doc-report-error-button",
            ],
          ].map(([k, l, Icon, t]) => (
            <button
              type="button"
              key={k}
              data-testid={t}
              onClick={() => setForm({ ...form, kind: k })}
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-colors ${form.kind === k ? (k === "error" ? "bg-rose-50 border-rose-300 text-rose-700" : "bg-blue-50 border-blue-300 text-primary") : "border-slate-200 text-slate-500"}`}
            >
              <Icon size={14} /> {l}
            </button>
          ))}
        </div>
        <Textarea
          data-testid="comment-text-input"
          required
          value={form.text}
          onChange={(e) => setForm({ ...form, text: e.target.value })}
          rows={3}
          placeholder={
            form.kind === "error"
              ? "Décris l'erreur et la correction attendue…"
              : "Ton avis, une question, un complément…"
          }
        />
        <div className="flex gap-2">
          <Input
            data-testid="comment-page-input"
            value={form.page}
            onChange={(e) => setForm({ ...form, page: e.target.value })}
            placeholder="Page / diapo / minute (optionnel)"
            className="max-w-xs"
          />
          <Button
            type="submit"
            data-testid="comment-submit-button"
            className="ml-auto rounded-full"
          >
            <Send size={14} className="mr-2" /> Publier
          </Button>
        </div>
      </form>
      <div data-testid="comments-list" className="space-y-3">
        {items.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-6">
            Aucun commentaire pour l'instant.
          </p>
        )}
        {items.map((c) => (
          <div
            key={c.id}
            data-testid={`comment-${c.id}`}
            className={`surface p-4 flex gap-3 ${c.kind === "error" && !c.resolved ? "border-rose-200 bg-rose-50/40" : ""}`}
          >
            <Initials name={c.user_name} />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-slate-900">
                  {c.user_name}
                </span>
                {c.kind === "error" && (
                  <span
                    className={`text-xs font-semibold px-1.5 py-0.5 rounded ${c.resolved ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}
                  >
                    {c.resolved ? "Erreur corrigée" : "Erreur signalée"}
                  </span>
                )}
                {c.page && (
                  <span className="text-xs text-slate-500 font-mono">
                    p. {c.page}
                  </span>
                )}
                <span className="text-xs text-slate-400">
                  V{c.version} · {timeAgo(c.created_at)}
                </span>
              </div>
              <p className="text-sm text-slate-700 mt-1 whitespace-pre-line">
                {c.text}
              </p>
            </div>
            {c.kind === "error" && (
              <Button
                variant="ghost"
                size="sm"
                data-testid={`comment-resolve-${c.id}`}
                onClick={() => toggle(c)}
                className="text-emerald-700 shrink-0"
              >
                <CheckCircle2 size={14} className="mr-1" />{" "}
                {c.resolved ? "Rouvrir" : "Corrigé"}
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
