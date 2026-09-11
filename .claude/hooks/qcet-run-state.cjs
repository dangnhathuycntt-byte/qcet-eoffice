/**
 * QCET Run State and Durable Ledger Primitives
 *
 * Provides atomic, append-only, and bounded file/event operations scoped
 * to .claude/executor-runs/<sanitizedRunId>.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function sanitizeRunId(value) {
  if (typeof value !== 'string') {
    throw new Error('Invalid run ID: must be a string');
  }
  // Replace path separators and traversal indicators
  let clean = value.replace(/[/\\?%*:|"<>]/g, '-');
  // Remove consecutive dots or dot sequences that could traverse
  clean = clean.replace(/\.{2,}/g, '-');
  // Remove any remaining invalid characters (only keep alphanumeric, dash, underscore)
  clean = clean.replace(/[^a-zA-Z0-9_-]/g, '-');
  // Collapse multiple dashes
  clean = clean.replace(/-+/g, '-').replace(/^-|-$/g, '');

  if (!clean) {
    throw new Error('Invalid run ID: empty or resolves to empty string after sanitization');
  }
  return clean;
}

function getRunDir(projectDir, runId) {
  const safeRunId = sanitizeRunId(runId);
  const baseDir = path.resolve(projectDir, '.claude', 'executor-runs');
  const targetDir = path.resolve(baseDir, safeRunId);
  if (!targetDir.startsWith(baseDir + path.sep)) {
    throw new Error(`Path traversal violation: run dir ${targetDir} escaped ${baseDir}`);
  }
  return targetDir;
}

function atomicWriteJson(filePath, value) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${filePath}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  const content = JSON.stringify(value, null, 2) + '\n';
  fs.writeFileSync(tmpPath, content, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function readJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function appendEvent(runDir, event) {
  fs.mkdirSync(runDir, { recursive: true });
  const eventsFile = path.join(runDir, 'events.jsonl');

  let nextSeq = 1;
  if (fs.existsSync(eventsFile)) {
    try {
      const content = fs.readFileSync(eventsFile, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      if (lines.length > 0) {
        const last = JSON.parse(lines[lines.length - 1]);
        if (typeof last.seq === 'number') {
          nextSeq = last.seq + 1;
        } else {
          nextSeq = lines.length + 1;
        }
      }
    } catch (_) {
      // fallback
    }
  }

  // Bounded record: do not store unbounded prompt, stdout, secrets
  const sanitizedEvent = {
    seq: nextSeq,
    timestamp: new Date().toISOString(),
    type: event.type || 'unknown',
    ...event,
  };
  sanitizedEvent.seq = nextSeq;

  // Sanitize bounded fields
  if (typeof sanitizedEvent.stdout === 'string' && sanitizedEvent.stdout.length > 1000) {
    sanitizedEvent.stdout = sanitizedEvent.stdout.slice(0, 1000) + '...[truncated]';
  }
  if (typeof sanitizedEvent.stderr === 'string' && sanitizedEvent.stderr.length > 1000) {
    sanitizedEvent.stderr = sanitizedEvent.stderr.slice(0, 1000) + '...[truncated]';
  }
  if (typeof sanitizedEvent.prompt === 'string') {
    sanitizedEvent.prompt = '[omitted]';
  }
  if (typeof sanitizedEvent.content === 'string') {
    sanitizedEvent.content = '[omitted]';
  }

  const line = JSON.stringify(sanitizedEvent) + '\n';
  fs.appendFileSync(eventsFile, line, 'utf8');
  return sanitizedEvent;
}

function writeWitness(runDir, relativePath, value) {
  const targetPath = path.resolve(runDir, relativePath);
  if (!targetPath.startsWith(runDir)) {
    throw new Error(`Witness path traversal violation: ${targetPath} escaped ${runDir}`);
  }
  atomicWriteJson(targetPath, value);
  return targetPath;
}

function claimFile(runDir, shardId, relativeFile) {
  const normalized = relativeFile.replace(/\\/g, '/').replace(/^\.?\//, '');
  const claimsDir = path.join(runDir, 'claims');
  fs.mkdirSync(claimsDir, { recursive: true });

  const hash = crypto.createHash('sha256').update(normalized).digest('hex');
  const claimFilePath = path.join(claimsDir, `${hash}.json`);
  const claimData = {
    shardId,
    file: normalized,
    claimedAt: new Date().toISOString(),
  };

  try {
    fs.writeFileSync(claimFilePath, JSON.stringify(claimData, null, 2), { flag: 'wx' });
    return {
      success: true,
      shardId,
      file: normalized,
      alreadyClaimed: false,
    };
  } catch (err) {
    if (err && err.code === 'EEXIST') {
      const existing = readJson(claimFilePath);
      if (existing && existing.shardId === shardId) {
        return {
          success: true,
          shardId,
          file: normalized,
          alreadyClaimed: true,
        };
      }
      return {
        success: false,
        shardId,
        ownerShardId: existing ? existing.shardId : 'unknown',
        file: normalized,
        error: 'ALREADY_CLAIMED',
      };
    }
    throw err;
  }
}

module.exports = {
  sanitizeRunId,
  getRunDir,
  atomicWriteJson,
  readJson,
  appendEvent,
  writeWitness,
  claimFile,
};
