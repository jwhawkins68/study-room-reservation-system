import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { USE_MOCK } from '../lib/config';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { mockAuth } from '../lib/mock';
import { ApiError } from '../lib/errors';

const AuthContext = createContext(null);

// Holds the signed-in user's profile ({ id, fullName, studentId, email, role }).
// Real mode: Supabase handles the login itself, then GET /me returns the profile and role.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    try {
      setUser(await api.me());
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    if (USE_MOCK) {
      mockAuth.session().then((u) => { if (active) { setUser(u); setLoading(false); } });
      return () => { active = false; };
    }
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) await loadProfile();
      if (active) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setUser(null);
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [loadProfile]);

  const login = useCallback(async (email, password) => {
    if (USE_MOCK) {
      const u = await mockAuth.login(email, password);
      setUser(u);
      return u;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new ApiError(400, 'INVALID_LOGIN', 'That email and password don’t match an account.');
    const profile = await api.me();
    setUser(profile);
    return profile;
  }, []);

  const signup = useCallback(async (form) => {
    await api.signup(form);
    return login(form.email, form.password);
  }, [login]);

  const logout = useCallback(async () => {
    if (USE_MOCK) await mockAuth.logout();
    else await supabase.auth.signOut();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function homeFor(user) {
  return user?.role === 'staff' ? '/staff' : '/student';
}
