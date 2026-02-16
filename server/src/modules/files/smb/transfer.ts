import { Readable } from 'stream';
import { createSmbClient, SmbConfig } from './client';

export async function smbUploadStream(cfg: SmbConfig, remotePath: string, input: Readable) {
  const client = createSmbClient(cfg);

  return new Promise<void>((resolve, reject) => {
    const ws = client.createWriteStream(remotePath);

    ws.on('error', (err) => {
      client.close();
      reject(err);
    });

    ws.on('finish', () => {
      client.close();
      resolve();
    });

    input.on('error', reject);

    input.pipe(ws);
  });
}

export async function smbDownloadStream(cfg: SmbConfig, remotePath: string) {
  const client = createSmbClient(cfg);
  const rs = client.createReadStream(remotePath);

  rs.on('end', () => client.close());
  rs.on('error', () => client.close());

  return rs;
}