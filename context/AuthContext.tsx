// context/AuthContext.tsx
// Auth with online-first behavior; persists token in SecureStore (via api.ts)

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setToken as setApiToken, loadToken as loadApiToken } from '../src/api';
import type { User, LoginPayload, RegisterPayload } from '../src/services';
import {
  loadPendingRegistrations,
  savePendingRegistrations,
  loadPendingProfileUpdates,
  savePendingProfileUpdates,
} from '../src/authQueue';

const KEY_TOKEN = 'auth:token'; // a cached copy (not the source of truth)
const KEY_USER  = 'auth:user';

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

  // Connectivity
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

  // Load cached session + restore API header
  useEffect(() => {
    (async () => {
      try {
        await loadApiToken(); // restore axios Authorization from SecureStore
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

  const persistSession = async (u: User, t: string) => {
    setUser(u);
    setToken(t);
    await setApiToken(t); // write to SecureStore + axios defaults
    await AsyncStorage.setItem(KEY_USER, JSON.stringify(u));
    await AsyncStorage.setItem(KEY_TOKEN, t); // cached copy for quick reads
  };

  const clearSession = async () => {
    setUser(null);
    setToken(null);
    await setApiToken(undefined); // clears SecureStore + axios header
    await AsyncStorage.removeItem(KEY_USER);
    await AsyncStorage.removeItem(KEY_TOKEN);
  };

  // ------------ Auth ------------
  const login: AuthContextType['login'] = async (payload) => {
    if (!online) {
      throw new Error('You are offline. Please connect to the internet to log in.');
    }
    const res = await api.post('/api/auth/login', payload);
    await persistSession(res.data.user, res.data.token);
    return { user: res.data.user as User, token: res.data.token as string };
  };

  const register: AuthContextType['register'] = async (payload) => {
    if (!online) {
      // queue for later, but still return a local session (no token)
      const q = await loadPendingRegistrations();
      q.push({ payload, createdAt: new Date().toISOString() });
      await savePendingRegistrations(q);

      const tempUser: User = {
        _id: undefined,
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
  };

  const logout = async () => {
    await clearSession();
  };

  const refreshMe = async () => {
    if (!token || !online) return;
    const res = await api.get('/api/auth/me');
    if (res.data) {
      setUser(res.data);
      await AsyncStorage.setItem(KEY_USER, JSON.stringify(res.data));
    }
  };

  const updateUser = async (fields: Partial<User>) => {
    if (!online || !token) {
      // online-only for now
      return;
    }
    const res = await api.put('/api/auth/me', fields);
    if (res.data) {
      setUser(res.data);
      await AsyncStorage.setItem(KEY_USER, JSON.stringify(res.data));
    }
  };

  const value = useMemo<AuthContextType>(() => ({
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
  }), [user, token, loading, online]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
