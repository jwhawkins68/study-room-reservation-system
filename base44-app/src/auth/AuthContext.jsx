import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { api } from '../lib/api';
import { ApiError } from '../lib/errors';

const AuthContext = createContext(null);

// Base44 roles map to SRRS roles: "admin" = staff, "user" = student.
const toProfile = (u) =>
  u && {
    id: u.id,
    fullName: u.full_name || '',
    studentId: u.student_id || '',
    email: u.email,
    role: u.role === 'admin' ? 'staff' : 'student',
    // SRRS-13: staff are system admins unless marked coordinator for specific buildings
    staffRole: u.role === 'admin' ? (u.staff_role || 'system_admin') : null,
    buildings: u.buildings || [],
  };

const friendly = (err, fallback) => err?.response?.data?.message || err?.data?.message || err?.message || fallback;

// Holds the signed-in user's profile ({ id, fullName, studentId, email, role }), like the team repo's AuthContext.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    try {
      const p = toProfile(await base44.auth.me());
      setUser(p);
      return p;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    loadProfile().finally(() => setLoading(false));
  }, [loadProfile]);

  // SRRS-2
  const login = useCallback(async (email, password) => {
    try {
      const res = await base44.auth.loginViaEmailPassword(email.trim(), password);
      if (res?.access_token) base44.auth.setToken(res.access_token);
    } catch {
      throw new ApiError(400, 'INVALID_LOGIN', 'That email and password don’t match an account.');
    }
    const p = await loadProfile();
    if (!p) throw new ApiError(400, 'INVALID_LOGIN', 'Couldn’t sign you in. Try again.');
    return p;
  }, [loadProfile]);

  // SRRS-1, step 1: check the student ID, create the account, and email a 6-digit code.
  const startSignup = useCallback(async ({ studentId, email, password }) => {
    if (!(await api.studentIdAvailable(studentId))) {
      throw new ApiError(409, 'STUDENT_ID_TAKEN', 'That student ID already has an account.');
    }
    try {
      await base44.auth.register({ email: email.trim(), password });
    } catch (err) {
      const msg = friendly(err, 'Couldn’t create the account.');
      if (/exist|already|registered|taken/i.test(msg)) throw new ApiError(409, 'EMAIL_TAKEN', 'That email already has an account. Log in instead.');
      throw new ApiError(400, 'SIGNUP_FAILED', msg);
    }
  }, []);

  // SRRS-1, step 2: verify the code, sign in, and save name + student ID.
  const finishSignup = useCallback(async ({ fullName, studentId, email, password }, code) => {
    try {
      const res = await base44.auth.verifyOtp({ email: email.trim(), otpCode: code });
      if (res?.access_token) base44.auth.setToken(res.access_token);
      else await base44.auth.loginViaEmailPassword(email.trim(), password);
    } catch (err) {
      throw new ApiError(400, 'BAD_CODE', friendly(err, 'That code didn’t work. Check it and try again.'));
    }
    await api.completeProfile({ fullName, studentId });
    return loadProfile();
  }, [loadProfile]);

  const resendCode = useCallback((email) => base44.auth.resendOtp(email.trim()), []);

  const completeProfile = useCallback(async (body) => {
    await api.completeProfile(body);
    return loadProfile();
  }, [loadProfile]);

  const logout = useCallback(() => {
    setUser(null);
    base44.auth.logout(window.location.origin + '/');
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, startSignup, finishSignup, resendCode, completeProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function homeFor(user) {
  if (user?.role === 'staff') return '/staff';
  if (user && !user.studentId) return '/complete-profile';
  return '/student';
}
