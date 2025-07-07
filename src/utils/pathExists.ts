import {accessSync} from 'fs';

export function pathExists(p: string): boolean {
  try {
    accessSync(p);
  } catch (err) {
    return false;
  }
  return true;
}
