import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Copy,
  Globe,
  Loader2,
  Lock,
  LogOut,
  MessageSquare,
  Send,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, formatError } from "@/lib/api";
import { Initials } from "@/components/common";
import { KanbanBoard } from "@/components/workspace/KanbanBoard";
import { NotesEditor } from "@/components/workspace/NotesEditor";
import { ResourcesPanel } from "@/components/workspace/ResourcesPanel";
import { ContributionPanel } from "@/components/workspace/ContributionPanel";
import { ActivityFeed } from "@/components/workspace/ActivityFeed";
import { BinomesPanel } from "@/components/workspace/BinomesPanel";

export default function WorkspacePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ws, setWs] = useState(null);
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);

  /* ── Chat state ── */
  const [chatMsgs, setChatMsgs] = useState([]);
  const [chatText, setChatText] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const chatBottomRef = useRef(null);

  const loadChat = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await api.get(`/chat/workspace/${id}`);
      setChatMsgs(data);
    } catch { /* silent */ }
  }, [id]);

  useEffect(() => {
    loadChat();
    const iv = setInterval(loadChat, 7000);
    return () => clearInterval(iv);
  }, [loadChat]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMsgs]);

  const sendChat = async (e) => {
    e.preventDefault();
    if (!chatText.trim()) return;
    setChatSending(true);
    try {
      await api.post(`/chat/workspace/${id}`, { text: chatText.trim() });
      setChatText("");
      loadChat();
    } catch (err) {
      toast.error(formatError(err));
    } finally {
      setChatSending(false);
    }
  };

  const loadWs = useCallback(() => {
    api
      .get(`/workspaces/${id}`)
      .then((r) => setWs(r.data))
      .catch((e) => {
        toast.error(formatError(e), { id: "ws-error" });
        navigate("/espaces");
      });
  }, [id, navigate]);

  useEffect(() => {
    loadWs();
  }, [loadWs]);

  const joinPublic = async () => {
    try {
      await api.post(`/workspaces/${id}/join-public`);
      toast.success("Tu as rejoint l'amphi virtuel !");
      loadWs();
    } catch (e) {
      toast.error(formatError(e));
    }
  };

  const quit = async () => {
    const owner = ws?.owner_id === user.id;
    if (
      !window.confirm(
        owner
          ? "Supprimer définitivement cet espace et tout son contenu ?"
          : "Quitter cet espace ?",
      )
    )
      return;
    try {
      await (owner
        ? api.delete(`/workspaces/${id}`)
        : api.post(`/workspaces/${id}/leave`));
      toast.success(owner ? "Espace supprimé" : "Tu as quitté l'espace");
      navigate("/espaces");
    } catch (e) {
      toast.error(formatError(e));
    }
  };

  if (!ws)
    return (
      <div className="py-24 grid place-items-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );

  const isPromo = ws.type === "promo";

  return (
    <div className="fade-up">
      <Link
        to="/espaces"
        data-testid="workspace-back-link"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary mb-5"
      >
        <ArrowLeft size={15} /> Espaces & Amphis
      </Link>
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            {isPromo ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-primary bg-blue-50 border border-blue-200 rounded-md px-2 py-0.5">
                <Globe size={12} /> Amphi public ENSAE
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-0.5">
                <Lock size={12} /> Projet TD privé
              </span>
            )}
            <span className="eyebrow">{ws.subject || "Projet de groupe"}</span>
          </div>
          <h1
            data-testid="workspace-title"
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 leading-[1.05]"
          >
            {ws.name}
          </h1>
          {ws.description && (
            <p className="text-slate-600 mt-2 max-w-2xl">{ws.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div data-testid="workspace-members" className="flex -space-x-2">
            {ws.members.map((m) => (
              <Initials key={m.id} name={m.name} className="h-9 w-9" />
            ))}
          </div>
          {isPromo && !ws.is_member && (
            <Button onClick={joinPublic} className="rounded-full">
              Rejoindre l'amphi
            </Button>
          )}
          {!isPromo && (
            <button
              data-testid="workspace-invite-code"
              onClick={() => {
                navigator.clipboard.writeText(ws.invite_code);
                toast.success("Code d'invitation copié");
              }}
              className="flex items-center gap-2 surface px-3 py-2 rounded-full text-sm hover:border-primary transition-colors"
            >
              <span className="text-slate-500">Code</span>
              <span className="font-mono font-bold text-primary">
                {ws.invite_code}
              </span>
              <Copy size={13} className="text-slate-400" />
            </button>
          )}
          {(!isPromo || (ws.is_member && ws.owner_id !== user.id)) && (
            <Button
              variant="ghost"
              size="icon"
              data-testid={
                ws.owner_id === user.id
                  ? "workspace-delete-button"
                  : "workspace-leave-button"
              }
              onClick={quit}
              title={
                ws.owner_id === user.id
                  ? "Supprimer l'espace"
                  : "Quitter l'espace"
              }
              className="text-slate-400 hover:text-rose-600 hover:bg-rose-50"
            >
              {ws.owner_id === user.id ? (
                <Trash2 size={16} />
              ) : (
                <LogOut size={16} />
              )}
            </Button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 min-w-0">
          <Tabs defaultValue={isPromo ? "binomes" : "kanban"}>
            <TabsList className="rounded-full mb-4 flex-wrap h-auto">
              {isPromo && (
                <TabsTrigger
                  value="binomes"
                  data-testid="workspace-tab-binomes"
                  className="rounded-full"
                >
                  Cherche un binôme
                </TabsTrigger>
              )}
              <TabsTrigger
                value="kanban"
                data-testid="workspace-tab-kanban"
                className="rounded-full"
              >
                Kanban
              </TabsTrigger>
              <TabsTrigger
                value="notes"
                data-testid="workspace-tab-notes"
                className="rounded-full"
              >
                Notes partagées
              </TabsTrigger>
              <TabsTrigger
                value="resources"
                data-testid="workspace-tab-resources"
                className="rounded-full"
              >
                Ressources
              </TabsTrigger>
              <TabsTrigger
                value="contrib"
                data-testid="workspace-tab-contributions"
                className="rounded-full"
              >
                Contributions
              </TabsTrigger>
              <TabsTrigger
                value="chat"
                data-testid="workspace-tab-chat"
                className="rounded-full"
              >
                <MessageSquare size={13} className="mr-1" /> Chat
              </TabsTrigger>
            </TabsList>
            {isPromo && (
              <TabsContent value="binomes">
                <BinomesPanel ws={ws} onChange={bump} />
              </TabsContent>
            )}
            <TabsContent value="kanban">
              <KanbanBoard ws={ws} onChange={bump} />
            </TabsContent>
            <TabsContent value="notes">
              <NotesEditor ws={ws} onChange={bump} />
            </TabsContent>
            <TabsContent value="resources">
              <ResourcesPanel ws={ws} onChange={bump} />
            </TabsContent>
            <TabsContent value="contrib">
              <ContributionPanel wsId={ws.id} tick={tick} />
            </TabsContent>
            <TabsContent value="chat">
              <div className="surface flex flex-col" style={{ height: "480px" }}>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                  {chatMsgs.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center mt-6">
                      Aucun message dans ce chat. Soyez le premier !
                    </p>
                  ) : (
                    chatMsgs.map((m) => {
                      const mine = m.author_id === user.id;
                      return (
                        <div key={m.id} className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                          {!mine && <Initials name={m.author_name} className="h-7 w-7 text-[10px] shrink-0" />}
                          <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${mine ? "bg-primary text-white rounded-br-sm" : "bg-slate-100 text-slate-900 rounded-bl-sm"}`}>
                            {!mine && <p className="text-[10px] font-semibold mb-0.5 text-primary">{m.author_name}</p>}
                            <p className="whitespace-pre-line">{m.text}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatBottomRef} />
                </div>
                <form onSubmit={sendChat} className="flex gap-2 p-3 border-t border-slate-200 shrink-0">
                  <Input
                    value={chatText}
                    onChange={(e) => setChatText(e.target.value)}
                    placeholder="Écrire dans le chat de l'espace…"
                    className="flex-1 rounded-full"
                    disabled={chatSending}
                  />
                  <Button type="submit" disabled={chatSending || !chatText.trim()} className="rounded-full px-4">
                    {chatSending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  </Button>
                </form>
              </div>
            </TabsContent>
          </Tabs>
        </div>
        <aside className="lg:col-span-4">
          <ActivityFeed wsId={ws.id} tick={tick} />
        </aside>
      </div>
    </div>
  );
}
