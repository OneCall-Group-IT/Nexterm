export function smbFromUserPath(host: string, path: string): string {
  const drive = path[0].toUpperCase();
  const clean = path.slice(2).replace(/\\/g, '/'); // C:\Folder\File => Folder/File

  return `\\\\${host}\\${drive}$\\${clean}`;
}