/**
 * Re-export canonical path matcher to uphold:
 * Universal Invariant 1: One Capability, One Canonical Implementation.
 * Canonical Source: scripts/lib/canonical-path-matcher.cjs
 */
const path = require('path');
module.exports = require(path.resolve(__dirname, '../../scripts/lib/canonical-path-matcher.cjs'));
