import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Award,
  BookOpen,
  Building2,
  Camera,
  MessageSquare,
  Pencil,
  Loader2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { api, formatError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { EnsaeBadge, FormatBadge, Initials } from "@/components/common";
import { BadgeGrid } from "@/components/profile/BadgeGrid";
import { StatsGrid } from "@/components/profile/StatsGrid";
import { SkillsCard } from "@/components/profile/SkillsCard";
import { ExamsCard } from "@/components/profile/ExamsCard";
import { ProfileEditDialog } from "@/components/profile/ProfileEditDialog";

const AvatarUpload = ({ profile, isMe, onUploaded }) => {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const upload = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    setBusy(true);
    try {
      const { data } = await api.post("/users/me/avatar", fd);
      onUploaded(data);
      toast.success("Photo mise à jour");
    } catch (e) {
      toast.error(formatError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="relative shrink-0 w-fit">
      <Initials
        testid="profile-avatar"
        name={profile.name}
        userId={profile.id}
        avatarV={profile.avatar_v}
        className="h-28 w-28 text-2xl ring-4 shadow-[5px_5px_0_#d97706]"
      />
      {isMe && (
        <>
          <button
            data-testid="profile-avatar-upload-button"
            onClick={() => input.current.click()}
            className="absolute bottom-0 right-0 h-9 w-9 rounded-full bg-primary text-white grid place-items-center ring-4 ring-white hover:bg-blue-800 transition-colors"
          >
            {busy ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Camera size={15} />
            )}
          </button>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            data-testid="profile-avatar-input"
            onChange={(e) => upload(e.target.files?.[0])}
          />
        </>
      )}
    </div>
  );
};

export default function ProfilePage() {
  const { id } = useParams();
  const { user, setUser } = useAuth();
  const [data, setData] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const isMe = id === user.id;

  const load = useCallback(
    () =>
      api
        .get(`/users/${id}/profile`)
        .then((r) => setData(r.data))
        .catch((e) => toast.error(formatError(e))),
    [id],
  );
  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  if (!data)
    return (
      <div className="py-24 grid place-items-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  const p = data.user;
  const updated = (u) => {
    setData((d) => ({ ...d, user: { ...d.user, ...u } }));
    if (isMe) setUser((cur) => ({ ...cur, ...u }));
  };

  return (
    <div className="fade-up">
      <div className="surface p-6 sm:p-8 flex flex-col sm:flex-row gap-6 sm:items-center">
        <AvatarUpload profile={p} isMe={isMe} onUploaded={updated} />
        <div className="flex-1 min-w-0">
          <div className="eyebrow mb-1">
            {isMe ? "Mon profil ENSAE" : "Profil étudiant ENSAE"}
          </div>
          <h1
            data-testid="profile-name"
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 leading-tight"
          >
            {p.name}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-sm text-slate-600">
            <EnsaeBadge
              filiere={p.filiere}
              annee={p.annee}
              isTutor={p.is_tutor}
              isParallel={p.is_parallel_admission}
              verificationStatus={p.verification_status}
            />
            {p.university && (
              <span className="flex items-center gap-1">
                <Building2 size={14} className="text-amber-700" />{" "}
                {p.university}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Award size={14} className="text-amber-700" />{" "}
              {data.badges.filter((b) => b.unlocked).length} badge(s)
            </span>
          </div>
          {p.is_tutor && p.tutor_subjects?.length > 0 && (
            <div
              data-testid="profile-tutor-subjects"
              className="flex flex-wrap items-center gap-1.5 mt-3"
            >
              <span className="text-xs font-semibold text-slate-500">
                Tutorat :
              </span>
              {p.tutor_subjects.map((sub) => (
                <span
                  key={sub}
                  className="text-xs bg-blue-50 border border-blue-200 text-primary rounded-full px-2.5 py-0.5 font-medium"
                >
                  {sub}
                </span>
              ))}
            </div>
          )}
          {p.bio && (
            <p
              data-testid="profile-bio"
              className="text-slate-700 mt-3 max-w-2xl"
            >
              {p.bio}
            </p>
          )}
          {p.interests?.length > 0 && (
            <div
              data-testid="profile-interests"
              className="flex flex-wrap gap-1.5 mt-3"
            >
              {p.interests.map((i) => (
                <span
                  key={i}
                  className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-full px-2.5 py-0.5"
                >
                  {i}
                </span>
              ))}
            </div>
          )}
        </div>
        {isMe ? (
          <Button
            data-testid="profile-edit-button"
            onClick={() => setEditOpen(true)}
            variant="outline"
            className="rounded-full self-start"
          >
            <Pencil size={14} className="mr-2" /> Modifier
          </Button>
        ) : (
          <Link to={`/messages?user=${p.id}`} className="self-start">
            <Button variant="outline" className="rounded-full">
              <MessageSquare size={14} className="mr-2" /> Envoyer un message
            </Button>
          </Link>
        )}
      </div>

      <div className="grid lg:grid-cols-12 gap-6 mt-6">
        <div className="lg:col-span-8 space-y-6 min-w-0">
          <BadgeGrid badges={data.badges} />
          <StatsGrid stats={data.stats} />
          <div className="surface p-5">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen size={16} className="text-amber-600" />
              <h3 className="text-lg font-bold">
                Fiches partagées ({data.documents.length})
              </h3>
            </div>
            {data.documents.length === 0 ? (
              <p className="text-sm text-slate-500">
                Aucune fiche partagée pour l'instant.
              </p>
            ) : (
              <ul
                data-testid="profile-documents"
                className="divide-y divide-slate-100"
              >
                {data.documents.map((d) => (
                  <li key={d.id}>
                    <Link
                      to={`/fiche/${d.id}`}
                      className="flex items-center gap-3 py-2.5 hover:text-primary"
                    >
                      <FormatBadge format={d.format} />
                      <span className="font-medium text-sm flex-1 truncate">
                        {d.title}
                      </span>
                      <span className="text-xs text-slate-500">
                        {d.subject}
                      </span>
                      <span className="text-xs font-semibold text-emerald-600">
                        +{d.score}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <aside className="lg:col-span-4 space-y-6">
          <SkillsCard
            skills={p.skills}
            weaknesses={p.weaknesses}
            isMe={isMe}
            onEdit={() => setEditOpen(true)}
          />
          {isMe && <ExamsCard />}
        </aside>
      </div>
      {isMe && (
        <ProfileEditDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          profile={p}
          onSaved={(u) => {
            updated(u);
            load();
          }}
        />
      )}
    </div>
  );
}
