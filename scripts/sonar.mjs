// @ts-check
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Support both naming conventions
const token = process.env.SONARQUBE_TOKEN ?? process.env.SONAR_TOKEN;

if (!token) {
  console.error('❌ SonarQube token not found.');
  console.error('   Set SONARQUBE_TOKEN as a User environment variable.');
  console.error('   Generate one at http://localhost:9000/account/security');
  process.exit(1);
}

// Pass token via env var — avoids exposing it in the process argument list
const result = spawnSync('sonar-scanner', [], {
  stdio: 'inherit',
  cwd: rootDir,
  // sonar-scanner reads SONAR_TOKEN natively — no -Dsonar.token arg needed
  env: { ...process.env, SONAR_TOKEN: token },
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);
