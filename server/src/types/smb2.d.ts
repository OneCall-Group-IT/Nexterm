declare module 'smb2' {
  export interface Smb2Options {
    share: string;
    domain?: string;
    username: string;
    password: string;
    autoCloseTimeout?: number;
  }

  export default class SMB2 {
    constructor(options: Smb2Options);

    readdir(
      path: string,
      callback: (err: Error | null, files?: string[]) => void
    ): void;

    createReadStream(path: string): NodeJS.ReadableStream;
    createWriteStream(path: string): NodeJS.WritableStream;
    close(): void;
  }
}