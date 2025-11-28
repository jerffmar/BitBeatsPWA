import { createClient, type MatrixClient, type MatrixEvent, type Room } from 'matrix-js-sdk';

const MATRIX_SESSION_KEY = 'bitbeats_matrix_session';

export interface MatrixSession {
  accessToken: string;
  userId: string;
  deviceId: string;
  homeServer: string;
  createdAt: number;
}

let client: MatrixClient | null = null;
let startPromise: Promise<MatrixClient> | null = null;

export const getStoredMatrixSession = (): MatrixSession | null => {
  const raw = localStorage.getItem(MATRIX_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MatrixSession;
  } catch {
    return null;
  }
};

export const setStoredMatrixSession = (session: MatrixSession | null) => {
  if (!session) {
    localStorage.removeItem(MATRIX_SESSION_KEY);
    return;
  }
  localStorage.setItem(MATRIX_SESSION_KEY, JSON.stringify(session));
};

const waitForInitialSync = (matrix: MatrixClient) =>
  new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Matrix sync timeout')), 15000);
    matrix.once('sync', (state: string) => {
      if (state === 'PREPARED' || state === 'SYNCING') {
        clearTimeout(timeout);
        resolve();
      }
    });
  });

export const initMatrixClient = async (): Promise<MatrixClient> => {
  if (client) return client;
  const session = getStoredMatrixSession();
  if (!session) throw new Error('Matrix session missing. Login first.');
  client = createClient({
    baseUrl: session.homeServer,
    accessToken: session.accessToken,
    userId: session.userId,
    deviceId: session.deviceId
  });
  if (!startPromise) {
    startPromise = (async () => {
      await client!.startClient({ initialSyncLimit: 50 });
      await waitForInitialSync(client!);
      return client!;
    })().catch(err => {
      console.error('[Matrix] startClient failed', err);
      client = null;
      startPromise = null;
      throw err;
    });
  }
  await startPromise;
  return client!;
};

export const getMatrixClient = async () => {
  if (client) return client;
  return initMatrixClient();
};

export const stopMatrixClient = () => {
  if (client) {
    client.stopClient();
  }
  client = null;
  startPromise = null;
};

export const joinMatrixRoom = async (roomId: string): Promise<Room | null> => {
  const matrix = await getMatrixClient();
  if (!roomId) throw new Error('Matrix roomId not configured.');
  if (matrix.getRoom(roomId)) return matrix.getRoom(roomId)!;
  try {
    await matrix.joinRoom(roomId);
  } catch (err: any) {
    if (err?.errcode !== 'M_ALREADY_JOINED') {
      console.warn(`[Matrix] Failed to join room ${roomId}`, err);
    }
  }
  return matrix.getRoom(roomId) || null;
};

export const processRoomHistory = (
  room: Room | null,
  type: string,
  handler: (event: MatrixEvent) => void,
  seen: Set<string>
) => {
  if (!room) return;
  room.timeline?.forEach(event => {
    if (event.getType() === type && !seen.has(event.getId() || '')) {
      seen.add(event.getId() || '');
      handler(event);
    }
  });
};
