import { useEffect, useLayoutEffect, useRef, useState } from "react";
import DiffMatchPatch from "diff-match-patch";
import { Check, Loader2, Wifi, WifiOff } from "lucide-react";
import { wsUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Initials } from "@/components/common";

const dmp = new DiffMatchPatch();
const count = (t) => (t.match(/[\p{L}\p{N}_]+/gu) || []).length;

const rebase = (base, local, next) =>
  local === base ? next : dmp.patch_apply(dmp.patch_make(base, local), next)[0];

export const NotesEditor = ({ ws, onChange }) => {
  const { user } = useAuth();
  const [content, setContent] = useState(ws.notes || "");
  const [connected, setConnected] = useState(false);
  const [peers, setPeers] = useState([]);
  const [typing, setTyping] = useState({});
  const [savedAt, setSavedAt] = useState(null);
  const ta = useRef(null);
  const sel = useRef(null);
  const st = useRef({
    socket: null,
    server: ws.notes || "",
    local: ws.notes || "",
    version: 0,
    inflight: null,
    pending: null,
    timer: null,
    lastChange: 0,
  });
  const changeRef = useRef(onChange);
  changeRef.current = onChange;

  useEffect(() => {
    const s = st.current;
    let closed = false;
    let retry;

    const setLocal = (text) => {
      const el = ta.current;
      if (el && document.activeElement === el && text !== s.local) {
        const diffs = dmp.diff_main(s.local, text);
        sel.current = [
          dmp.diff_xIndex(diffs, el.selectionStart),
          dmp.diff_xIndex(diffs, el.selectionEnd),
        ];
        s.local = text;
        el.value = text;
        el.setSelectionRange(...sel.current);
        setContent(text);
      } else {
        s.local = text;
        setContent(text);
      }
    };
    const flush = () => {
      if (
        !s.socket ||
        s.socket.readyState !== 1 ||
        s.inflight !== null ||
        s.local === s.server
      )
        return;
      s.inflight = s.local;
      s.socket.send(
        JSON.stringify({
          type: "update",
          base_version: s.version,
          content: s.local,
        }),
      );
    };
    const applySync = (m) => {
      if (m.version <= s.version) return;
      setLocal(rebase(s.server, s.local, m.content));
      s.server = m.content;
      s.version = m.version;
      setTyping((t) => ({ ...t, [m.user_id]: Date.now() }));
      flush();
    };
    s.flush = flush;

    const connect = () => {
      const sock = new WebSocket(wsUrl(`/ws/notes/${ws.id}`));
      s.socket = sock;
      sock.onopen = () => setConnected(true);
      sock.onmessage = (ev) => {
        const m = JSON.parse(ev.data);
        if (m.type === "init") {
          setLocal(rebase(s.server, s.local, m.content));
          Object.assign(s, {
            server: m.content,
            version: m.version,
            inflight: null,
            pending: null,
          });
          flush();
        } else if (m.type === "presence") setPeers(m.users);
        else if (m.type === "ack") {
          const sent = s.inflight;
          Object.assign(s, { inflight: null, version: m.version });
          setLocal(rebase(sent, s.local, m.content));
          s.server = m.content;
          setSavedAt(new Date());
          if (Date.now() - s.lastChange > 4000) {
            s.lastChange = Date.now();
            changeRef.current();
          }
          if (s.pending) {
            const p = s.pending;
            s.pending = null;
            applySync(p);
          }
          flush();
        } else if (m.type === "sync") {
          if (s.inflight !== null) {
            if (!s.pending || m.version > s.pending.version) s.pending = m;
          } else applySync(m);
        }
      };
      sock.onclose = (ev) => {
        setConnected(false);
        s.inflight = null;
        if (!closed && ev.code !== 4403 && ev.code !== 4401)
          retry = setTimeout(connect, 2000);
      };
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      clearTimeout(s.timer);
      s.socket?.close();
    };
  }, [ws.id]);

  useLayoutEffect(() => {
    if (sel.current && ta.current) {
      ta.current.setSelectionRange(...sel.current);
      sel.current = null;
    }
  }, [content]);

  useEffect(() => {
    const t = setInterval(
      () =>
        setTyping((ty) =>
          Object.fromEntries(
            Object.entries(ty).filter(([, at]) => Date.now() - at < 2500),
          ),
        ),
      1000,
    );
    return () => clearInterval(t);
  }, []);

  const onInput = (e) => {
    const s = st.current;
    sel.current = null;
    s.local = e.target.value;
    setContent(e.target.value);
    if (!s.timer)
      s.timer = setTimeout(() => {
        s.timer = null;
        s.flush?.();
      }, 200);
  };

  const others = peers.filter((p) => p.id !== user.id);
  const typers = others
    .filter((p) => typing[p.id])
    .map((p) => p.name.split(" ")[0]);

  return (
    <div className="surface overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
        <span
          data-testid="notes-connection-status"
          className={`flex items-center gap-1 font-semibold ${connected ? "text-emerald-700" : "text-rose-600"}`}
        >
          {connected ? (
            <>
              <Wifi size={13} /> En direct
            </>
          ) : (
            <>
              <WifiOff size={13} /> Reconnexion…
            </>
          )}
        </span>
        <div
          data-testid="notes-presence"
          className="flex items-center -space-x-1.5"
        >
          {peers.map((p) => (
            <span key={p.id} className="relative">
              <Initials
                name={p.name}
                userId={p.id}
                avatarV={p.avatar_v}
                className="h-6 w-6 text-[9px]"
              />
              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-slate-50" />
            </span>
          ))}
        </div>
        {typers.length > 0 && (
          <span
            data-testid="notes-typing-indicator"
            className="italic text-amber-700"
          >
            {typers.join(", ")} écrit…
          </span>
        )}
        <span data-testid="notes-word-count" className="font-mono ml-auto">
          {count(content)} mots
        </span>
        <span
          data-testid="notes-save-status"
          className="flex items-center gap-1"
        >
          {st.current.inflight !== null ? (
            <>
              <Loader2 size={12} className="animate-spin" /> Synchronisation…
            </>
          ) : savedAt ? (
            <>
              <Check size={12} className="text-emerald-600" /> Synchronisé
            </>
          ) : (
            "Sauvegarde automatique"
          )}
        </span>
      </div>
      <textarea
        ref={ta}
        data-testid="workspace-shared-notes-textarea"
        value={content}
        onChange={onInput}
        placeholder="Écrivez ensemble : chaque membre voit les modifications en direct. Chaque mot écrit est compté dans ta contribution."
        className="w-full min-h-[460px] p-6 text-[15px] leading-7 text-slate-800 focus:outline-none resize-y bg-[linear-gradient(transparent_27px,#e2e8f0_28px)] bg-[length:100%_28px] bg-local"
      />
    </div>
  );
};
