/**
 * QCET Canonical Path and Glob Matching Module
 * Upholds Universal Invariant 1: One Capability, One Canonical Implementation.
 * Fixes E07: Eliminates suffix matching vulnerability; guarantees boundary isolation.
 * Shared between hooks, workflow executors, and verification test suites.
 */

const path = require('path');

function normalizePath(p, explicitCwd) {
  if (typeof p !== 'string') return '';
  let normalized = p.trim().replace(/\\/g, '/');
  normalized = normalized.replace(/^\.\//, '');
  normalized = normalized.replace(/\/+/g, '/');
  normalized = normalized.replace(/\/(\.\/)+/g, '/');
  if (normalized === '.' || normalized === './') {
    return '';
  }

  // Detect and strip worktree prefixes: .claude/worktrees/<name>/
  const wtMatch = normalized.match(/(?:^|\/)\.claude\/worktrees\/[^/]+\/(.*)$/);
  if (wtMatch && wtMatch[1]) {
    normalized = wtMatch[1];
  }

  // Strip process.cwd() prefix if running in Node environment
  const cwd = (explicitCwd || (typeof process !== 'undefined' && typeof process.cwd === 'function' ? process.cwd() : '')).replace(/\\/g, '/');
  if (cwd && normalized.startsWith(cwd + '/')) {
    normalized = normalized.slice(cwd.length + 1);
  }

  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

function stripWildcards(p) {
  if (!p) return '';
  return p.replace(/(?:\/)?\*\*?$/, '');
}

function globToRegex(glob) {
  let regex = '^';
  let i = 0;
  while (i < glob.length) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        if (glob[i + 2] === '/') {
          regex += '(?:.*/)?';
          i += 3;
          continue;
        } else {
          regex += '.*';
          i += 2;
          continue;
        }
      } else {
        regex += '[^/]*';
        i += 1;
        continue;
      }
    } else if (c === '?') {
      regex += '[^/]';
      i += 1;
      continue;
    } else if (['.', '+', '^', '$', '{', '}', '(', ')', '[', ']', '|', '\\'].includes(c)) {
      regex += '\\' + c;
      i += 1;
    } else {
      regex += c;
      i += 1;
    }
  }
  regex += '$';
  return new RegExp(regex);
}

function isExternalAbsolutePath(filePath, explicitCwd) {
  if (!filePath || typeof filePath !== 'string') return false;
  const normalized = filePath.trim().replace(/\\/g, '/');
  if (!normalized.startsWith('/')) return false;

  const cwd = (explicitCwd || (typeof process !== 'undefined' && typeof process.cwd === 'function' ? process.cwd() : '')).replace(/\\/g, '/');
  if (cwd && (normalized === cwd || normalized.startsWith(cwd + '/'))) {
    return false;
  }
  // Check if it's inside any worktree
  if (/\/\.claude\/worktrees\/[^/]+\//.test(normalized)) {
    return false;
  }
  return true;
}

function matchesOwnership(filePath, pattern, explicitCwd) {
  if (!filePath || !pattern) return false;

  const cwd = (explicitCwd || (typeof process !== 'undefined' && typeof process.cwd === 'function' ? process.cwd() : '')).replace(/\\/g, '/');

  // E07 Invariant: If pattern is repo-relative, external absolute paths must NEVER match
  const rawPattern = String(pattern).trim().replace(/\\/g, '/');
  if (!rawPattern.startsWith('/') && isExternalAbsolutePath(filePath, cwd)) {
    return false;
  }

  const normFile = normalizePath(filePath, cwd);
  const normPattern = normalizePath(pattern, cwd);
  if (!normFile || !normPattern) return false;

  // Exact path match
  if (normFile === normPattern) return true;

  // If pattern is still absolute and file is relative or vice-versa, do not cross-match
  if (normFile.startsWith('/') !== normPattern.startsWith('/')) {
    return false;
  }

  // Directory prefix match: if pattern has no wildcard, match exact directory descendants
  if (!normPattern.includes('*') && !normPattern.includes('?')) {
    if (normFile.startsWith(normPattern + '/')) return true;
  }

  // Double-star folder suffix: e.g. "dir/**"
  if (normPattern.endsWith('/**')) {
    const dir = normPattern.slice(0, -3);
    if (normFile === dir || normFile.startsWith(dir + '/')) return true;
  }

  // Single star suffix: e.g. "dir/*" (matches direct children, not deep children)
  if (normPattern.endsWith('/*') && !normPattern.endsWith('/**/*')) {
    const dir = normPattern.slice(0, -2);
    if (normFile.startsWith(dir + '/')) {
      const rest = normFile.slice(dir.length + 1);
      if (!rest.includes('/')) return true;
    }
  }

  // General glob match
  if (normPattern.includes('*') || normPattern.includes('?')) {
    try {
      const regex = globToRegex(normPattern);
      if (regex.test(normFile)) return true;
    } catch (_) {}
  }

  return false;
}

