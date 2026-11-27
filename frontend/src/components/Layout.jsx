import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BookOpen,
  GraduationCap,
  Home,
  LogOut,
  MessageSquare,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
  Users,
  UserRound,
} from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/context/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EnsaeBadge, EnsaeLogo, Initials } from "@/components/common";

const NAV = [
  {
    to: "/fil",
    label: "Ma Classe",
    shortLabel: "Classe",
    icon: Home,
    testid: "nav-link-feed",
  },
  {
    to: "/bibliotheque",
    label: "Bibliothèque",
    shortLabel: "Fiches",
    icon: BookOpen,
    testid: "nav-link-library",
  },
  {
    to: "/espaces",
    label: "Groupes TD",
    shortLabel: "TD",
    icon: Users,
    testid: "nav-link-workspaces",
  },
  {
    to: "/assistant",
    label: "Assistant IA",
    shortLabel: "IA",
    icon: Sparkles,
    testid: "nav-link-ai-assistant",
  },
  {
    to: "/tutorat",
    label: "Tutorat École",
    shortLabel: "Tutorat",
    icon: GraduationCap,
    testid: "nav-link-tutoring",
  },
  {
    to: "/forum",
    label: "Forum",
    shortLabel: "Forum",
    icon: MessagesSquare,
    testid: "nav-link-forum",
  },
  {
    to: "/messages",
    label: "Messages",
    shortLabel: "Chat",
    icon: MessageSquare,
    testid: "nav-link-messages",
  },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/90 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3 sm:gap-6">
          <Link
            to="/fil"
            data-testid="studyhub-logo"
            className="flex items-center gap-2.5 shrink-0"
          >
            <EnsaeLogo className="h-9 w-9" />
            <div className="hidden sm:block leading-tight">
              <span className="font-display font-extrabold text-lg tracking-tight text-slate-900 block">
                StudyHub
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700 block -mt-0.5">
                ENSAE · ISE & AS
              </span>
            </div>
          </Link>
          <nav className="hidden md:flex gap-1 overflow-x-auto">
            {NAV.map(({ to, label, icon: Icon, testid }) => (
              <NavLink
                key={to}
                to={to}
                data-testid={testid}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors duration-200 ${
                    isActive
                      ? "bg-primary text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`
                }
              >
                <Icon size={16} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2.5 sm:gap-3">
            <div className="hidden lg:flex items-center">
              <EnsaeBadge
                filiere={user.filiere}
                annee={user.annee}
                isTutor={user.is_tutor}
              />
            </div>
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger
                data-testid="user-profile-menu-button"
                className="rounded-full focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <Initials
                  name={user.name}
                  userId={user.id}
                  avatarV={user.avatar_v}
                  className="h-9 w-9"
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel>
                  <div className="font-semibold" data-testid="user-menu-name">
                    {user.name}
                  </div>
                  <div className="text-xs text-muted-foreground font-normal">
                    {user.email}
                  </div>
                  {(user.filiere || user.is_tutor) && (
                    <div className="mt-1.5">
                      <EnsaeBadge
                        filiere={user.filiere}
                        annee={user.annee}
                        isTutor={user.is_tutor}
                      />
                    </div>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  data-testid="menu-profile-link"
                  onClick={() => navigate(`/profil/${user.id}`)}
                >
                  <UserRound size={14} className="mr-2" /> Mon profil & stats
                </DropdownMenuItem>
                {["moderator", "admin", "class_admin"].includes(user.role) && (
                  <DropdownMenuItem onClick={() => navigate("/moderation")}>
                    <ShieldCheck size={14} className="mr-2" />{" "}
                    {user.role === "class_admin" ? "Gestion de classe" : "Modération BDE"}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  data-testid="logout-button"
                  onClick={logout}
                  className="text-rose-600"
                >
                  <LogOut size={14} className="mr-2" /> Se déconnecter
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 pb-24 md:pb-10">
        <Outlet />
      </main>

      <nav
        data-testid="mobile-bottom-nav"
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 px-1 py-1.5 flex items-center justify-around shadow-[0_-4px_16px_rgba(15,23,42,0.06)]"
      >
        {NAV.map(({ to, shortLabel, icon: Icon, testid }) => (
          <NavLink
            key={to}
            to={to}
            data-testid={`mobile-${testid}`}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-xl text-[10px] font-semibold transition-colors ${
                isActive ? "text-primary bg-blue-50" : "text-slate-500"
              }`
            }
          >
            <Icon size={18} />
            <span>{shortLabel}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
