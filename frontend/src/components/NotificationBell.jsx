import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  CalendarClock,
  CheckCheck,
  GraduationCap,
  Award,
  UserPlus,
  AlarmClock,
  ShieldCheck,
  MessageSquareText,
} from "lucide-react";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, formatDate, timeAgo } from "@/lib/api";

const ICONS = {
  task_deadline: [AlarmClock, "text-amber-700 bg-amber-50"],
  exam_reminder: [GraduationCap, "text-rose-700 bg-rose-50"],
  tutoring_request: [GraduationCap, "text-primary bg-blue-50"],
  tutoring_accepted: [GraduationCap, "text-emerald-700 bg-emerald-50"],
  tutoring_reminder: [AlarmClock, "text-amber-700 bg-amber-50"],
  doc_validated: [ShieldCheck, "text-emerald-700 bg-emerald-50"],
  forum_reply: [MessageSquareText, "text-primary bg-blue-50"],
  badge: [Award, "text-primary bg-blue-50"],
  assignment: [UserPlus, "text-emerald-700 bg-emerald-50"],
};

const dueLabel = (d) =>
  d < 0
    ? `En retard (${-d} j)`
    : d === 0
      ? "Aujourd'hui"
      : d === 1
        ? "Demain"
        : `Dans ${d} jours`;

export const NotificationBell = () => {
  const navigate = useNavigate();
  const [data, setData] = useState({ items: [], unread: 0 });
  const [deadlines, setDeadlines] = useState([]);
  const [open, setOpen] = useState(false);
  const seen = useRef(null);

  const load = useCallback(async () => {
    const { data: d } = await api
      .get("/notifications")
      .catch(() => ({ data: null }));
    if (!d) return;
    if (seen.current)
      d.items
        .filter((n) => !n.read && !seen.current.has(n.id))
        .slice(0, 3)
        .forEach((n) => toast(n.title, { description: n.message }));
    seen.current = new Set(d.items.map((n) => n.id));
    setData(d);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (open) api.get("/deadlines").then((r) => setDeadlines(r.data));
  }, [open]);

  const go = async (n) => {
    if (!n.read) await api.post(`/notifications/${n.id}/read`);
    setOpen(false);
    load();
    if (n.link) navigate(n.link);
  };
  const readAll = async () => {
    await api.post("/notifications/read-all");
    load();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        data-testid="notification-bell-button"
        className="relative h-9 w-9 grid place-items-center rounded-full hover:bg-slate-100 text-slate-600 transition-colors"
      >
        <Bell size={18} />
        {data.unread > 0 && (
          <span
            data-testid="notification-unread-count"
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold grid place-items-center"
          >
            {data.unread > 9 ? "9+" : data.unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[360px] p-0"
        data-testid="notification-panel"
      >
        <Tabs defaultValue="notifs">
          <div className="flex items-center justify-between px-3 pt-3">
            <TabsList className="rounded-full h-8">
              <TabsTrigger
                value="notifs"
                data-testid="notif-tab-notifications"
                className="rounded-full text-xs"
              >
                Notifications
              </TabsTrigger>
              <TabsTrigger
                value="deadlines"
                data-testid="notif-tab-deadlines"
                className="rounded-full text-xs"
              >
                Échéances
              </TabsTrigger>
            </TabsList>
            {data.unread > 0 && (
              <button
                data-testid="notif-read-all-button"
                onClick={readAll}
                className="text-xs text-primary flex items-center gap-1 hover:underline"
              >
                <CheckCheck size={13} /> Tout lire
              </button>
            )}
          </div>
          <TabsContent
            value="notifs"
            className="max-h-[420px] overflow-y-auto p-2 mt-1"
          >
            {data.items.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-8">
                Aucune notification.
              </p>
            )}
            {data.items.map((n) => {
              const [Icon, cls] = ICONS[n.type] || [
                Bell,
                "text-slate-600 bg-slate-100",
              ];
              return (
                <button
                  key={n.id}
                  data-testid={`notification-${n.id}`}
                  onClick={() => go(n)}
                  className={`w-full text-left flex gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors ${n.read ? "opacity-60" : ""}`}
                >
                  <span
                    className={`h-8 w-8 rounded-lg grid place-items-center shrink-0 ${cls}`}
                  >
                    <Icon size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                      {n.title}
                      {!n.read && (
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                      )}
                    </span>
                    <span className="block text-xs text-slate-600 leading-snug mt-0.5">
                      {n.message}
                    </span>
                    <span className="block text-[11px] text-slate-400 mt-1">
                      {timeAgo(n.created_at)}
                    </span>
                  </span>
                </button>
              );
            })}
          </TabsContent>
          <TabsContent
            value="deadlines"
            className="max-h-[420px] overflow-y-auto p-2 mt-1"
            data-testid="deadlines-list"
          >
            {deadlines.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-8">
                Aucune échéance à venir.
              </p>
            )}
            {deadlines.map((d) => (
              <button
                key={d.id}
                data-testid={`deadline-${d.id}`}
                onClick={() => {
                  setOpen(false);
                  navigate(d.link);
                }}
                className="w-full text-left flex gap-3 p-2.5 rounded-xl hover:bg-slate-50"
              >
                <span
                  className={`h-8 w-8 rounded-lg grid place-items-center shrink-0 ${d.kind === "exam" ? "text-rose-700 bg-rose-50" : d.kind === "tutoring" ? "text-primary bg-blue-50" : "text-amber-700 bg-amber-50"}`}
                >
                  {d.kind === "exam" || d.kind === "tutoring" ? (
                    <GraduationCap size={15} />
                  ) : (
                    <CalendarClock size={15} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900 truncate">
                    {d.title}
                  </span>
                  <span className="block text-xs text-slate-500 truncate">
                    {d.context} ·{" "}
                    {formatDate(d.date, { day: "numeric", month: "short" })}
                  </span>
                </span>
                <span
                  className={`text-[11px] font-semibold rounded px-1.5 py-0.5 h-fit ${d.days <= 1 ? "bg-rose-100 text-rose-700" : d.days <= 3 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}
                >
                  {dueLabel(d.days)}
                </span>
              </button>
            ))}
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
};
