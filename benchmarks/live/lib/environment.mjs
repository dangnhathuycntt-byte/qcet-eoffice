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

  const model = options.model || process.env.QCET_BENCHMARK_MODEL || (options.dryRun ? 'dry-run' : 'unknown');
  const workloadBaseSha = options.workloadBaseSha || '3f0e5320b67acf5fd814c6a0c49e3b9ff9e09a1c';
  const executorBSha = options.harnessShaB || '3f5e804c5bf55c88634535971d605f40b1b8713d';
  const executorCSha = options.harnessShaC || '02d090e8e8e23c9c7def9826b99c815af74ecf42';
  const evalHarnessSha = options.evalHarnessSha || gitSha;

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
    claudeVersion: claudeCodeVersion,
    claudeCodeVersion,
    model,
    effort: options.effort || 'high',
    workloadBaseSha,
    workloadBaseTag: 'benchmark/workload-base-3f0e5320',
    executorBSha,
    executorCSha,
    evalHarnessSha
  };
}
