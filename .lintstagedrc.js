// @ts-check
import { relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * lint-staged configuration with per-workspace vitest related runs.
 *
 * Strategy:
 *   - ALL staged TS/TSX: oxlint --fix + oxfmt (fast, file-by-file)
 *   - apps/api staged src: vitest related --run (only tests affected by those files)
 *   - packages/shared staged src: vitest related --run (same)
 *
 * typecheck + full test suite runs in pre-push (whole-project operations).
 */

const root = fileURLToPath(new URL('.', import.meta.url))
const apiRoot = resolve(root, 'apps/api')
const sharedRoot = resolve(root, 'packages/shared')

/** @param {string} absolutePath @param {string} base */
const rel = (absolutePath, base) =>
  relative(base, absolutePath).replaceAll('\\', '/')

export default {
  '**/*.{ts,tsx}': ['oxlint --fix', 'oxfmt'],

  'apps/api/src/**/*.{ts,tsx}': (/** @type {string[]} */ files) => {
    const relFiles = files.map((f) => rel(f, apiRoot)).join(' ')
    return `pnpm --filter @hookmate/api exec vitest related --run ${relFiles}`
  },

  'packages/shared/src/**/*.{ts,tsx}': (/** @type {string[]} */ files) => {
    const relFiles = files.map((f) => rel(f, sharedRoot)).join(' ')
    return `pnpm --filter @hookmate/shared exec vitest related --run ${relFiles}`
  },
}
