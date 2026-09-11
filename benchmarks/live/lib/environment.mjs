import { execSync } from 'node:child_process';

/**
 * Safely execute a shell command and return trimmed stdout, or fallback.
 */
function runCmd(cmd, fallback = 'unknown') {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (_) {
    return fallback;
  }
}

/**
 * Capture host environment fingerprint according to QCET Live Benchmark Plan.
 * Never invents model identifiers; uses explicit env var, argument, or marks as unknown.
 */
export async function captureEnvironment(options = {}) {
  const isDarwin = process.platform === 'darwin';

  const osVersion = isDarwin
    ? runCmd('sw_vers -productVersion', process.version)
    : runCmd('uname -r', process.version);

  const osBuild = isDarwin
    ? runCmd('sw_vers -buildVersion', '')
    : '';

  const arch = runCmd('uname -m', process.arch);
  const cpuCount = isDarwin
    ? parseInt(runCmd('sysctl -n hw.ncpu', String(process.env.NUMBER_OF_PROCESSORS || '8')), 10)
    : parseInt(runCmd('nproc', '8'), 10);

  const nodeVersion = process.version;
  const npmVersion = runCmd('npm --version', 'unknown');
  const gitSha = runCmd('git rev-parse HEAD', 'unknown');
  const gitBranch = runCmd('git branch --show-current', 'unknown');
  const claudeCodeVersion = runCmd('claude --version', 'unknown');

  const model = process.env.QCET_BENCHMARK_MODEL || options.model || (options.dryRun ? 'dry-run' : 'unknown');

  return {
    timestamp: new Date().toISOString(),
    platform: process.platform,
    arch,
    osVersion,
    osBuild,
    cpuCount,
    nodeVersion,
    npmVersion,
    gitSha,
    gitBranch,
    claudeCodeVersion,
    model,
    effort: options.effort || 'ultracode'
  };
}
