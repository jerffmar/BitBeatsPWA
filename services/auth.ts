import type { User } from '../types.ts';
import { getGun } from './db.ts';

const STORAGE_KEY_PAIR = 'bitbeats_user_pair';
const logGunAuth = (...args: any[]) => console.debug('[GUN][AUTH]', ...args);

// We persist the SEA KeyPair in localStorage manually 
// because we have disabled Gun's automatic localStorage sync 
// to prevent the entire graph from filling up the browser quota.

export const getKeyPair = (): any => {
    const pairStr = localStorage.getItem(STORAGE_KEY_PAIR);
    if (!pairStr) return null;
    try {
        return JSON.parse(pairStr);
    } catch {
        return null;
    }
};

export const getSession = async (): Promise<User | null> => {
  const pairStr = localStorage.getItem(STORAGE_KEY_PAIR);
  if (!pairStr) return null;

  try {
    const pair = JSON.parse(pairStr);
    const gun = getGun();
    const user = gun.user();
    
    if (user.is) {
      logGunAuth('session active', { pub: user.is.pub, alias: user.is.alias });
      return {
        id: user.is.pub,
        username: user.is.alias,
        handle: '@' + user.is.alias,
        joinedAt: Date.now() // Gun doesn't store this by default on root, simplified
      };
    }

    // Re-authenticate with stored keys
    return new Promise((resolve) => {
      user.auth(pair, (ack: any) => {
        if (ack.err) {
          logGunAuth('session restore failed', ack.err);
          resolve(null);
        } else {
          logGunAuth('session restored', { pub: ack.sea.pub, alias: ack.sea.alias });
          resolve({
            id: ack.sea.pub,
            username: ack.sea.alias || 'Anon',
            handle: '@' + (ack.sea.alias || 'Anon'),
            joinedAt: Date.now()
          });
        }
      });
    });

  } catch (e) {
    return null;
  }
};

export const logout = () => {
  const gun = getGun();
  logGunAuth('logout');
  gun.user().leave();
  localStorage.removeItem(STORAGE_KEY_PAIR);
};

export const login = async (username: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> => {
  const gun = getGun();
  return new Promise((resolve) => {
    gun.user().auth(username, password, (ack: any) => {
      if (ack.err) {
        logGunAuth('login error', ack.err);
        resolve({ success: false, error: ack.err });
      } else {
        // Save keypair for persistence
        localStorage.setItem(STORAGE_KEY_PAIR, JSON.stringify(ack.sea));
        
        logGunAuth('login ok', { pub: ack.sea.pub, alias: ack.alias });
        resolve({ 
          success: true, 
          user: {
            id: ack.sea.pub,
            username: ack.alias,
            handle: '@' + ack.alias,
            joinedAt: Date.now()
          } 
        });
      }
    });
  });
};

export const register = async (username: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> => {
  const gun = getGun();

  if (username.length < 3) return { success: false, error: 'Username too short' };
  
  return new Promise((resolve) => {
    gun.user().create(username, password, (ack: any) => {
      if (ack.err) {
         logGunAuth('register error', ack.err);
         resolve({ success: false, error: ack.err });
      } else {
         logGunAuth('register ok', { alias: username });
         login(username, password).then(resolve);
      }
    });
  });
};
