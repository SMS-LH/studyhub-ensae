import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Loader2,
  MessageSquare,
  Send,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, formatError, timeAgo } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { EmptyState, Initials, PageHeader } from "@/components/common";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/* ─── DM Thread ──────────────────────────────────────────── */
function DMThread({ otherId, otherName, onBack }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const load = useCallback(async () => {
    if (!otherId) return;
    try {
      const { data } = await api.get(`/chat/dm/${otherId}`);
      setMessages(data.messages || []);
    } catch (e) {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [otherId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 7000);
    return () => clearInterval(iv);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      await api.post(`/chat/dm/${otherId}`, { text: text.trim() });
      setText("");
      load();
    } catch (err) {
      toast.error(formatError(err));
    } finally {
      setSending(false);
    }
  };

  if (loading)
    return (
      <div className="flex-1 grid place-items-center">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white shrink-0">
        {onBack && (
          <button
            onClick={onBack}
            className="text-slate-500 hover:text-primary md:hidden"
          >
            ←
          </button>
        )}
        <Initials name={otherName} className="h-8 w-8 text-sm" />
        <span className="font-semibold text-slate-900">{otherName}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.length === 0 ? (
          <div className="text-center text-sm text-slate-400 mt-8">
            Commence la conversation avec {otherName} 👋
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === user.id;
            return (
              <div
                key={m.id}
                className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}
              >
                {!mine && (
                  <Initials
                    name={m.sender_name}
                    className="h-7 w-7 text-[10px] shrink-0"
                  />
                )}
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                    mine
                      ? "bg-primary text-white rounded-br-sm"
                      : "bg-slate-100 text-slate-900 rounded-bl-sm"
                  }`}
                >
                  <p className="whitespace-pre-line">{m.text}</p>
                  <p
                    className={`text-[10px] mt-1 ${mine ? "text-blue-100" : "text-slate-400"}`}
                  >
                    {timeAgo(m.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Send */}
      <form
        onSubmit={send}
        className="flex gap-2 p-3 border-t border-slate-200 bg-white shrink-0"
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Écrire un message…"
          className="flex-1 rounded-full"
          disabled={sending}
        />
        <Button
          type="submit"
          disabled={sending || !text.trim()}
          className="rounded-full px-4"
        >
          {sending ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Send size={15} />
          )}
        </Button>
      </form>
    </div>
  );
}

/* ─── Workspace Chat ─────────────────────────────────────── */
function WorkspaceChat({ wsId, wsName }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const load = useCallback(async () => {
    if (!wsId) return;
    try {
      const { data } = await api.get(`/chat/workspace/${wsId}`);
      setMessages(data);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [wsId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 7000);
    return () => clearInterval(iv);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      await api.post(`/chat/workspace/${wsId}`, { text: text.trim() });
      setText("");
      load();
    } catch (err) {
      toast.error(formatError(err));
    } finally {
      setSending(false);
    }
  };

  if (loading)
    return (
      <div className="flex-1 grid place-items-center">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 bg-white shrink-0">
        <Users size={16} className="text-primary" />
        <span className="font-semibold text-slate-900">{wsName}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.length === 0 ? (
          <div className="text-center text-sm text-slate-400 mt-8">
            Aucun message dans cet espace pour l'instant.
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.author_id === user.id;
            return (
              <div
                key={m.id}
                className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}
              >
                {!mine && (
                  <Initials name={m.author_name} className="h-7 w-7 text-[10px] shrink-0" />
                )}
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                    mine
                      ? "bg-primary text-white rounded-br-sm"
                      : "bg-slate-100 text-slate-900 rounded-bl-sm"
                  }`}
                >
                  {!mine && (
                    <p className="text-[10px] font-semibold mb-1 text-primary">{m.author_name}</p>
                  )}
                  <p className="whitespace-pre-line">{m.text}</p>
                  <p className={`text-[10px] mt-1 ${mine ? "text-blue-100" : "text-slate-400"}`}>
                    {timeAgo(m.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} className="flex gap-2 p-3 border-t border-slate-200 bg-white shrink-0">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Écrire dans le chat de l'espace…"
          className="flex-1 rounded-full"
          disabled={sending}
        />
        <Button type="submit" disabled={sending || !text.trim()} className="rounded-full px-4">
          {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        </Button>
      </form>
    </div>
  );
}

/* ─── Main MessagesPage ──────────────────────────────────── */
export default function MessagesPage() {
  const [searchParams] = useSearchParams();
  const initUser = searchParams.get("user");

  const [convs, setConvs] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [selected, setSelected] = useState(
    initUser ? { type: "dm", id: initUser, name: "…" } : null,
  );
  const [showSidebar, setShowSidebar] = useState(!initUser);

  /* Load DM conversations list */
  const loadConvs = useCallback(async () => {
    try {
      const [{ data: dm }, { data: ws }] = await Promise.all([
        api.get("/chat/conversations"),
        api.get("/workspaces").catch(() => ({ data: [] })),
      ]);
      setConvs(dm);
      setWorkspaces(ws.filter((w) => w.is_member));
    } catch (e) {
      toast.error(formatError(e));
    } finally {
      setLoadingConvs(false);
    }
  }, []);

  useEffect(() => {
    loadConvs();
    const iv = setInterval(loadConvs, 10000);
    return () => clearInterval(iv);
  }, [loadConvs]);

  /* If ?user= param, resolve name from conversations or fetch profile */
  useEffect(() => {
    if (!initUser) return;
    const existing = convs.find((c) => c.other_id === initUser);
    if (existing) {
      setSelected({ type: "dm", id: initUser, name: existing.user?.name || "Étudiant" });
    } else if (selected?.id === initUser && selected?.name === "…") {
      api
        .get(`/users/${initUser}`)
        .then(({ data }) => setSelected({ type: "dm", id: initUser, name: data.name }))
        .catch(() => {});
    }
  }, [initUser, convs, selected]);

  const openDM = (otherId, otherName) => {
    setSelected({ type: "dm", id: otherId, name: otherName });
    setShowSidebar(false);
  };

  const openWS = (wsId, wsName) => {
    setSelected({ type: "ws", id: wsId, name: wsName });
    setShowSidebar(false);
  };

  return (
    <div>
      <PageHeader eyebrow="Messages ENSAE" title="Messagerie privée & chats d'espaces." />

      <div
        className="surface overflow-hidden"
        style={{ height: "calc(100vh - 220px)", display: "flex" }}
      >
        {/* Sidebar */}
        <div
          className={`w-full md:w-72 lg:w-80 border-r border-slate-200 flex flex-col shrink-0 bg-white ${
            !showSidebar ? "hidden md:flex" : "flex"
          }`}
        >
          <Tabs defaultValue="dm" className="flex flex-col h-full">
            <TabsList className="rounded-none border-b border-slate-200 h-11 bg-white justify-start px-3 gap-1">
              <TabsTrigger value="dm" className="rounded-full text-xs">
                <MessageSquare size={13} className="mr-1" /> Messages
              </TabsTrigger>
              <TabsTrigger value="ws" className="rounded-full text-xs">
                <Users size={13} className="mr-1" /> Espaces
              </TabsTrigger>
            </TabsList>

            {/* DM list */}
            <TabsContent value="dm" className="flex-1 overflow-y-auto m-0">
              {loadingConvs ? (
                <div className="p-6 grid place-items-center">
                  <Loader2 className="animate-spin text-primary" />
                </div>
              ) : convs.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title="Aucune conversation"
                  text="Va sur le profil d'un étudiant et clique « Envoyer un message »."
                />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {convs.map((c) => (
                    <li key={c.other_id}>
                      <button
                        onClick={() => openDM(c.other_id, c.user?.name || "Étudiant")}
                        className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left transition-colors ${
                          selected?.type === "dm" && selected?.id === c.other_id
                            ? "bg-blue-50"
                            : ""
                        }`}
                      >
                        <div className="relative shrink-0">
                          <Initials name={c.user?.name || "?"} className="h-9 w-9 text-sm" />
                          {c.unread > 0 && (
                            <span className="absolute -top-1 -right-1 h-4 w-4 bg-primary text-white text-[9px] font-bold rounded-full grid place-items-center">
                              {c.unread}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-slate-900 truncate">
                            {c.user?.name || "Étudiant"}
                          </div>
                          {c.last_message && (
                            <div className="text-xs text-slate-500 truncate">
                              {c.last_message}
                            </div>
                          )}
                        </div>
                        {c.last_at && (
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {timeAgo(c.last_at)}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            {/* Workspaces list */}
            <TabsContent value="ws" className="flex-1 overflow-y-auto m-0">
              {workspaces.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="Aucun espace rejoint"
                  text="Rejoins un Amphi ou un Espace TD pour accéder à son chat."
                />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {workspaces.map((w) => (
                    <li key={w.id}>
                      <button
                        onClick={() => openWS(w.id, w.name)}
                        className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left transition-colors ${
                          selected?.type === "ws" && selected?.id === w.id ? "bg-blue-50" : ""
                        }`}
                      >
                        <div className="h-9 w-9 rounded-full bg-blue-100 text-primary grid place-items-center shrink-0">
                          <Users size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-slate-900 truncate">
                            {w.name}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {w.type === "promo" ? "Amphi public" : "Espace TD privé"}
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Chat panel */}
        <div className={`flex-1 flex flex-col min-w-0 ${showSidebar ? "hidden md:flex" : "flex"}`}>
          {!selected ? (
            <div className="flex-1 grid place-items-center text-slate-400">
              <div className="text-center space-y-2">
                <MessageSquare size={40} className="mx-auto opacity-30" />
                <p className="text-sm">Sélectionne une conversation</p>
              </div>
            </div>
          ) : selected.type === "dm" ? (
            <DMThread
              key={selected.id}
              otherId={selected.id}
              otherName={selected.name}
              onBack={() => setShowSidebar(true)}
            />
          ) : (
            <WorkspaceChat
              key={selected.id}
              wsId={selected.id}
              wsName={selected.name}
            />
          )}
        </div>
      </div>
    </div>
  );
}
