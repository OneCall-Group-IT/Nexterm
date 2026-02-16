import { Client } from 'ssh2';

export interface SftpConfig {
  host: string;
  port: number;
  username: string;
  privateKey?: string;
  password?: string;
}

/**
 * Open an SFTP session using ssh2, run the given function, and close cleanly.
 */
export function withSftp(
  config: SftpConfig,
  fn: (sftp: any) => Promise<void> | void
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const conn = new Client();

    conn.on('ready', () => {
      conn.sftp(async (err: Error | null, sftp: any) => {
        if (err) {
          conn.end();
          return reject(err);
        }

        try {
          const result = fn(sftp);
          if (result && typeof (result as Promise<void>).then === 'function') {
            await result;
          }
          conn.end();
          resolve();
        } catch (e) {
          conn.end();
          reject(e as Error);
        }
      });
    });

    conn.on('error', (err: Error) => {
      reject(err);
    });

    conn.connect({
      host: config.host,
      port: config.port,
      username: config.username,
      privateKey: config.privateKey,
      password: config.password,
    });
  });
}