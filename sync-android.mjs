import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const here = process.cwd();
const dist = resolve(here, 'dist');
const destination = resolve(here, '../android/app/src/main/assets/www');

await mkdir(destination, { recursive: true });
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(dist, destination, { recursive: true });
console.log(`React build copied to ${destination}`);
