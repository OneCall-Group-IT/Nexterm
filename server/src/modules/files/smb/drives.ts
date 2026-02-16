import { createSmbClient, SmbConfig } from './client';

const DRIVE_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function checkDrive(cfg: SmbConfig, letter: string): Promise<boolean> {
  return new Promise((resolve) => {
    // For drive detection, we can set share to the drive admin share
    const client = createSmbClient({
      ...cfg,
      share: `${letter}$`,
    });

    const rootPath = `\\${letter}$\\`;

    client.readdir(rootPath, (err) => {
      client.close();
      if (err) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

export async function listDrives(cfg: SmbConfig): Promise<string[]> {
  const drives: string[] = [];

  for (const letter of DRIVE_LETTERS) {
    try {
      const exists = await checkDrive(cfg, letter);
      if (exists) {
        drives.push(`${letter}:\\`);
      }
    } catch {
      // ignore errors per drive
    }
  }

  return drives;
}