/**
 * QCET Canonical Path and Glob Matching Module
 * Upholds Universal Invariant 1: One Capability, One Canonical Implementation.
 * Shared between qcet-plan-executor.js, pre-tool-use-ownership-guard, and test suites.
 */

const path = require('path');

function normalizePath(p) {
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
  if (typeof process !== 'undefined' && typeof process.cwd === 'function') {
    try {
      const cwd = process.cwd().replace(/\\/g, '/');
      if (normalized.startsWith(cwd + '/')) {
        normalized = normalized.slice(cwd.length + 1);
      }
    } catch (_) {}
  }

  if (normalized.startsWith('/')) {
    // Look for top-level repo markers to strip absolute repo paths
    const topLevelMarkers = [
      'src/',
      'app/',
      'components/',
      'lib/',
      'server/',
      'tests/',
      'prisma/',
      'docs/',
      'public/',
      'scripts/',
      'storage/',
      'uploads/',
      'iis/',
      'backups/',
      'qcet-backend-api/',
      '.claude/',
      'package.json',
      'tsconfig.json',
      'ARCHITECTURE.md',
      'CLAUDE.md',
      'AGENTS.md',
      'DESIGN.md',
      'README.md',
      'next.config.ts',
    ];
    for (const marker of topLevelMarkers) {
      const idx = normalized.indexOf('/' + marker);
      if (idx !== -1) {
        normalized = normalized.slice(idx + 1);
        break;
      }
    }
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

function matchesOwnership(filePath, pattern) {
  const normFile = normalizePath(filePath);
  const normPattern = normalizePath(pattern);
  if (!normFile || !normPattern) return false;

  if (normFile === normPattern) return true;

  // Suffix matching when file remains absolute and pattern is repo-relative
  if (!normPattern.startsWith('/') && normFile.startsWith('/')) {
    if (normFile.endsWith('/' + normPattern)) return true;
    const cleanPattern = stripWildcards(normPattern);
    if (cleanPattern && !normPattern.includes('*') && !normPattern.includes('?') && normFile.endsWith('/' + cleanPattern)) {
      return true;
    }
  }

  // Directory prefix match: if pattern has no wildcard, match directory children
  if (!normPattern.includes('*') && !normPattern.includes('?')) {
    if (normFile.startsWith(normPattern + '/')) return true;
  }

  // Double-star folder suffix: e.g. "dir/**"
  if (normPattern.endsWith('/**')) {
    const dir = normPattern.slice(0, -3);
    if (normFile === dir || normFile.startsWith(dir + '/')) return true;
  }

  // General glob match (single * does not cross directory delimiters)
  if (normPattern.includes('*') || normPattern.includes('?')) {
    try {
      const regex = globToRegex(normPattern);
      if (regex.test(normFile)) return true;
    } catch (_) {}
  }

  return false;
}

function pathsOverlap(pathA, pathB) {
  const normA = normalizePath(pathA);
  const normB = normalizePath(pathB);
  if (!normA || !normB) return false;

  // Exact duplicate mutable ownership
  if (normA === normB) return true;

  // Symmetric wildcard glob matching
  if (matchesOwnership(normA, normB) || matchesOwnership(normB, normA)) {
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
  const cwd = explicitCwd || process.cwd();
  const absolutePath = path.resolve(cwd, targetPath.trim());

  // Check if inside a worktree directory: .claude/worktrees/<name>/
  const wtMatch = absolutePath.match(/[/\\]\.claude[/\\]worktrees[/\\][^/\\]+[/\\](.*)$/);
  if (wtMatch && wtMatch[1]) {
    return normalizePath(wtMatch[1]);
  }

  if (absolutePath === cwd) return '';
  if (absolutePath.startsWith(cwd + path.sep)) {
    const rel = path.relative(cwd, absolutePath);
    const relWtMatch = rel.match(/^\.claude[/\\]worktrees[/\\][^/\\]+[/\\](.*)$/);
    if (relWtMatch && relWtMatch[1]) {
      return normalizePath(relWtMatch[1]);
    }
    return normalizePath(rel);
  }
  return normalizePath(absolutePath);
}

module.exports = {
  normalizePath,
  stripWildcards,
  globToRegex,
  matchesOwnership,
  pathsOverlap,
  toRepoRelativePath,
};
