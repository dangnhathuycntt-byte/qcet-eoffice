import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

describe('JIT Context and External Research Hardening (REQ-07, REQ-08, REQ-09)', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const executorPath = path.join(repoRoot, '.claude/workflows/qcet-plan-executor.js');
  let helpers: any;
  let fullWorkflowCode: string;

  before(async () => {
    fullWorkflowCode = fs.readFileSync(executorPath, 'utf8');
    const helperCode = fullWorkflowCode.split(
      '// -----------------------------------------------------------------------------\n// WORKFLOW'
    )[0];
    const tempFile = path.join('/tmp', `qcet-executor-jit-helpers-${Date.now()}.mjs`);
    fs.writeFileSync(tempFile, helperCode, 'utf8');
    try {
      helpers = await import(tempFile);
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  });

  it('Syntax check: node --check passes cleanly on qcet-plan-executor.js', () => {
    const result = execFileSync('node', ['--check', executorPath], {
      encoding: 'utf8',
    });
    assert.equal(result, '');
  });

  describe('REQ-07: buildShardPacket self-contained packet & requirement fidelity', () => {
    it('generates complete self-contained packet with all required fields', () => {
      const shard = {
        id: 'shard-auth-hardening',
        objective: 'Implement short-ttl auth context cache',
        kind: 'feature',
        owns: ['src/server/auth/**', 'src/lib/cache.ts'],
        antiOwns: ['src/server/routes/**'],
        dependencies: ['shard-db-core'],
        requirements: ['REQ-01', 'REQ-02'],
        acceptanceCriteria: ['AuthContext cache TTL is 30s', 'Invalidated on role mutation'],
        risk: 'high',
        testHints: ['npm test tests/auth-cache.test.ts'],
        planAnchors: ['Section 4.2 Auth Caching'],
      };

      const manifest = {
        requirements: [
          { id: 'REQ-01', description: 'Establish safe short-ttl cache for AuthorizationContext' },
          { id: 'REQ-02', description: 'Implement active cache invalidation triggers' },
        ],
        shards: [shard],
      };

      const packet = helpers.buildShardPacket(shard, manifest);

      assert.equal(packet.id, 'shard-auth-hardening');
      assert.equal(packet.objective, 'Implement short-ttl auth context cache');
      assert.equal(packet.kind, 'feature');
      assert.equal(packet.risk, 'high');
      assert.deepEqual(packet.owns, ['src/server/auth/**', 'src/lib/cache.ts']);
      assert.deepEqual(packet.antiOwns, ['src/server/routes/**']);
      assert.deepEqual(packet.dependencies, ['shard-db-core']);
      assert.deepEqual(packet.requirements, ['REQ-01', 'REQ-02']);
      assert.deepEqual(packet.acceptanceCriteria, ['AuthContext cache TTL is 30s', 'Invalidated on role mutation']);
      assert.deepEqual(packet.planAnchors, ['Section 4.2 Auth Caching']);
      assert.deepEqual(packet.testHints, ['npm test tests/auth-cache.test.ts']);

      assert.equal(packet.requirementDetails.length, 2);
      assert.equal(packet.requirementDetails[0].id, 'REQ-01');
      assert.equal(packet.requirementDetails[0].text, 'Establish safe short-ttl cache for AuthorizationContext');
      assert.equal(packet.requirementDetails[1].id, 'REQ-02');
      assert.equal(packet.requirementDetails[1].text, 'Implement active cache invalidation triggers');
    });

    it('preserves existing requirementDetails when valid text is present', () => {
      const shard = {
        id: 'shard-ui',
        objective: 'Consolidate dashboard UI',
        requirements: ['REQ-10'],
        requirementDetails: [
          { id: 'REQ-10', text: 'Custom explicit text specified by synthesizer' },
        ],
      };
      const manifest = {
        requirements: [{ id: 'REQ-10', description: 'Manifest description' }],
        shards: [shard],
      };

      const packet = helpers.buildShardPacket(shard, manifest);
      assert.equal(packet.requirementDetails.length, 1);
      assert.equal(packet.requirementDetails[0].id, 'REQ-10');
      assert.equal(packet.requirementDetails[0].text, 'Custom explicit text specified by synthesizer');
    });

    it('backfills requirement text when an item in requirementDetails has empty or whitespace text', () => {
      const shard = {
        id: 'shard-ui',
        objective: 'Consolidate dashboard UI',
        requirements: ['REQ-11', 'REQ-12'],
        requirementDetails: [
          { id: 'REQ-11', text: '   ' },
          { id: 'REQ-12', text: '' },
        ],
      };
      const manifest = {
        requirements: [
          { id: 'REQ-11', description: 'Consolidate executive overview metrics' },
          { id: 'REQ-12', description: 'Standardize action drawer typography' },
        ],
        shards: [shard],
      };

      const packet = helpers.buildShardPacket(shard, manifest);
      assert.equal(packet.requirementDetails.length, 2);
      assert.equal(packet.requirementDetails[0].id, 'REQ-11');
      assert.equal(packet.requirementDetails[0].text, 'Consolidate executive overview metrics');
      assert.equal(packet.requirementDetails[1].id, 'REQ-12');
      assert.equal(packet.requirementDetails[1].text, 'Standardize action drawer typography');
    });

    it('backfills requirements when requirementDetails is omitted or empty', () => {
      const shard = {
        id: 'shard-api',
        objective: 'Implement API routes',
        requirements: ['REQ-20', 'REQ-21'],
      };
      const manifest = {
        requirements: [
          'REQ-20: Harden REST endpoints against CSRF',
          { id: 'REQ-21', text: 'Validate HMAC signatures on webhooks' },
        ],
        shards: [shard],
      };

      const packet = helpers.buildShardPacket(shard, manifest);
      assert.equal(packet.requirementDetails.length, 2);
      assert.equal(packet.requirementDetails[0].id, 'REQ-20');
      assert.equal(packet.requirementDetails[0].text, 'Harden REST endpoints against CSRF');
      assert.equal(packet.requirementDetails[1].id, 'REQ-21');
      assert.equal(packet.requirementDetails[1].text, 'Validate HMAC signatures on webhooks');
    });

    it('appends missing requirements from shard.requirements to partial requirementDetails', () => {
      const shard = {
        id: 'shard-mixed',
        objective: 'Mixed coverage',
        requirements: ['REQ-30', 'REQ-31'],
        requirementDetails: [
          { id: 'REQ-30', text: 'Existing detail for 30' },
        ],
      };
      const manifest = {
        requirements: [
          { id: 'REQ-30', description: 'Description 30' },
          { id: 'REQ-31', description: 'Description 31' },
        ],
      };

      const packet = helpers.buildShardPacket(shard, manifest);
      assert.equal(packet.requirementDetails.length, 2);
      assert.equal(packet.requirementDetails[0].id, 'REQ-30');
      assert.equal(packet.requirementDetails[0].text, 'Existing detail for 30');
      assert.equal(packet.requirementDetails[1].id, 'REQ-31');
      assert.equal(packet.requirementDetails[1].text, 'Description 31');
    });

    it('handles null/undefined manifest gracefully with fallback text', () => {
      const shard = {
        id: 'shard-orphan',
        requirements: ['REQ-99'],
        requirementDetails: [{ id: 'REQ-99', text: '' }],
      };

      const packet = helpers.buildShardPacket(shard, null);
      assert.equal(packet.requirementDetails.length, 1);
      assert.equal(packet.requirementDetails[0].id, 'REQ-99');
      assert.equal(packet.requirementDetails[0].text, 'Requirement REQ-99');
    });
  });

  describe('REQ-07: Prompt token reduction with JIT Shard Packet', () => {
    it('achieves >90% payload size reduction compared to monolithic master plan text', () => {
      // Use an active monolithic implementation plan from docs/plans/active/
      const planCandidate = path.join(
        repoRoot,
        'docs/plans/active/2026-09-10-sdd-sprint-4-to-10-master-cutover.md'
      );
      const monolithicPlanContent = fs.existsSync(planCandidate)
        ? fs.readFileSync(planCandidate, 'utf8')
        : fs.readFileSync(path.join(repoRoot, 'docs/plans/active/2026-09-09-master-ux-consolidation-plan.md'), 'utf8');

      const shard = {
        id: 'shard-auth-hardening',
        objective: 'Implement short-ttl auth context cache',
        kind: 'feature',
        owns: ['src/server/auth/**', 'src/lib/cache.ts'],
        antiOwns: ['src/server/routes/**'],
        dependencies: ['shard-db-core'],
        requirements: ['REQ-01', 'REQ-02'],
        acceptanceCriteria: ['AuthContext cache TTL is 30s', 'Invalidated on role mutation'],
        risk: 'high',
        testHints: ['npm test tests/auth-cache.test.ts'],
        planAnchors: ['Section 4.2 Auth Caching'],
        requirementDetails: [
          { id: 'REQ-01', text: 'Establish safe short-ttl cache for AuthorizationContext' },
          { id: 'REQ-02', text: 'Implement active cache invalidation triggers' },
        ],
      };

      const packet = helpers.buildShardPacket(shard, null);
      const packetPayload = JSON.stringify(packet, null, 2);

      const planLength = monolithicPlanContent.length;
      const packetLength = packetPayload.length;
      const reductionPct = ((planLength - packetLength) / planLength) * 100;

      assert.ok(
        reductionPct > 90.0,
        `Expected >90% reduction, but got ${reductionPct.toFixed(2)}% (Plan: ${planLength} chars, Packet: ${packetLength} chars)`
      );
    });
  });

  describe('REQ-08: RECON_SCHEMA and external research escalation contracts', () => {
    it('RECON_SCHEMA enforces required status, evidence fields, and externalResearch structure', () => {
      const schema = helpers.RECON_SCHEMA;
      assert.ok(schema, 'RECON_SCHEMA must be exported');
      assert.ok(schema.required.includes('status'));
      assert.ok(schema.required.includes('currentState'));
      assert.ok(schema.required.includes('relevantFiles'));
      assert.ok(schema.required.includes('contracts'));
      assert.ok(schema.required.includes('implementationNotes'));
      assert.ok(schema.required.includes('risks'));
      assert.ok(schema.properties.externalResearch, 'externalResearch must be a property in RECON_SCHEMA');
      assert.deepEqual(schema.properties.externalResearch.required, ['needed']);
      assert.equal(schema.properties.externalResearch.properties.needed.type, 'boolean');
      assert.equal(schema.properties.externalResearch.properties.questions.type, 'array');
    });

    it('RESEARCH_SCHEMA enforces structured claims and unresolved arrays', () => {
      const schema = helpers.RESEARCH_SCHEMA;
      assert.ok(schema, 'RESEARCH_SCHEMA must be exported');
      assert.deepEqual(schema.required, ['claims', 'unresolved']);
      const claimProps = schema.properties.claims.items.properties;
      assert.ok(claimProps.claim);
      assert.ok(claimProps.sourceType);
      assert.ok(claimProps.source);
      assert.ok(claimProps.versionOrDate);
      assert.ok(claimProps.applicability);
      assert.ok(claimProps.confidence);
      assert.ok(claimProps.sourceType.enum.includes('unverified'));
      assert.ok(claimProps.confidence.enum.includes('unverified'));
    });

    it('validateResearchEscalation returns allowed: false when research is not needed or empty', () => {
      const res1 = helpers.validateResearchEscalation(null, {});
      assert.equal(res1.allowed, false);

      const res2 = helpers.validateResearchEscalation({ needed: false }, {});
      assert.equal(res2.allowed, false);

      const res3 = helpers.validateResearchEscalation({ needed: true, questions: [] }, {});
      assert.equal(res3.allowed, false);
      assert.ok(res3.reason.includes('No research questions'));
    });

    it('validateResearchEscalation permits external framework and standards questions (including Next.js and Node.js)', () => {
      const questions = [
        'What is the App Router streaming behavior in Next.js 15?',
        'How does Node.js 20 crypto.subtle handle RSA-PSS signing?',
        'What are the React 19 Server Actions boundary constraints?',
        'What is the RFC 7519 standard for JWT exp validation?',
        'What are W3C WCAG 2.1 AA color contrast minimum requirements?',
        'What is the official Vue.js 3 defineAsyncComponent suspense contract?',
        'How does Nuxt.js 3 defineEventHandler handle error wrapping?',
        'What is the Express.js error handling middleware signature?',
      ];

      const shardPacket = {
        owns: ['src/server/auth/**'],
        antiOwns: ['src/server/routes/**'],
      };

      const result = helpers.validateResearchEscalation(
        {
          needed: true,
          reason: 'Need upstream specification and framework contracts',
          questions,
          preferredSourceTypes: ['official-doc', 'standards-body'],
        },
        shardPacket
      );

      assert.equal(result.allowed, true);
      assert.equal(result.questions.length, questions.length);
      assert.equal(result.rejectedQuestions.length, 0);
      assert.deepEqual(result.questions, questions);
    });

    it('validateResearchEscalation strictly rejects internal codebase queries', () => {
      const internalQueries = [
        'What does src/lib/auth.ts do?',
        'Inspect app/dashboard/page.tsx',
        'What models exist in prisma/schema.prisma?',
        'Find callers of getAuthorizationContext in repository',
        'How does the local QCET session state machine work?',
        'What does components/ActionDrawer.tsx render?',
        'Check tests/auth.test.ts for existing coverage',
        'What scripts are in package.json?',
      ];

      const shardPacket = {
        owns: ['src/server/auth/**'],
        antiOwns: [],
      };

      for (const q of internalQueries) {
        const result = helpers.validateResearchEscalation(
          {
            needed: true,
            reason: 'Investigate code',
            questions: [q],
          },
          shardPacket
        );

        assert.equal(result.allowed, false, `Expected question to be rejected: ${q}`);
        assert.ok(result.rejectedQuestions.includes(q));
      }
    });

    it('validateResearchEscalation filters mixed queries and approves valid subset', () => {
      const questions = [
        'What is the official RFC 7636 PKCE spec for OAuth 2.0?',
        'What does src/lib/auth.ts export?',
        'How does Next.js 15 handle parallel routes interception?',
        'What fields are in prisma/schema.prisma?',
      ];

      const shardPacket = {
        owns: ['src/lib/auth.ts'],
        antiOwns: [],
      };

      const result = helpers.validateResearchEscalation(
        {
          needed: true,
          questions,
        },
        shardPacket
      );

      assert.equal(result.allowed, true);
      assert.deepEqual(result.questions, [
        'What is the official RFC 7636 PKCE spec for OAuth 2.0?',
        'How does Next.js 15 handle parallel routes interception?',
      ]);
      assert.deepEqual(result.rejectedQuestions, [
        'What does src/lib/auth.ts export?',
        'What fields are in prisma/schema.prisma?',
      ]);
    });
  });

  describe('REQ-08: Prompt-cache cohorts & standardized prefixes', () => {
    it('exports all standardized cohort prompt prefixes', () => {
      assert.ok(typeof helpers.RECON_STATIC_PREFIX === 'string' && helpers.RECON_STATIC_PREFIX.length > 50);
      assert.ok(typeof helpers.BUILDER_STATIC_PREFIX === 'string' && helpers.BUILDER_STATIC_PREFIX.length > 50);
      assert.ok(typeof helpers.REPAIR_STATIC_PREFIX === 'string' && helpers.REPAIR_STATIC_PREFIX.length > 50);
      assert.ok(typeof helpers.SKEPTIC_STATIC_PREFIX === 'string' && helpers.SKEPTIC_STATIC_PREFIX.length > 50);
      assert.ok(typeof helpers.RESEARCHER_STATIC_PREFIX === 'string' && helpers.RESEARCHER_STATIC_PREFIX.length > 50);
      assert.ok(typeof helpers.RECONCILE_STATIC_PREFIX === 'string' && helpers.RECONCILE_STATIC_PREFIX.length > 50);
    });

    it('ensures arbiter prompt in verifyShard prepends SKEPTIC_STATIC_PREFIX for prompt cache consistency', () => {
      // Find arbiterPrompt in full workflow code
      const arbiterPromptMatch = fullWorkflowCode.match(/const arbiterPrompt = `([\s\S]*?)`;/);
      assert.ok(arbiterPromptMatch, 'arbiterPrompt declaration must exist in workflow');
      const arbiterBody = arbiterPromptMatch[1];
      assert.ok(
        arbiterBody.startsWith('${SKEPTIC_STATIC_PREFIX}'),
        'arbiterPrompt must start with ${SKEPTIC_STATIC_PREFIX} to align with the skeptic cohort prompt cache'
      );
    });

    it('ensures all skeptic agent calls use uniform model, agentType, and schema configuration', () => {
      // Find all skeptic calls in verifyShard
      const skepticCalls = [
        ...fullWorkflowCode.matchAll(/agent:\s*'qcet-skeptic'[\s\S]*?agentType:\s*'qcet-skeptic'[\s\S]*?schema:\s*VERIFY_SCHEMA/g),
      ];
      // There should be 5 skeptic configurations in verifyShard: Spec, Security, Arbiter, Medium, Low
      assert.ok(skepticCalls.length >= 5, `Expected at least 5 qcet-skeptic invocations, found ${skepticCalls.length}`);
    });
  });

  describe('REQ-09: Risk-adaptive verification scaling across risk tiers', () => {
    it('workflow implements risk-adaptive skeptic dispatch: multi-skeptic panel for high/critical, 1 skeptic for medium/low', () => {
      // Check verifyShard structure in workflow code
      const hasHighCriticalBranch = fullWorkflowCode.includes("if (risk === 'high' || risk === 'critical')");
      const hasMediumBranch = fullWorkflowCode.includes("else if (risk === 'medium')");
      assert.ok(hasHighCriticalBranch, 'Workflow must branch on high/critical risk');
      assert.ok(hasMediumBranch, 'Workflow must branch on medium risk');

      // Verify high/critical runs parallel skeptics + arbiter
      const verifyShardSection = fullWorkflowCode.slice(
        fullWorkflowCode.indexOf('async function verifyShard'),
        fullWorkflowCode.indexOf('async function repairShard')
      );

      assert.ok(
        verifyShardSection.includes('SKEPTIC 1 — SPECIFICATION'),
        'High/critical branch must dispatch Skeptic 1 for specification'
      );
      assert.ok(
        verifyShardSection.includes('SKEPTIC 2 — SECURITY'),
        'High/critical branch must dispatch Skeptic 2 for security'
      );
      assert.ok(
        verifyShardSection.includes('QCET ADVERSARIAL VERIFICATION ARBITER'),
        'High/critical branch must invoke arbiter to synthesize panel verdicts'
      );
      assert.ok(
        verifyShardSection.includes('VERIFICATION FOCUS: MEDIUM RISK TIER'),
        'Medium risk branch must dispatch strong single skeptic'
      );
      assert.ok(
        verifyShardSection.includes('VERIFICATION FOCUS: LOW RISK TIER'),
        'Low risk branch must dispatch targeted single skeptic'
      );
    });
  });
});
