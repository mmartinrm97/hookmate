import { execSync } from 'node:child_process';

const allowedPermanentBranches = new Set(['main', 'develop']);
const allowedPrefixes = [
  'feature',
  'bugfix',
  'hotfix',
  'refactor',
  'chore',
  'docs',
  'test',
  'ci',
  'build',
  'infra',
  'release',
];

const branchNamePattern = new RegExp(
  `^(?:${allowedPrefixes.join('|')})\\/[a-z0-9]+(?:-[a-z0-9]+)*$`,
);

function resolveBranchName() {
  const argsBranch = process.argv[2]?.trim();

  if (argsBranch) {
    return argsBranch;
  }

  const refBranch =
    process.env.GITHUB_HEAD_REF?.trim() ||
    process.env.GITHUB_REF_NAME?.trim() ||
    process.env.BRANCH_NAME?.trim();

  if (refBranch) {
    return refBranch;
  }

  return execSync('git branch --show-current', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

const branchName = resolveBranchName();

if (!branchName) {
  console.error('Unable to determine the current branch name.');
  process.exit(1);
}

if (branchName.startsWith('codex/')) {
  console.error(
    `Invalid branch name "${branchName}". The "codex/" prefix is forbidden in this repository.`,
  );
  process.exit(1);
}

if (allowedPermanentBranches.has(branchName)) {
  process.exit(0);
}

if (!branchNamePattern.test(branchName)) {
  console.error(`Invalid branch name "${branchName}".`);
  console.error('Expected format: <type>/<short-kebab-description>.');
  console.error(`Allowed types: ${allowedPrefixes.join(', ')}.`);
  console.error('Examples:');
  console.error('  feature/endpoints-persistence');
  console.error('  bugfix/hmac-signature-validation');
  console.error('  infra/cdk-core-stacks');
  process.exit(1);
}
