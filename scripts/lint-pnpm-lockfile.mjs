import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const lockfilePath = resolve(process.cwd(), 'pnpm-lock.yaml');
const lockfile = readFileSync(lockfilePath, 'utf8');

const forbiddenProtocols = ['http://', 'git+', 'git://', 'github:', 'ssh://'];
const foundForbiddenProtocol = forbiddenProtocols.find((protocol) => lockfile.includes(protocol));

if (foundForbiddenProtocol) {
  console.error(`Forbidden protocol found in pnpm-lock.yaml: ${foundForbiddenProtocol}`);
  process.exit(1);
}

const tarballMatches = [...lockfile.matchAll(/tarball:\s+(\S+)/g)];
const invalidTarballs = tarballMatches
  .map(([, tarballUrl]) => tarballUrl)
  .filter((tarballUrl) => !tarballUrl.startsWith('https://registry.npmjs.org/'));

if (invalidTarballs.length > 0) {
  console.error('Unexpected tarball hosts found in pnpm-lock.yaml:');

  for (const tarballUrl of invalidTarballs) {
    console.error(` - ${tarballUrl}`);
  }

  process.exit(1);
}

console.log('pnpm-lock.yaml passed protocol and tarball-host checks.');
