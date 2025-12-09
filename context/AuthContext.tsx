// context/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from 'react';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  api,
  setToken as setApiToken,
  loadToken as loadApiToken,
} from '../src/api';
import type { User, LoginPayload, RegisterPayload } from '../src/services';
import {
  loadPendingRegistrations,
  savePendingRegistrations,
  loadPendingProfileUpdates,
  savePendingProfileUpdates,
} from '../src/authQueue';

const KEY_TOKEN = 'auth:token';
const KEY_USER = 'auth:user';

type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  online: boolean;
  login: (payload: LoginPayload) => Promise<{ user: User; token: string }>;
  register: (payload: RegisterPayload) => Promise<{ user: User; token: string }>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  updateUser: (fields: Partial<User>) => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  online: true,
  login: async () => ({ user: {} as User, token: '' }),
  register: async () => ({ user: {} as User, token: '' }),
  logout: async () => {},
  refreshMe: async () => {},
  updateUser: async () => {},
  setUser: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sub = NetInfo.addEventListener(state => {
      const isOnline = !!state.isConnected && !!state.isInternetReachable;
      setOnline(isOnline);
    });
    NetInfo.fetch().then(state => {
      const isOnline = !!state.isConnected && !!state.isInternetReachable;
      setOnline(isOnline);
    });
    return () => sub && sub();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await loadApiToken();
        const [t, u] = await Promise.all([
          AsyncStorage.getItem(KEY_TOKEN),
          AsyncStorage.getItem(KEY_USER),
        ]);
        if (t) setToken(t);
        if (u) setUser(JSON.parse(u));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persistSession = useCallback(async (u: User, t: string) => {
    setUser(u);
    setToken(t);
    await setApiToken(t);
    await AsyncStorage.setItem(KEY_USER, JSON.stringify(u));
    await AsyncStorage.setItem(KEY_TOKEN, t);
  }, []);

  const clearSession = useCallback(async () => {
    setUser(null);
    setToken(null);
    await setApiToken(undefined);
    await AsyncStorage.removeItem(KEY_USER);
    await AsyncStorage.removeItem(KEY_TOKEN);
  }, []);

  const login: AuthContextType['login'] = useCallback(
    async (payload: LoginPayload) => {
      if (!online) {
        throw new Error('You are offline. Please connect to the internet to log in.');
      }
      const res = await api.post('/api/auth/login', payload);
      await persistSession(res.data.user, res.data.token);
      return { user: res.data.user as User, token: res.data.token as string };
    },
    [online, persistSession]
  );

  const register: AuthContextType['register'] = useCallback(
    async (payload: RegisterPayload) => {
      if (!online) {
        const q = await loadPendingRegistrations();
        q.push({ payload, createdAt: new Date().toISOString() });
        await savePendingRegistrations(q);

        const tempUser: User = {
          _id: undefined,
          username: payload.username,
          name: payload.name,
          email: payload.email,
          role: payload.role || 'stakeholder',
          address: payload.address,
          farmLocation: payload.farmLocation,
          mobile: payload.mobile,
        };
        setUser(tempUser);
        setToken(null);
        await AsyncStorage.setItem(KEY_USER, JSON.stringify(tempUser));
        await AsyncStorage.removeItem(KEY_TOKEN);
        return { user: tempUser, token: '' };
      }

      const res = await api.post('/api/auth/register', payload);
      await persistSession(res.data.user, res.data.token);
      return { user: res.data.user as User, token: res.data.token as string };
    },
    [online, persistSession]
  );

  const logout = useCallback(async () => {
    await clearSession();
  }, [clearSession]);

  const refreshMe = useCallback(
    async () => {
      if (!token || !online) return;
      try {
        const res = await api.get('/api/auth/me');
        if (res.data) {
          setUser(res.data);
          await AsyncStorage.setItem(KEY_USER, JSON.stringify(res.data));
        }
      } catch (err) {
        console.error('Failed to refresh user:', err);
      }
    },
    [token, online]
  );

  const updateUser = useCallback(
    async (fields: Partial<User>) => {
      if (!online || !token) return;
      const res = await api.put('/api/auth/me', fields);
      if (res.data) {
        setUser(res.data);
        await AsyncStorage.setItem(KEY_USER, JSON.stringify(res.data));
      }
    },
    [online, token]
  );

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      token,
      loading,
      online,
      login,
      register,
      logout,
      refreshMe,
      updateUser,
      setUser,
    }),
    [user, token, loading, online, login, register, logout, refreshMe, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
