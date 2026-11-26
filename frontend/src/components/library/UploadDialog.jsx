import { useState } from "react";
import { Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, formatError } from "@/lib/api";
import { ACCEPT, ENSAE_CLASSES, SUBJECTS } from "@/components/common";

export const FilePicker = ({ file, onChange, testid }) => (
  <label
    data-testid={testid}
    className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 hover:border-primary rounded-xl p-6 cursor-pointer bg-slate-50 transition-colors"
  >
    <UploadCloud className="text-primary" />
    <span className="text-sm font-medium text-slate-700 text-center break-all">
      {file ? file.name : "Choisir un fichier (100 Mo max)"}
    </span>
    <span className="text-xs text-slate-500 text-center">
      PDF, Word, PPT, code (.R, .py, .do, .sas) ou données (.csv, .xlsx)
    </span>
    <input
      type="file"
      accept={ACCEPT}
      className="hidden"
      data-testid={`${testid}-input`}
      onChange={(e) => onChange(e.target.files?.[0] || null)}
    />
  </label>
);

const EMPTY = {
  title: "",
  description: "",
  subject: "",
  class_name: "",
  is_annale: false,
  annale_year: "2025",
  professor: "",
  tags: "",
};

export const UploadDialog = ({ open, onOpenChange, onUploaded }) => {
  const [file, setFile] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [progress, setProgress] = useState(null);
  const set = (k) => (e) =>
    setForm({ ...form, [k]: e?.target !== undefined ? e.target.value : e });

  const pick = (f) => {
    setFile(f);
    if (f && !form.title)
      setForm({
        ...form,
        title: f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "),
      });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return toast.error("Choisis un fichier");
    if (file.size > 100 * 1024 * 1024)
      return toast.error("Fichier trop volumineux (100 Mo max)");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("title", form.title);
    fd.append("description", form.description);
    fd.append("subject", form.subject || "Autre");
    if (form.class_name) {
      fd.append("class_name", form.class_name);
      fd.append("level", form.class_name);
    }
    fd.append("is_annale", String(form.is_annale));
    fd.append("annale_year", form.is_annale ? form.annale_year : "");
    fd.append("professor", form.professor);
    fd.append("tags", form.tags);
    setProgress(0);
    try {
      await api.post("/documents", fd, {
        onUploadProgress: (p) =>
          setProgress(Math.round((p.loaded / (p.total || 1)) * 100)),
      });
      toast.success("Ressource publiée ! L'IA indexe ses concepts…");
      setFile(null);
      setForm(EMPTY);
      onOpenChange(false);
      onUploaded();
    } catch (err) {
      toast.error(formatError(err));
    } finally {
      setProgress(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="library-upload-modal"
        className="max-w-lg max-h-[92vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            Déposer une fiche, un script ou une annale
          </DialogTitle>
          <DialogDescription>
            Partage ton cours ou code R/Python avec les promos ISE et AS.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <FilePicker file={file} onChange={pick} testid="upload-file-picker" />
          <div>
            <Label>Titre</Label>
            <Input
              data-testid="upload-title-input"
              required
              value={form.title}
              onChange={set("title")}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              data-testid="upload-description-input"
              value={form.description}
              onChange={set("description")}
              rows={2}
              className="mt-1.5"
              placeholder="Chapitres couverts, prof, TD, packages R/Python…"
            />
          </div>
          <div>
            <Label>Matière ENSAE</Label>
            <Select value={form.subject} onValueChange={set("subject")}>
              <SelectTrigger
                data-testid="upload-subject-select"
                className="mt-1.5"
              >
                <SelectValue placeholder="Choisir la matière" />
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
            <Label>Classe cible (partage inter-promos possible)</Label>
            <Select value={form.class_name} onValueChange={set("class_name")}>
              <SelectTrigger
                data-testid="upload-level-select"
                className="mt-1.5"
              >
                <SelectValue placeholder="Ma classe (par défaut)" />
              </SelectTrigger>
              <SelectContent>
                {ENSAE_CLASSES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-slate-500 mt-1">
              Tu peux choisir une autre classe pour lui transmettre une annale ou une fiche.
            </p>
          </div>
          <div className="space-y-2.5 rounded-xl border border-slate-200 p-3 bg-slate-50">
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700 cursor-pointer">
                <Checkbox
                  data-testid="upload-annale-checkbox"
                  checked={form.is_annale}
                  onCheckedChange={(v) =>
                    setForm({ ...form, is_annale: Boolean(v) })
                  }
                />
                <span>C'est une annale d'examen / partiel</span>
              </label>
              {form.is_annale && (
                <Input
                  data-testid="upload-annale-year-input"
                  value={form.annale_year}
                  onChange={set("annale_year")}
                  placeholder="2025"
                  className="w-24 h-8 bg-white"
                />
              )}
            </div>
            <div>
              <Label className="text-xs text-slate-600">Professeur (optionnel)</Label>
              <Input
                data-testid="upload-professor-input"
                value={form.professor}
                onChange={set("professor")}
                placeholder="Ex. M. Dupont, Mme Diop"
                className="mt-1 h-8 bg-white text-sm"
              />
            </div>
          </div>
          <div>
            <Label>Mots-clés (séparés par des virgules)</Label>
            <Input
              data-testid="upload-tags-input"
              value={form.tags}
              onChange={set("tags")}
              className="mt-1.5"
              placeholder="partiel, R, MCO, TD"
            />
          </div>
          {progress !== null && (
            <div className="space-y-1">
              <Progress value={progress} />
              <div className="text-xs text-slate-500">
                {progress < 100
                  ? `Envoi… ${progress}%`
                  : "Extraction du texte…"}
              </div>
            </div>
          )}
          <Button
            type="submit"
            data-testid="library-upload-submit-button"
            disabled={progress !== null}
            className="w-full rounded-full h-11"
          >
            {progress !== null && (
              <Loader2 size={16} className="animate-spin mr-2" />
            )}{" "}
            Publier la ressource
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
