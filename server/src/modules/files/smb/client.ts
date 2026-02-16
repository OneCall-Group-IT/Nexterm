import SMB2 from 'smb2';

export interface SmbConfig {
  host: string;
  share: string;
  domain?: string;
  username: string;
  password: string;
}

export function createSmbClient(config: SmbConfig): SMB2 {
  return new SMB2({
    share: `\\\\${config.host}\\${config.share}`,
    domain: config.domain,
    username: config.username,
    password: config.password,
    autoCloseTimeout: 0,
  });
}