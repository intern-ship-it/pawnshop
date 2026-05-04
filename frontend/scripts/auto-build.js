/**
 * Auto-detect the current Git branch and run the appropriate Vite build.
 *
 * Branch → Mode → Env File
 * ─────────────────────────────────
 * dev    → staging    → .env.staging      (devtesting.dsaraassetventures.com)
 * live   → production → .env.production   (dsaraassetventures.com)
 * *      → staging    → .env.staging      (default: staging for safety)
 */

import { execSync } from 'child_process';

// 1. Detect the current git branch
let branch;
try {
  branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
} catch {
  console.error('⚠️  Could not detect git branch. Defaulting to staging mode.');
  branch = 'dev';
}

// 2. Map branch → Vite mode
const modeMap = {
  live: 'production',
  main: 'production',
  dev:  'staging',
};

const mode = modeMap[branch] || 'staging';

console.log(`\n🔍 Detected branch: ${branch}`);
console.log(`🏗️  Building with mode: ${mode}`);
console.log(`📄 Using env file: .env.${mode}\n`);

// 3. Run the build
try {
  execSync(`npx vite build --mode ${mode}`, { stdio: 'inherit' });
} catch (err) {
  process.exit(1);
}
