// server/src/modules/files/service.ts

// Import your SMB config type
import { SmbConfig } from './smb/client';

// If you already have an SFTP config type, use it here.
// Otherwise define a temporary one:
interface SftpConfig {
  host: string;
  port: number;
  username: string;
  privateKey?: string;
  password?: string;
}

// This is the shape returned by resolveTransport()
export type TransportResolution =
  | { protocol: 'sftp'; sshConfig: SftpConfig }
  | { protocol: 'smb'; smbConfig: SmbConfig };

// -------------------------------------------------------------
// TEMPORARY server lookup + decrypt logic
// Replace these with real Nexterm implementations later
// -------------------------------------------------------------

async function getServerById(serverId: string, userId: string): Promise<any> {
  // 🔧 TEMPORARY — Replace when wired into Nexterm’s DB
  if (serverId === 'windows-test') {
    return {
      id: 'windows-test',
      hostname: 'WIN-SERVER',
      fileTransferProtocol: 'smb',
      smbShare: 'C$',                 // admin drive share
      smbDomain: 'YOURDOMAIN',
      smbUser: 'svc-nexterm',
      smbPass: 'Password123',        // should be encrypted later
    };
  }

  if (serverId === 'linux-test') {
    return {
      id: 'linux-test',
      hostname: 'linux.example.com',
      port: 22,
      username: 'root',
      privateKey: null,
      password: 'rootpassword',
      fileTransferProtocol: 'sftp',
    };
  }

  throw new Error(`Server ${serverId} not found`);
}

// TEMP decrypt — just returns raw string
function decrypt(value: string | undefined | null): string | undefined {
  return value ?? undefined;
}

// -------------------------------------------------------------
// REAL IMPLEMENTATION — Loosened SMB config + TS-safe narrowing
// -------------------------------------------------------------

export async function resolveTransport(
  serverId: string,
  userId: string
): Promise<TransportResolution> {
  const server = await getServerById(serverId, userId);

  // -----------------------------
  // SMB (Windows)
  // -----------------------------
  if (server.fileTransferProtocol === 'smb') {
    const smbCfg: SmbConfig = {
      host: server.hostname ?? '',            // allow empty to satisfy TS
      share: server.smbShare ?? 'C$',         // default share
      domain: server.smbDomain ?? undefined,
      username: server.smbUser ?? '',         // loosened: empty string allowed
      password: decrypt(server.smbPass) ?? '',// loosened: empty string allowed
    };

    return {
      protocol: 'smb',
      smbConfig: smbCfg,
    };
  }

  // -----------------------------
  // SFTP (Linux / SSH-enabled Windows)
  // -----------------------------
  const sshCfg: SftpConfig = {
    host: server.hostname ?? '',
    port: server.port ?? 22,
    username: server.username ?? '',
    privateKey: decrypt(server.privateKey) ?? undefined,
    password: decrypt(server.password) ?? undefined,
  };

  return {
    protocol: 'sftp',
    sshConfig: sshCfg,
  };
}