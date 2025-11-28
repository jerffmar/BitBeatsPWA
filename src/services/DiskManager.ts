import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';

const STORAGE_PATH = process.env.STORAGE_PATH || '/app/uploads';
const MAX_STORAGE = 10 * 1024 * 1024 * 1024; // 10GB

export async function saveFile(userId: string, fileBuffer: Buffer, filename: string): Promise<string> {
  const userDir = path.join(STORAGE_PATH, userId);
  await fs.promises.mkdir(userDir, { recursive: true });
  const filePath = path.join(userDir, filename);
  await fs.promises.writeFile(filePath, fileBuffer);
  return filePath;
}

export async function checkQuota(userId: string, incomingSize: number): Promise<boolean> {
  const userDir = path.join(STORAGE_PATH, userId);
  let currentSize = 0;

  if (fs.existsSync(userDir)) {
    try {
      // Use 'du' for efficiency if available
      const { stdout } = await promisify(exec)(`du -sb ${userDir}`);
      currentSize = parseInt(stdout.split('\t')[0], 10);
    } catch {
      // Fallback: recursive stat
      const getDirSize = async (dir: string): Promise<number> => {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        let size = 0;
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            size += await getDirSize(fullPath);
          } else if (entry.isFile()) {
            const stats = await fs.promises.stat(fullPath);
            size += stats.size;
          }
        }
        return size;
      };
      currentSize = await getDirSize(userDir);
    }
  }

  return currentSize + incomingSize <= MAX_STORAGE;
}
