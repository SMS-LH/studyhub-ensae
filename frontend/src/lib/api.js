import axios from "axios";

const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/+$/, "");
export const API = `${BACKEND_URL}/api`;
const TOKEN_KEY = "studyhub_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) =>
  t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);

export const api = axios.create({ baseURL: API });
api.interceptors.request.use((cfg) => {
  const t = getToken();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

export const fileUrl = (docId, version) =>
  `${API}/documents/${docId}/file?token=${getToken()}${version ? `&version=${version}` : ""}`;

export const wsUrl = (path) =>
  `${API.replace(/^http/, "ws")}${path}?token=${getToken()}`;
export const avatarUrl = (userId, v) =>
  `${API}/users/${userId}/avatar?token=${getToken()}&v=${encodeURIComponent(v || "")}`;

export function formatError(e) {
  const detail = e?.response?.data?.detail;
  if (detail == null) return e?.message || "Une erreur est survenue. Réessaie.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((d) => d?.msg || JSON.stringify(d)).join(" ");
  return detail.msg || String(detail);
}

export async function streamSSE(path, body, onDelta) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      typeof data.detail === "string" ? data.detail : "Erreur du service IA",
    );
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop();
    for (const p of parts) {
      if (!p.startsWith("data: ")) continue;
      const evt = JSON.parse(p.slice(6));
      if (evt.error) throw new Error(evt.error);
      if (evt.delta) onDelta(evt.delta);
    }
  }
}

export const formatDate = (
  iso,
  opts = { day: "numeric", month: "short", year: "numeric" },
) => (iso ? new Date(iso).toLocaleDateString("fr-FR", opts) : "");

export const timeAgo = (iso) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  if (s < 604800) return `il y a ${Math.floor(s / 86400)} j`;
  return formatDate(iso);
};