function pathsOverlap(pathA, pathB, explicitCwd) {
  const cwd = explicitCwd || '';
  const normA = normalizePath(pathA, cwd);
  const normB = normalizePath(pathB, cwd);
  if (!normA || !normB) return false;

  // Exact duplicate mutable ownership
  if (normA === normB) return true;

  // If one is absolute and one relative, they do not overlap
  if (normA.startsWith('/') !== normB.startsWith('/')) {
    return false;
  }

  // Wildcard glob containment
  if (matchesOwnership(normA, normB, cwd) || matchesOwnership(normB, normA, cwd)) {
    return true;
  }

  const cleanA = stripWildcards(normA);
  const cleanB = stripWildcards(normB);

  if (cleanA && cleanB && cleanA === cleanB) return true;

  // Strict delimiter-aware directory prefix / ancestor overlap
  if (cleanA && cleanB.startsWith(cleanA + '/')) return true;
  if (cleanB && cleanA.startsWith(cleanB + '/')) return true;

  // Symmetrical directory prefix overlap when wildcards are present in both
  if (normA.includes('*') && normB.includes('*')) {
    const baseA = normA.slice(0, normA.indexOf('*')).replace(/\/+$/, '');
    const baseB = normB.slice(0, normB.indexOf('*')).replace(/\/+$/, '');
    if (baseA && baseB && (baseA === baseB || baseA.startsWith(baseB + '/') || baseB.startsWith(baseA + '/'))) {
      const extA = normA.includes('.') ? normA.split('.').pop() : '';
      const extB = normB.includes('.') ? normB.split('.').pop() : '';
      if (!extA || !extB || extA === extB || extA.includes('*') || extB.includes('*')) {
        return true;
      }
    }
  }

  return false;
}

function toRepoRelativePath(targetPath, explicitCwd) {
  if (!targetPath || typeof targetPath !== 'string') return '';
  const cwd = explicitCwd || (typeof process !== 'undefined' && typeof process.cwd === 'function' ? process.cwd() : '');
  const rawTarget = targetPath.trim();

  // If already relative, normalize and return
  if (!rawTarget.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(rawTarget)) {
    return normalizePath(rawTarget, cwd);
  }

  const absolutePath = path.resolve(cwd, rawTarget);

  // Check if inside a worktree directory: .claude/worktrees/<name>/
  const wtMatch = absolutePath.match(/[/\\]\.claude[/\\]worktrees[/\\][^/\\]+[/\\](.*)$/);
  if (wtMatch && wtMatch[1]) {
    return normalizePath(wtMatch[1], cwd);
  }

  if (cwd && absolutePath === cwd) return '';
  if (cwd && absolutePath.startsWith(cwd + path.sep)) {
    const rel = path.relative(cwd, absolutePath);
    return normalizePath(rel, cwd);
  }

  // Path is outside repository and outside worktree
  return absolutePath.replace(/\\/g, '/');
}

module.exports = {
  normalizePath,
  stripWildcards,
  globToRegex,
  matchesOwnership,
  pathsOverlap,
  toRepoRelativePath,
  isExternalAbsolutePath,
};
