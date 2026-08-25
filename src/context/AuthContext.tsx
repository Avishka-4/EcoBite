import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserData } from '../api/auth';
import { usersApi } from '../api/users';

const DEFAULT_GUEST_USER: UserData = {
  id: 1,
  email: 'chef@ecobite.app',
  name: 'Chef',
  age: 25,
  cooking_experience: 'beginner',
  preferred_cuisine: 'Sri Lankan',
  created_at: new Date().toISOString(),
};

interface AuthContextType {
  user: UserData;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: UserData) => void;
  logout: () => void;
  updateUser: (user: UserData) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData>(() => {
    try {
      const cached = localStorage.getItem('ecobite_user');
      return cached ? JSON.parse(cached) : DEFAULT_GUEST_USER;
    } catch {
      return DEFAULT_GUEST_USER;
    }
  });

  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('ecobite_token');
  });

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem('ecobite_token');
    if (storedToken) {
      usersApi
        .getMe()
        .then((fetchedUser) => {
          setUser(fetchedUser);
          localStorage.setItem('ecobite_user', JSON.stringify(fetchedUser));
        })
        .catch(() => {
          // If backend offline or guest token, keep local user
        });
    }
  }, []);

  const login = (newToken: string, newUser: UserData) => {
    localStorage.setItem('ecobite_token', newToken);
    localStorage.setItem('ecobite_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('ecobite_token');
    localStorage.removeItem('ecobite_user');
    setToken(null);
    setUser(DEFAULT_GUEST_USER);
  };

  const updateUser = (updated: UserData) => {
    setUser(updated);
    localStorage.setItem('ecobite_user', JSON.stringify(updated));
  };

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
