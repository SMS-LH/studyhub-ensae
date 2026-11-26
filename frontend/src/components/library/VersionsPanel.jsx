import { useState } from "react";
import { Download, Eye, GitBranch, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, fileUrl, formatDate, formatError } from "@/lib/api";
import { FilePicker } from "@/components/library/UploadDialog";

export const VersionsPanel = ({ doc, onView }) => (
  <ol
    data-testid="doc-versions-list"
    className="relative border-l-2 border-slate-200 ml-3 space-y-5"
  >
    {[...doc.versions].reverse().map((v) => (
      <li
        key={v.version}
        data-testid={`doc-version-${v.version}`}
        className="ml-6"
      >
        <span
          className={`absolute -left-[13px] h-6 w-6 rounded-full grid place-items-center text-[10px] font-bold ${v.version === doc.current_version ? "bg-amber-500 text-white" : "bg-slate-200 text-slate-600"}`}
        >
          V{v.version}
        </span>
        <div className="surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-900">
              Version {v.version}
            </span>
            {v.version === doc.current_version && (
              <span className="text-xs bg-amber-100 text-amber-800 rounded px-1.5 py-0.5 font-semibold">
                Actuelle
              </span>
            )}
            <span className="text-xs text-slate-500">
              par {v.author_name} · {formatDate(v.created_at)}
            </span>
          </div>
          <p className="text-sm text-slate-700 mt-1.5">{v.changelog}</p>
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              variant="outline"
              data-testid={`doc-version-view-${v.version}`}
              onClick={() => onView(v.version)}
              className="rounded-full"
            >
              <Eye size={13} className="mr-1" /> Lire
            </Button>
            <Button size="sm" variant="ghost" asChild className="rounded-full">
              <a href={fileUrl(doc.id, v.version)} download={v.filename}>
                <Download size={13} className="mr-1" /> {v.filename}
              </a>
            </Button>
          </div>
        </div>
      </li>
    ))}
  </ol>
);

export const NewVersionDialog = ({ open, onOpenChange, doc, onDone }) => {
  const [file, setFile] = useState(null);
  const [changelog, setChangelog] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return toast.error("Choisis le fichier amélioré");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("changelog", changelog);
    setBusy(true);
    try {
      await api.post(`/documents/${doc.id}/versions`, fd);
      toast.success(
        `V${doc.current_version + 1} publiée : elle remplace la V${doc.current_version}`,
      );
      setFile(null);
      setChangelog("");
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="new-version-modal" className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl flex items-center gap-2">
            <GitBranch size={20} /> Proposer la V{doc.current_version + 1}
          </DialogTitle>
          <DialogDescription>
            Ta version améliorée remplacera la V{doc.current_version}.
            L'historique reste consultable.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <FilePicker
            file={file}
            onChange={setFile}
            testid="version-file-picker"
          />
          <div>
            <Label>Qu'as-tu amélioré ?</Label>
            <Textarea
              data-testid="version-changelog-input"
              required
              value={changelog}
              onChange={(e) => setChangelog(e.target.value)}
              rows={3}
              className="mt-1.5"
              placeholder="Correction de l'erreur p. 4, ajout d'exemples…"
            />
          </div>
          <Button
            type="submit"
            data-testid="version-submit-button"
            disabled={busy}
            className="w-full rounded-full h-11"
          >
            {busy && <Loader2 size={16} className="animate-spin mr-2" />}{" "}
            Publier la nouvelle version
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
