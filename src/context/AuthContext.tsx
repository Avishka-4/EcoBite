import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserData } from '../api/auth';
import { usersApi } from '../api/users';

interface AuthContextType {
  user: UserData | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: UserData) => void;
  logout: () => void;
  updateUser: (user: UserData) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('ecobite_token');
    if (storedToken) {
      setToken(storedToken);
      usersApi
        .getMe()
        .then(setUser)
        .catch(() => {
          localStorage.removeItem('ecobite_token');
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = (newToken: string, newUser: UserData) => {
    localStorage.setItem('ecobite_token', newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('ecobite_token');
    setToken(null);
    setUser(null);
  };

  const updateUser = (updated: UserData) => setUser(updated);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
