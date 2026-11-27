import { useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  Loader2,
  MailCheck,
  Sparkles,
  Users,
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
import { api, formatError } from "@/lib/api";
import { ENSAE_CLASSES, EnsaeLogo } from "@/components/common";

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
  const initialResetToken =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("reset_token") || ""
      : "";
  const [mode, setMode] = useState(initialResetToken ? "reset" : "login");
  const [resetToken, setResetToken] = useState(initialResetToken);
  const [forgotSent, setForgotSent] = useState(false);
  const [pendingCreated, setPendingCreated] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    university: "ENSAE",
    class_name: "",
    is_parallel_admission: false,
    is_tutor: false,
  });
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) =>
    setForm({ ...form, [k]: e?.target !== undefined ? e.target.value : e });

  const submit = async (e, demoCreds) => {
    e?.preventDefault();
    setLoading(true);
    try {
      if (mode === "forgot") {
        await api.post("/auth/forgot-password", { email: form.email });
        setForgotSent(true);
        toast.success("Si un compte existe avec cet email, un lien a été envoyé.");
        return;
      }
      if (mode === "reset") {
        if (form.password !== confirmPassword) {
          toast.error("Les deux mots de passe ne correspondent pas.");
          return;
        }
        await api.post("/auth/reset-password", {
          token: resetToken,
          new_password: form.password,
        });
        toast.success("Mot de passe mis à jour ! Tu peux te connecter.");
        setResetToken("");
        setConfirmPassword("");
        setForm((f) => ({ ...f, password: "" }));
        window.history.replaceState({}, "", "/connexion");
        setMode("login");
        return;
      }
      if (demoCreds) await login(demoCreds[0], demoCreds[1]);
      else if (mode === "login") await login(form.email, form.password);
      else {
        if (!form.class_name) {
          toast.error("Sélectionne ta classe ENSAE avant de créer ton compte.");
          return;
        }
        const result = await register(form);
        // Pending accounts are not logged in; show persistent confirmation card
        if (result?.user?.verification_status === "pending") {
          setPendingCreated(true);
          toast.info("Compte créé — en attente de validation par un modérateur BDE.");
          return;
        }
        // Auto-login for verified accounts (ENSAE email or invite code)
        await login(form.email, form.password);
      }
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
              Filières ISEP, ISE & AS
            </span>
          </div>
        </div>
        <div className="relative max-w-lg">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300 mb-4">
            100 % étudiant · 100 % gratuit
          </div>
          <h1 className="text-5xl xl:text-6xl font-extrabold leading-[1.02]">
            L'entraide ENSAE, de l'ISEP à l'ISE3 & AS3.
          </h1>
          <div className="mt-10 space-y-5">
            <Pillar
              icon={BookOpen}
              title="Bibliothèque & Annales ENSAE"
              text="Fiches, scripts R/Python/Stata/SAS et annales partagées par promotion."
            />
            <Pillar
              icon={GraduationCap}
              title="Tutorat inter-niveaux"
              text="Les promotions avancées (ISE2/3, AS2/3) accompagnent les plus jeunes."
            />
            <Pillar
              icon={Sparkles}
              title="Assistant IA Stats & Éco"
              text="Résumés, QCM, flashcards, debugger R/Python et planning de révisions."
            />
            <Pillar
              icon={Users}
              title="Espaces de classe & Projets TD"
              text="Fils dédiés aux 10 classes ENSAE, groupes TD Kanban et binômes."
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
                ISEP, ISE & AS
              </span>
            </div>
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900">
            {mode === "login"
              ? "Content de te revoir"
              : mode === "register"
                ? "Rejoins ta promo"
                : mode === "forgot"
                  ? "Mot de passe oublié"
                  : "Nouveau mot de passe"}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {mode === "login"
              ? "Connecte-toi pour retrouver tes fiches, tuteurs et amphis."
              : mode === "register"
                ? "Crée ton profil étudiant ENSAE en 30 secondes."
                : mode === "forgot"
                  ? "Entre ton email pour recevoir un lien de réinitialisation."
                  : "Choisis un nouveau mot de passe (6 caractères minimum)."}
          </p>

          {(mode === "login" || mode === "register") && (
            <div className="mt-6 grid grid-cols-2 p-1 bg-slate-100 rounded-full">
              {[
                ["login", "Connexion", "auth-login-tab"],
                ["register", "Inscription", "auth-register-tab"],
              ].map(([m, l, t]) => (
                <button
                  key={m}
                  data-testid={t}
                  onClick={() => {
                    setPendingCreated(false);
                    setMode(m);
                  }}
                  className={`py-2 rounded-full text-sm font-semibold transition-colors duration-200 ${mode === m ? "bg-white shadow text-primary" : "text-slate-500"}`}
                >
                  {l}
                </button>
              ))}
            </div>
          )}

          {mode === "register" && pendingCreated ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/80 p-5 space-y-3">
              <div className="flex items-center gap-2 text-amber-900 font-semibold">
                <Clock size={18} />
                <span>Compte en attente de validation</span>
              </div>
              <p className="text-sm text-slate-700">
                Ton inscription pour <strong>{form.email}</strong> ({form.class_name}) a bien été enregistrée. Un modérateur BDE ou ton délégué de classe doit maintenant approuver ton compte avant que tu puisses te connecter.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPendingCreated(false);
                  setMode("login");
                }}
                className="w-full h-10 rounded-full"
              >
                <ArrowLeft size={15} className="mr-2" />
                Retour à la connexion
              </Button>
            </div>
          ) : mode === "forgot" && forgotSent ? (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 font-semibold">
                <MailCheck size={18} />
                <span>Vérifie ta boîte mail</span>
              </div>
              <p className="text-sm text-slate-600">
                Si un compte existe pour <strong>{form.email}</strong>, tu vas recevoir un lien valable 1 heure pour réinitialiser ton mot de passe. Pense à vérifier tes spams.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setForgotSent(false);
                  setMode("login");
                }}
                className="w-full h-10 rounded-full"
              >
                <ArrowLeft size={15} className="mr-2" />
                Retour à la connexion
              </Button>
            </div>
          ) : (
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
                  <div>
                    <Label>Classe ENSAE *</Label>
                    <Select value={form.class_name} onValueChange={set("class_name")}>
                      <SelectTrigger data-testid="auth-class-select" className="mt-1.5 h-11">
                        <SelectValue placeholder="Sélectionne ta classe" />
                      </SelectTrigger>
                      <SelectContent>
                        {ENSAE_CLASSES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
                    <Checkbox
                      checked={form.is_parallel_admission}
                      onCheckedChange={(v) =>
                        setForm({ ...form, is_parallel_admission: Boolean(v) })
                      }
                    />
                    <span>Admission parallèle</span>
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
                    <p className="text-[11px] text-slate-500 mt-1">
                      Accès immédiat avec un email @ensae.fr / @ensae.sn ou le code de ta classe ; sinon ton compte sera validé par un modérateur BDE.
                    </p>
                  </div>
                </>
              )}

              {(mode === "login" || mode === "register" || mode === "forgot") && (
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
              )}

              {(mode === "login" || mode === "register" || mode === "reset") && (
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="pwd">
                      {mode === "reset" ? "Nouveau mot de passe" : "Mot de passe"}
                    </Label>
                    {mode === "login" && (
                      <button
                        type="button"
                        onClick={() => {
                          setForgotSent(false);
                          setMode("forgot");
                        }}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Mot de passe oublié ?
                      </button>
                    )}
                  </div>
                  <div className="relative mt-1.5">
                    <Input
                      id="pwd"
                      type={showPassword ? "text" : "password"}
                      data-testid="auth-password-input"
                      required
                      minLength={6}
                      value={form.password}
                      onChange={set("password")}
                      placeholder="6 caractères minimum"
                      className="h-11 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              )}

              {mode === "reset" && (
                <div>
                  <Label htmlFor="confirm-pwd">Confirmer le mot de passe</Label>
                  <Input
                    id="confirm-pwd"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Répète le mot de passe"
                    className="mt-1.5 h-11"
                  />
                </div>
              )}

              <Button
                type="submit"
                data-testid="auth-submit-button"
                disabled={loading}
                className="w-full h-11 rounded-full font-semibold"
              >
                {loading && <Loader2 className="animate-spin mr-2" size={16} />}
                {mode === "login"
                  ? "Se connecter"
                  : mode === "register"
                    ? "Créer mon compte ENSAE"
                    : mode === "forgot"
                      ? "Envoyer le lien de réinitialisation"
                      : (
                        <>
                          <KeyRound size={15} className="mr-2" />
                          Enregistrer le nouveau mot de passe
                        </>
                      )}
              </Button>

              {(mode === "forgot" || mode === "reset") && (
                <button
                  type="button"
                  onClick={() => {
                    if (mode === "reset") {
                      window.history.replaceState({}, "", "/connexion");
                    }
                    setMode("login");
                  }}
                  className="w-full text-center text-xs text-slate-500 hover:text-primary pt-1"
                >
                  Retour à la connexion
                </button>
              )}
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
