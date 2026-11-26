import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ENSAE_FILIERES, SUBJECTS } from "@/components/common";

export const ProfileEditDialog = ({ open, onOpenChange, profile, onSaved }) => {
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (open)
      setForm({
        ...profile,
        filiere: profile.filiere || "ISE",
        annee: profile.annee ? String(profile.annee) : "1",
        is_parallel_admission: Boolean(profile.is_parallel_admission),
        is_tutor: Boolean(profile.is_tutor),
        tutor_subjects: profile.tutor_subjects || [],
        tutor_slots: (profile.tutor_slots || []).join(", "),
        contact_info: profile.contact_info || "",
        tutor_available_this_week: profile.tutor_available_this_week ?? true,
        weaknesses: profile.weaknesses || [],
        interests: (profile.interests || []).join(", "),
        skills: profile.skills?.length
          ? profile.skills
          : [{ name: "", level: "" }],
      });
  }, [open, profile]);

  if (!form) return null;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target?.value ?? e });
  const setSkill = (i, k, v) =>
    setForm({
      ...form,
      skills: form.skills.map((s, j) => (j === i ? { ...s, [k]: v } : s)),
    });
  const toggleTutorSubject = (sub) => {
    const cur = form.tutor_subjects || [];
    setForm({
      ...form,
      tutor_subjects: cur.includes(sub)
        ? cur.filter((x) => x !== sub)
        : [...cur, sub],
    });
  };
  const toggleWeakness = (sub) => {
    const cur = form.weaknesses || [];
    setForm({
      ...form,
      weaknesses: cur.includes(sub)
        ? cur.filter((x) => x !== sub)
        : [...cur, sub],
    });
  };
  const years = ENSAE_FILIERES[form.filiere] || [1, 2, 3];

  const submit = async (e) => {
    e.preventDefault();
    const body = {
      name: form.name,
      university: form.university || "ENSAE",
      filiere: form.filiere,
      annee: form.annee ? Number(form.annee) : null,
      field: form.filiere,
      year: `${form.filiere} ${form.annee}`,
      is_parallel_admission: Boolean(form.is_parallel_admission),
      is_tutor: Boolean(form.is_tutor),
      tutor_subjects: form.is_tutor ? form.tutor_subjects : [],
      tutor_slots: form.is_tutor
        ? String(form.tutor_slots || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      contact_info: form.contact_info || "",
      tutor_available_this_week: Boolean(form.tutor_available_this_week),
      weaknesses: form.weaknesses || [],
      bio: form.bio,
      interests: form.interests
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      skills: form.skills.filter((s) => s.name.trim()),
    };
    try {
      const { data } = await api.put("/users/me", body);
      onSaved(data);
      onOpenChange(false);
      toast.success("Profil ENSAE mis à jour");
    } catch (err) {
      toast.error(formatError(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="profile-edit-modal"
        className="max-w-lg max-h-[92vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            Modifier mon profil ENSAE
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label>Prénom et nom</Label>
            <Input
              data-testid="profile-name-input"
              required
              value={form.name}
              onChange={set("name")}
              className="mt-1.5"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Filière ENSAE</Label>
              <Select
                value={form.filiere}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    filiere: v,
                    annee:
                      Number(form.annee) > ENSAE_FILIERES[v].slice(-1)[0]
                        ? "1"
                        : form.annee,
                  })
                }
              >
                <SelectTrigger
                  data-testid="profile-field-select"
                  className="mt-1.5"
                >
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ISE">ISE (Ingénieur)</SelectItem>
                  <SelectItem value="AS">AS (Analyste)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Année</Label>
              <Select value={form.annee} onValueChange={set("annee")}>
                <SelectTrigger
                  data-testid="profile-year-select"
                  className="mt-1.5"
                >
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {form.filiere} {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
            <Checkbox
              checked={form.is_parallel_admission}
              onCheckedChange={(v) =>
                setForm({ ...form, is_parallel_admission: Boolean(v) })
              }
            />
            <span>Admission parallèle (ex : entrée directe en ISE 3)</span>
          </label>

          <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-3.5 space-y-2">
            <div className="text-xs font-semibold text-rose-900">
              Matières à renforcer / lacunes (pour le matching de tuteur) :
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SUBJECTS.filter((s) => s !== "Autre").map((sub) => {
                const active = (form.weaknesses || []).includes(sub);
                return (
                  <button
                    type="button"
                    key={sub}
                    onClick={() => toggleWeakness(sub)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      active
                        ? "bg-rose-600 text-white border-rose-600"
                        : "bg-white text-slate-600 border-slate-200 hover:border-rose-300"
                    }`}
                  >
                    {sub}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 space-y-3">
            <label className="flex items-center gap-2.5 text-sm font-semibold text-slate-900 cursor-pointer">
              <Checkbox
                data-testid="profile-tutor-checkbox"
                checked={form.is_tutor}
                onCheckedChange={(v) =>
                  setForm({ ...form, is_tutor: Boolean(v) })
                }
              />
              <span>Je suis tuteur / tutrice bénévole ENSAE</span>
            </label>
            {form.is_tutor && (
              <div>
                <div className="text-xs text-slate-600 mb-2">
                  Matières que tu peux enseigner :
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SUBJECTS.filter((s) => s !== "Autre").map((sub) => {
                    const active = (form.tutor_subjects || []).includes(sub);
                    return (
                      <button
                        type="button"
                        key={sub}
                        data-testid={`tutor-subject-toggle-${sub}`}
                        onClick={() => toggleTutorSubject(sub)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                          active
                            ? "bg-primary text-white border-primary"
                            : "bg-white text-slate-600 border-slate-200 hover:border-primary/40"
                        }`}
                      >
                        {sub}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3">
                  <Label className="text-xs text-slate-600">
                    Créneaux de disponibilité (séparés par des virgules)
                  </Label>
                  <Input
                    value={form.tutor_slots || ""}
                    onChange={set("tutor_slots")}
                    placeholder="Samedi 14h (Visio), Mardi 18h (Salle B204)"
                    className="mt-1 bg-white text-xs"
                  />
                </div>
                <div className="mt-3">
                  <Label className="text-xs text-slate-600">
                    Contact préféré (WhatsApp, Telegram, Email ENSAE…)
                  </Label>
                  <Input
                    value={form.contact_info || ""}
                    onChange={set("contact_info")}
                    placeholder="Ex. WhatsApp +221 77… ou Telegram @pseudo"
                    className="mt-1 bg-white text-xs"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer mt-2.5">
                  <Checkbox
                    checked={Boolean(form.tutor_available_this_week)}
                    onCheckedChange={(v) =>
                      setForm({ ...form, tutor_available_this_week: Boolean(v) })
                    }
                  />
                  <span>Disponible cette semaine</span>
                </label>
              </div>
            )}
          </div>

          <div>
            <Label>Bio</Label>
            <Textarea
              data-testid="profile-bio-input"
              value={form.bio}
              onChange={set("bio")}
              rows={3}
              maxLength={600}
              className="mt-1.5"
              placeholder="Ta spécialité, tes projets, ce sur quoi tu peux aider…"
            />
          </div>
          <div>
            <Label>Centres d'intérêt (séparés par des virgules)</Label>
            <Input
              data-testid="profile-interests-input"
              value={form.interests}
              onChange={set("interests")}
              className="mt-1.5"
              placeholder="Économétrie, Data Science, Sondages"
            />
          </div>
          <div>
            <Label>Portfolio de compétences</Label>
            <div className="space-y-2 mt-1.5">
              {form.skills.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    data-testid={`profile-skill-name-${i}`}
                    value={s.name}
                    onChange={(e) => setSkill(i, "name", e.target.value)}
                    placeholder="Ex. R, Python, SAS"
                  />
                  <Input
                    data-testid={`profile-skill-level-${i}`}
                    value={s.level}
                    onChange={(e) => setSkill(i, "level", e.target.value)}
                    placeholder="Maîtrise, Avancé…"
                    className="w-36"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setForm({
                        ...form,
                        skills: form.skills.filter((_, j) => j !== i),
                      })
                    }
                    className="text-slate-400 hover:text-rose-600 shrink-0"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="profile-skill-add-button"
                onClick={() =>
                  setForm({
                    ...form,
                    skills: [...form.skills, { name: "", level: "" }],
                  })
                }
                className="rounded-full border-dashed w-full"
              >
                <Plus size={13} className="mr-1" /> Ajouter une compétence
              </Button>
            </div>
          </div>
          <Button
            type="submit"
            data-testid="profile-save-button"
            className="w-full rounded-full h-11"
          >
            Enregistrer
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
