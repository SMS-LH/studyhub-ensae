import { useState } from "react";
import {
  Loader2,
  BookOpen,
  Sparkles,
  Users,
  GraduationCap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { formatError } from "@/lib/api";
import { ENSAE_FILIERES, EnsaeLogo } from "@/components/common";

const HERO =
  "https://images.unsplash.com/photo-1642130935796-1409d7e075dd?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=1400";

const Pillar = ({ icon: Icon, title, text }) => (
  <div className="flex gap-3">
    <span className="h-9 w-9 rounded-lg bg-white/10 border border-white/20 grid place-items-center shrink-0">
      <Icon size={17} />
    </span>
    <div>
      <div className="font-semibold">{title}</div>
      <div className="text-sm text-blue-100/80">{text}</div>
    </div>
  </div>
);

export default function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    university: "ENSAE",
    filiere: "ISE",
    annee: "1",
    is_parallel_admission: false,
    is_tutor: false,
  });
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) =>
    setForm({ ...form, [k]: e?.target !== undefined ? e.target.value : e });

  const years = ENSAE_FILIERES[form.filiere] || [1, 2, 3];

  const submit = async (e, demoCreds) => {
    e?.preventDefault();
    setLoading(true);
    try {
      if (demoCreds) await login(demoCreds[0], demoCreds[1]);
      else if (mode === "login") await login(form.email, form.password);
      else
        await register({
          ...form,
          annee: form.annee ? Number(form.annee) : null,
        });
      toast.success("Bienvenue sur StudyHub ENSAE !");
    } catch (err) {
      toast.error(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden lg:flex flex-col justify-between p-12 text-white bg-primary overflow-hidden">
        <img
          src={HERO}
          alt="Bibliothèque universitaire"
          className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-luminosity"
        />
        <div className="relative flex items-center gap-3">
          <EnsaeLogo className="h-10 w-10" />
          <div>
            <span className="font-display font-extrabold text-2xl block leading-none">
              StudyHub ENSAE
            </span>
            <span className="text-[11px] uppercase tracking-[0.2em] text-amber-300 font-semibold">
              Filières ISE (1-5) & AS (1-3)
            </span>
          </div>
        </div>
        <div className="relative max-w-lg">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300 mb-4">
            100 % étudiant · 100 % gratuit
          </div>
          <h1 className="text-5xl xl:text-6xl font-extrabold leading-[1.02]">
            L'entraide ENSAE, de la 1re année à la 5e.
          </h1>
          <div className="mt-10 space-y-5">
            <Pillar
              icon={BookOpen}
              title="Bibliothèque & Annales ENSAE"
              text="Fiches, scripts R/Python/Stata/SAS et annales validés par les tuteurs."
            />
            <Pillar
              icon={GraduationCap}
              title="Tutorat inter-niveaux"
              text="Les ISE 4/5 et AS 3 accompagnent les promotions plus jeunes."
            />
            <Pillar
              icon={Sparkles}
              title="Assistant IA Stats & Éco"
              text="Résumés, QCM, debugger de code R/Python et rétroplanning partiels."
            />
            <Pillar
              icon={Users}
              title="Amphis virtuels & Projets TD"
              text="Espaces publics par promo (ISE 1-5, AS 1-3) + recherche de binômes."
            />
          </div>
        </div>
        <div className="relative text-xs text-blue-100/70">
          Fait pour les étudiants de l'ENSAE, par des étudiants.
        </div>
      </aside>

      <section className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md fade-up">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <EnsaeLogo className="h-9 w-9" />
            <div>
              <span className="font-display font-extrabold text-xl block leading-none">
                StudyHub ENSAE
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-700">
                ISE & AS
              </span>
            </div>
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900">
            {mode === "login" ? "Content de te revoir" : "Rejoins ta promo"}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {mode === "login"
              ? "Connecte-toi pour retrouver tes fiches, tuteurs et amphis."
              : "Crée ton profil étudiant ENSAE en 30 secondes."}
          </p>

          <div className="mt-6 grid grid-cols-2 p-1 bg-slate-100 rounded-full">
            {[
              ["login", "Connexion", "auth-login-tab"],
              ["register", "Inscription", "auth-register-tab"],
            ].map(([m, l, t]) => (
              <button
                key={m}
                data-testid={t}
                onClick={() => setMode(m)}
                className={`py-2 rounded-full text-sm font-semibold transition-colors duration-200 ${mode === m ? "bg-white shadow text-primary" : "text-slate-500"}`}
              >
                {l}
              </button>
            ))}
          </div>

          <form
            onSubmit={submit}
            className="mt-6 space-y-4"
            data-testid="auth-form"
          >
            {mode === "register" && (
              <>
                <div>
                  <Label htmlFor="name">Prénom et nom</Label>
                  <Input
                    id="name"
                    data-testid="auth-name-input"
                    required
                    value={form.name}
                    onChange={set("name")}
                    placeholder="Amadou Diop"
                    className="mt-1.5 h-11"
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
                        data-testid="auth-filiere-select"
                        className="mt-1.5 h-11"
                      >
                        <SelectValue />
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
                        data-testid="auth-annee-select"
                        className="mt-1.5 h-11"
                      >
                        <SelectValue />
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
                  <span>Admission parallèle (ex : ISE 3)</span>
                </label>
                <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
                  <Checkbox
                    checked={form.is_tutor}
                    onCheckedChange={(v) =>
                      setForm({ ...form, is_tutor: Boolean(v) })
                    }
                  />
                  <span>Je souhaite aussi aider comme tuteur / tutrice</span>
                </label>
                <div>
                  <Label htmlFor="class_code">
                    Code d'accès de ta classe (optionnel)
                  </Label>
                  <Input
                    id="class_code"
                    value={form.class_code || ""}
                    onChange={set("class_code")}
                    placeholder="Ex. ISE1ENSAE (donné par ton délégué)"
                    className="mt-1.5 h-11 font-mono uppercase"
                  />
                </div>
              </>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                data-testid="auth-email-input"
                required
                value={form.email}
                onChange={set("email")}
                placeholder="prenom.nom@ensae.fr"
                className="mt-1.5 h-11"
              />
            </div>
            <div>
              <Label htmlFor="pwd">Mot de passe</Label>
              <Input
                id="pwd"
                type="password"
                data-testid="auth-password-input"
                required
                minLength={6}
                value={form.password}
                onChange={set("password")}
                placeholder="6 caractères minimum"
                className="mt-1.5 h-11"
              />
            </div>
            <Button
              type="submit"
              data-testid="auth-submit-button"
              disabled={loading}
              className="w-full h-11 rounded-full font-semibold"
            >
              {loading && <Loader2 className="animate-spin mr-2" size={16} />}
              {mode === "login" ? "Se connecter" : "Créer mon compte ENSAE"}
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
