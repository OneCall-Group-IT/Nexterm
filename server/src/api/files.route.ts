// server/src/api/files.route.ts

import express from 'express';
import multer from 'multer';
import { Readable } from 'stream';
import path from 'path';
import { Client as SshClient } from 'ssh2';

import { resolveTransport } from '../modules/files/service';
import { smbUploadStream, smbDownloadStream } from '../modules/files/smb/transfer';
import { smbFromUserPath } from '../modules/files/utils/smbPath';

// No explicit file size limit
const upload = multer();

const router = express.Router();

// TEMP user lookup – replace with real auth later
function getUserId(req: any): string {
  return req.user?.id || 'local-dev-user';
}

/**
 * Local helper for SFTP, inlined here to avoid module resolution issues.
 */
async function withSftp(
  config: {
    host: string;
    port: number;
    username: string;
    privateKey?: string;
    password?: string;
  },
  fn: (sftp: any) => Promise<void> | void
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const conn = new SshClient();

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

/**
 * Upload file to a server (Linux via SFTP, Windows via SMB).
 *
 * POST /servers/:serverId/files/upload
 * Body: multipart/form-data { file, path }
 */
router.post(
  '/servers/:serverId/files/upload',
  upload.single('file'),
  async (req: any, res: any) => {
    try {
      const serverId = req.params.serverId as string;
      const userId = getUserId(req);
      const remotePath = (req.body.path as string) || '';

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      if (!remotePath) {
        return res.status(400).json({ error: 'Missing path parameter' });
      }

      const transport: any = await resolveTransport(serverId, userId);

      const fileStream: Readable | null =
        (req.file as any).stream ||
        (req.file.buffer ? Readable.from(req.file.buffer) : null);

      if (!fileStream) {
        return res.status(500).json({ error: 'Unable to read uploaded file stream' });
      }

      if (transport.protocol === 'smb') {
        // Windows via SMB
        const smbConfig = transport.smbConfig;
        const uncPath = smbFromUserPath(smbConfig.host, remotePath);
        await smbUploadStream(smbConfig, uncPath, fileStream);
      } else {
        // Linux / SSH-enabled host via SFTP
        const sshConfig = transport.sshConfig;

        await withSftp(sshConfig, (sftp: any) => {
          return new Promise<void>((resolve, reject) => {
            const ws = sftp.createWriteStream(remotePath);
            fileStream.pipe(ws);
            ws.on('close', resolve);
            ws.on('error', reject);
          });
        });
      }

      res.json({ success: true });
    } catch (err) {
      console.error('Upload failed:', err);
      res.status(500).json({ error: 'File upload failed' });
    }
  }
);

/**
 * Download file from a server.
 *
 * GET /servers/:serverId/files/download?path=/some/path or C:\Path\File
 */
router.get(
  '/servers/:serverId/files/download',
  async (req: any, res: any) => {
    try {
      const serverId = req.params.serverId as string;
      const userId = getUserId(req);
      const remotePath = req.query.path as string;

      if (!remotePath) {
        return res.status(400).json({ error: 'Missing path parameter' });
      }

      const transport: any = await resolveTransport(serverId, userId);

      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${path.basename(remotePath)}"`
      );

      if (transport.protocol === 'smb') {
        const smbConfig = transport.smbConfig;
        const uncPath = smbFromUserPath(smbConfig.host, remotePath);

        const rs = await smbDownloadStream(smbConfig, uncPath);
        rs.on('error', (err: any) => {
          console.error('SMB download error:', err);
          if (!res.headersSent) {
            res.status(500).json({ error: 'File download failed' });
          }
        });
        rs.pipe(res);
      } else {
        const sshConfig = transport.sshConfig;

        await withSftp(sshConfig, (sftp: any) => {
          const rs = sftp.createReadStream(remotePath);
          rs.on('error', (err: any) => {
            console.error('SFTP download error:', err);
            if (!res.headersSent) {
              res.status(500).json({ error: 'File download failed' });
            }
          });
          rs.pipe(res);
        });
      }
    } catch (err) {
      console.error('Download failed:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'File download failed' });
      }
    }
  }
);

export default router;