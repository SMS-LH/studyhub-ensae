import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api, getToken, setToken } from "@/lib/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!getToken()) return setUser(false);
    api
      .get("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => {
        setToken(null);
        setUser(false);
      });
  }, []);

  const authenticate = useCallback(async (path, body) => {
    const { data } = await api.post(path, body);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await api.post("/auth/logout").catch(() => {});
    setToken(null);
    setUser(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        login: (email, password) =>
          authenticate("/auth/login", { email, password }),
        register: (payload) => authenticate("/auth/register", payload),
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
