import type { User } from '../types.ts';

const USERS_KEY = 'bitbeats_users';
const SESSION_KEY = 'bitbeats_session';

interface StoredUser {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
  createdAt: number;
}

const loadUsers = (): Record<string, StoredUser> => {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveUsers = (users: Record<string, StoredUser>) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

const hashPassword = async (salt: string, password: string) => {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

const mapStoredUser = (stored: StoredUser): User => ({
  id: stored.id,
  username: stored.username,
  handle: `@${stored.username}`,
  joinedAt: stored.createdAt
});

export const getSession = async (): Promise<User | null> => {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as StoredUser;
    return mapStoredUser(stored);
  } catch {
    return null;
  }
};

export const login = async (
  username: string,
  password: string
): Promise<{ success: boolean; user?: User; error?: string }> => {
  const users = loadUsers();
  const record = users[username.toLowerCase()];
  if (!record) return { success: false, error: 'User not found' };
  const hash = await hashPassword(record.salt, password);
  if (hash !== record.passwordHash) {
    return { success: false, error: 'Invalid credentials' };
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(record));
  return { success: true, user: mapStoredUser(record) };
};

export const register = async (
  username: string,
  password: string
): Promise<{ success: boolean; user?: User; error?: string }> => {
  if (username.length < 3) return { success: false, error: 'Username too short' };
  if (password.length < 6) return { success: false, error: 'Password must be at least 6 characters' };

  const users = loadUsers();
  const key = username.toLowerCase();
  if (users[key]) return { success: false, error: 'Username already exists' };

  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const salt = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const passwordHash = await hashPassword(salt, password);

  const stored: StoredUser = {
    id: `user_${crypto.randomUUID()}`,
    username,
    salt,
    passwordHash,
    createdAt: Date.now()
  };

  users[key] = stored;
  saveUsers(users);
  localStorage.setItem(SESSION_KEY, JSON.stringify(stored));

  return { success: true, user: mapStoredUser(stored) };
};

export const logout = () => {
  localStorage.removeItem(SESSION_KEY);
};
