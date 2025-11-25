
import { User } from '../types';

const STORAGE_KEY_USERS = 'bitbeats_users_db';
const STORAGE_KEY_SESSION = 'bitbeats_session';

interface StoredUser extends User {
  passwordHash: string; // In a real app, use proper hashing. Here we simulate.
}

export const getSession = (): User | null => {
  const sessionJson = localStorage.getItem(STORAGE_KEY_SESSION);
  return sessionJson ? JSON.parse(sessionJson) : null;
};

export const logout = () => {
  localStorage.removeItem(STORAGE_KEY_SESSION);
};

export const login = async (username: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> => {
  // Simulate network delay
  await new Promise(r => setTimeout(r, 600));

  const db = JSON.parse(localStorage.getItem(STORAGE_KEY_USERS) || '[]');
  const user = db.find((u: StoredUser) => u.username.toLowerCase() === username.toLowerCase());

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  // Simple string comparison for mock purposes. REAL APP MUST HASH.
  if (user.passwordHash !== password) {
    return { success: false, error: 'Invalid credentials' };
  }

  const sessionUser: User = {
    id: user.id,
    username: user.username,
    handle: user.handle,
    joinedAt: user.joinedAt
  };

  localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(sessionUser));
  return { success: true, user: sessionUser };
};

export const register = async (username: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> => {
  await new Promise(r => setTimeout(r, 800));

  if (username.length < 3) return { success: false, error: 'Username too short' };
  if (password.length < 4) return { success: false, error: 'Password too weak' };

  const db: StoredUser[] = JSON.parse(localStorage.getItem(STORAGE_KEY_USERS) || '[]');
  
  if (db.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    return { success: false, error: 'Username already taken' };
  }

  const newUser: StoredUser = {
    id: 'u_' + Math.random().toString(36).substr(2, 9),
    username,
    handle: '@' + username.replace(/\s+/g, ''),
    passwordHash: password,
    joinedAt: Date.now()
  };

  db.push(newUser);
  localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(db));

  // Auto login
  const sessionUser: User = {
    id: newUser.id,
    username: newUser.username,
    handle: newUser.handle,
    joinedAt: newUser.joinedAt
  };
  localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(sessionUser));

  return { success: true, user: sessionUser };
};
