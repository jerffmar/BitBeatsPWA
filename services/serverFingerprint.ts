import { mkdtemp, writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { resolveFingerprint } from './metadataCache';

const execFileAsync = promisify(execFile);

const parseFpcalcOutput = (stdout: string) => {
  const fingerprintLine = stdout
    .split('\n')
    .find((line) => line.startsWith('FINGERPRINT='));
  const durationLine = stdout
    .split('\n')
    .find((line) => line.startsWith('DURATION='));

  if (!fingerprintLine || !durationLine) {
    throw new Error('fpcalc output missing fingerprint or duration.');
  }

  const fingerprint = fingerprintLine.replace('FINGERPRINT=', '').trim();
  const duration = Number(durationLine.replace('DURATION=', '').trim());

  if (!fingerprint || Number.isNaN(duration)) {
    throw new Error('Unable to parse fpcalc output.');
  }

  return { fingerprint, duration };
};

export const identifyUploadedAudio = async (buffer: Buffer) => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'bitbeats-fp-'));
  const tmpFile = join(tmpDir, 'upload_audio');
  try {
    await writeFile(tmpFile, buffer);
    const { stdout } = await execFileAsync('fpcalc', ['-length', '120', tmpFile]);
    const { fingerprint, duration } = parseFpcalcOutput(stdout);
    return await resolveFingerprint(fingerprint, duration);
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      throw new Error('fpcalc binary not found. Ensure libchromaprint-tools is installed.');
    }
    throw err;
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
};
