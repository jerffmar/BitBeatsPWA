import { User } from '../types.ts';
import { getGun } from './db';

const STORAGE_KEY_PAIR = 'bitbeats_user_pair';

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
      // Already authenticated in memory
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
          resolve(null);
        } else {
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
  gun.user().leave();
  localStorage.removeItem(STORAGE_KEY_PAIR);
};

export const login = async (username: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> => {
  const gun = getGun();
  
  return new Promise((resolve) => {
    gun.user().auth(username, password, (ack: any) => {
      if (ack.err) {
        resolve({ success: false, error: ack.err });
      } else {
        // Save keypair for persistence
        localStorage.setItem(STORAGE_KEY_PAIR, JSON.stringify(ack.sea));
        
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
         resolve({ success: false, error: ack.err });
      } else {
         // Auto login after create
         login(username, password).then(resolve);
      }
    });
  });
};
