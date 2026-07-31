import React, { createContext, useEffect, useState, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { loginUser, registerUser } from "../services/authService";
import { setUnauthorizedHandler } from "../services/apiService";

interface User {
  [key: string]: unknown;
}

interface LoginCredentials {
  username: string;
  password: string;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
}

interface AuthResult {
  success: boolean;
  message: string;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  signIn: (credentials: LoginCredentials) => Promise<AuthResult>;
  signUp: (userData: RegisterData) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function restoreSession() {
      try {
        const [at, rt, u] = await AsyncStorage.multiGet([
          "accessToken",
          "refreshToken",
          "user",
        ]).then((items) => items.map(([, value]) => value));

        if (at && rt && u) {
          setAccessToken(at);
          setRefreshToken(rt);
          setUser(JSON.parse(u) as User);
        }
      } catch (error) {
        console.error("Failed to restore session:", error);
      } finally {
        setIsLoading(false);
      }
    }

    restoreSession();
  }, []);

  // ============================================================
  // АВТОМАТИЧЕСКИЙ ВЫХОД ПРИ ИСТЁКШЕЙ СЕССИИ
  // ============================================================
  // ApiService сам обновляет access token через refresh token при
  // каждом 401. Но если и refresh token уже недействителен,
  // ApiService чистит AsyncStorage и зовёт этот колбэк — здесь мы
  // синхронизируем React-состояние, чтобы isAuthenticated стал
  // false и AppNavigator сам переключился на экран логина, без
  // ручных проверок в каждом экране.
  useEffect(() => {
    function handleUnauthorized() {
      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
      // AsyncStorage уже очищен внутри apiRequest — здесь его трогать не нужно.
    }

    setUnauthorizedHandler(handleUnauthorized);

    return () => {
      setUnauthorizedHandler(null);
    };
  }, []);

  async function saveAuthData(userData: User, access: string, refresh: string) {
    setUser(userData);
    setAccessToken(access);
    setRefreshToken(refresh);

    await AsyncStorage.multiSet([
      ["user", JSON.stringify(userData)],
      ["accessToken", access],
      ["refreshToken", refresh],
    ]);
  }

  async function signUp(userData: RegisterData): Promise<AuthResult> {
    const { user, access, refresh, message } = await registerUser(userData);

    await saveAuthData(user as User, access, refresh);

    return {
      success: true,
      message,
    };
  }

  async function signIn(credentials: LoginCredentials): Promise<AuthResult> {
    const { user, access, refresh, message } = await loginUser(credentials);

    await saveAuthData(user as User, access, refresh);

    return {
      success: true,
      message,
    };
  }

  async function signOut(): Promise<void> {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);

    await AsyncStorage.multiRemove(["user", "accessToken", "refreshToken"]);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        refreshToken,
        isLoading,
        isAuthenticated: !!user,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}