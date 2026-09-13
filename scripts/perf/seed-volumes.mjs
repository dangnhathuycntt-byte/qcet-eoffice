#!/usr/bin/env node
/**
 * S-PERF — T75 realistic data-volume seeder + volume query probe.
 *
 * Seeds 100 / 500 / 1000+ tasks, a large org/department fan-out, and large
 * notification/document sets into a DISPOSABLE database only, measures the
 * query-layer latency at each volume, then removes every row it created. The
 * shared operational DB (qcet_eoffice) is never a target: the script refuses
 * unless the resolved DB name ends with `_test`/`_perf` (mirrors
 * scripts/run-tests.mjs disposal rule).
 *
 * All generated values come from a deterministic PRNG (mulberry32) — no Math.random.
 *
 * Usage:
 *   node scripts/perf/seed-volumes.mjs                 # 100,500,1000 + probe
 *   node scripts/perf/seed-volumes.mjs --volumes=100   # single volume
 *   node scripts/perf/seed-volumes.mjs --orgs=120      # departments seeded per volume
 *   node scripts/perf/seed-volumes.mjs --api           # also spawn the API route probe
 *   node scripts/perf/seed-volumes.mjs --clean         # only remove leftovers
 *
 * Evidence written to artifacts/ux-v5-1/performance/volume-probe.json.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import { PrismaClient } from "@prisma/client";
import { makeRng, PERF_ARTIFACTS, REPO_ROOT, percentile } from "./lib/harness.mjs";

const { loadEnvConfig } = nextEnv;

const arg = (name, def) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const hasFlag = (name) => process.argv.includes(`--${name}`);

loadEnvConfig(REPO_ROOT);

const PREFIX = "PERFV";

// Force a DISPOSABLE database regardless of the dev .env value.
function resolveDbUrl() {
  const explicit = arg("db-url", "") || process.env.QCET_PERF_DATABASE_URL;
  if (explicit) return explicit;
  const raw = process.env.DATABASE_URL || "";
  return raw.replace(/\/qcet_eoffice(\?.*)?$/, "/qcet_test$1");
}

const DB_URL = resolveDbUrl();
const dbName = (() => {
  try { return new URL(DB_URL).pathname.replace(/^\//, ""); } catch { return ""; }
})();
if (!/^qcet_(test|perf)$/.test(dbName)) {
  console.error(`REFUSING to seed: resolved DB '${dbName}' is not a disposable *_test/_perf database.`);
  process.exit(2);
}
process.env.DATABASE_URL = DB_URL;

const prisma = new PrismaClient();

async function baseRefs() {
  const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!user) throw new Error("no user in test DB");
  const dept = await prisma.department.findFirst();
  return { user, dept };
}

// Realistic ORG fan-out (T75 "large org set"): seed `n` departments so the
// org/department surfaces are exercised at volume, not only tasks/notifications/
// documents (PERF-06). Ids/names are PRNG-derived, never Math.random.
async function seedDepartments(n, rng, stamp) {
  const data = [];
  for (let i = 0; i < n; i++) {
    data.push({
      id: `${PREFIX}-DEPT-${stamp}-${String(i).padStart(4, "0")}`,
      name: `Đơn vị kiểm thử ${stamp}-${i + 1}`,
      shortName: `KT${i + 1}`,
      color: `#${(0x100000 + Math.floor(rng() * 0xefffff)).toString(16).slice(0, 6)}`,
    });
  }
  await prisma.department.createMany({ data });
  return data.map((d) => d.id);
}

async function seedTasks(n, rng, { user, departmentIds }, stamp) {
  const statuses = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "OVERDUE"];
  const priorities = ["LOW", "NORMAL", "HIGH", "URGENT"];
  const scopes = ["SCHOOL", "DEPARTMENT", "INDIVIDUAL"];
  const data = [];
  for (let i = 0; i < n; i++) {
    data.push({
      code: `${PREFIX}-${stamp}-${String(i).padStart(5, "0")}`,
      title: `Nhiệm vụ hiệu năng ${i + 1} — kiểm thử tải dữ liệu T75`,
      scope: scopes[i % scopes.length],
      status: statuses[i % statuses.length],
      priority: priorities[i % priorities.length],
      progressPercent: (i * 7) % 101,
      academicMonth: 9,
      academicYear: "2026-2027",
      startDate: new Date(Date.now() - 86400000),
      dueDate: new Date(Date.now() + ((i % 90) + 2) * 86400000),
      departmentId: departmentIds.length ? departmentIds[i % departmentIds.length] : null,
      createdById: user.id,
    });
  }
  await prisma.task.createMany({ data });
  return data.length;
}

async function seedNotifications(n, rng, { user }, stamp) {
  const data = [];
  for (let i = 0; i < n; i++) {
    data.push({
      userId: user.id,
      actorName: "Hệ thống",
      title: `${PREFIX} thông báo tải ${stamp}-${i}`,
      body: `Thông báo kiểm thử khối lượng lớn #${i}`,
      category: "task",
      type: "TASK_ASSIGNED",
      linkHref: "/tasks",
      isRead: i % 3 === 0,
    });
  }
  await prisma.notification.createMany({ data });
  return data.length;
}

async function seedDocuments(n, rng, { user, dept }, stamp) {
  const max = await prisma.document.aggregate({ _max: { registrationNumber: true }, where: { documentYear: 2099 } });
  let reg = (max._max.registrationNumber || 0) + 1;
  const data = [];
  for (let i = 0; i < n; i++) {
    data.push({
      type: "VAN_BAN_DEN",
      registrationNumber: reg++,
      documentYear: 2099,
      originalNumber: `${PREFIX}-DOC-${stamp}-${i}`,
      issuedDate: new Date(),
      issuingAuthority: "Sở GD&ĐT",
      category: "Kế hoạch",
      summary: `Văn bản kiểm thử khối lượng lớn #${i}`,
      urgency: "THUONG",
      securityLevel: "THUONG",
      status: "CHO_PHAN_CONG",
      registeredById: user.id,
      draftingDeptId: dept ? dept.id : null,
    });
  }
  await prisma.document.createMany({ data });
  return data.length;
}

async function probeVolume(iterations = 30) {
  const time = async (fn) => {
    const t0 = process.hrtime.bigint();
    await fn();
    return Number(process.hrtime.bigint() - t0) / 1e6;
  };
  const samples = { count: [], list50: [], filtered: [], deptCount: [], orgTree: [] };
  for (let i = 0; i < iterations; i++) {
    samples.count.push(await time(() => prisma.task.count()));
    samples.list50.push(await time(() =>
      prisma.task.findMany({ take: 50, orderBy: [{ dueDate: "asc" }], where: { archivedAt: null } })
    ));
    samples.filtered.push(await time(() =>
      prisma.task.findMany({
        take: 50,
        where: { OR: [{ title: { contains: "hiệu năng", mode: "insensitive" } }, { status: "IN_PROGRESS" }] },
        orderBy: [{ dueDate: "asc" }],
      })
    ));
    // Org surface at volume: department count + org-tree fan-out with per-dept
    // user/task rollups (the /org page's aggregation shape).
    samples.deptCount.push(await time(() => prisma.department.count()));
    samples.orgTree.push(await time(() =>
      prisma.department.findMany({
        take: 200,
        orderBy: { id: "asc" },
        include: { _count: { select: { users: true, tasks: true } } },
      })
    ));
  }
  const stat = (arr) => {
    const s = [...arr].sort((a, b) => a - b);
    return {
      n: s.length,
      p50: Number(percentile(s, 0.5).toFixed(2)),
      p75: Number(percentile(s, 0.75).toFixed(2)),
      p95: Number(percentile(s, 0.95).toFixed(2)),
      min: Number(s[0].toFixed(2)),
      max: Number(s[s.length - 1].toFixed(2)),
    };
  };
  return {
    count: stat(samples.count),
    list50: stat(samples.list50),
    filteredSearch: stat(samples.filtered),
    deptCount: stat(samples.deptCount),
    orgTree: stat(samples.orgTree),
  };
}

async function clean(stamp) {
  // Order matters: tasks reference departments (FK), so drop tasks before
  // departments.
  const tasks = await prisma.task.deleteMany({ where: { code: { startsWith: `${PREFIX}-` } } });
  const notifs = await prisma.notification.deleteMany({ where: { title: { startsWith: PREFIX } } });
  const docs = await prisma.document.deleteMany({ where: { originalNumber: { startsWith: `${PREFIX}-DOC-` } } });
  const depts = await prisma.department.deleteMany({ where: { id: { startsWith: `${PREFIX}-DEPT-` } } });
  return { tasks: tasks.count, notifications: notifs.count, documents: docs.count, departments: depts.count };
}

async function main() {
  console.log(`[seed-volumes] disposable DB: ${dbName}`);
  if (hasFlag("clean")) {
    const removed = await clean();
    console.log(`[seed-volumes] cleaned leftovers: ${JSON.stringify(removed)}`);
    await prisma.$disconnect();
    return;
  }

  const volumes = (arg("volumes", "100,500,1000")).split(",").map(Number).filter((n) => n > 0);
  const notifVolume = Number(arg("notifications", "300"));
  const docVolume = Number(arg("documents", "300"));
  const orgVolume = Number(arg("orgs", "120"));
  const apiMode = hasFlag("api");
  const stamp = Date.now();
  const rng = makeRng((stamp ^ 0x9e3779b9) >>> 0);

  await clean();
  const refs = await baseRefs();
  console.log(`[seed-volumes] refs: user=${refs.user.email} dept=${refs.dept ? refs.dept.id : "none"}`);

  const report = {
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    database: dbName,
    volumesRequested: volumes,
    notificationsPerVolume: notifVolume,
    documentsPerVolume: docVolume,
    departmentsPerVolume: orgVolume,
    results: [],
    apiProbe: null,
  };

  for (const v of volumes) {
    // Seed org fan-out FIRST, then attach the task volume to it, so the task
    // rows are distributed across many departments (realistic multi-unit load).
    const departmentIds = await seedDepartments(orgVolume, rng, `${stamp}-${v}`);
    const taskRefs = { ...refs, departmentIds: [...departmentIds, refs.dept ? refs.dept.id : null].filter(Boolean) };
    const created = {
      tasks: await seedTasks(v, rng, taskRefs, `${stamp}-${v}`),
      notifications: await seedNotifications(notifVolume, rng, refs, `${stamp}-${v}`),
      documents: await seedDocuments(docVolume, rng, refs, `${stamp}-${v}`),
      departments: departmentIds.length,
    };
    const totalTasks = await prisma.task.count();
    const totalDepartments = await prisma.department.count();
    const probe = await probeVolume();
    const entry = {
      volume: v,
      totalTasksInDb: totalTasks,
      totalDepartmentsInDb: totalDepartments,
      created,
      queryLatencyMs: probe,
      api: null,
    };
    if (apiMode) {
      const tsx = path.join(REPO_ROOT, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
      const r = spawnSync(tsx, [path.join(REPO_ROOT, "scripts", "perf", "api-volume-probe.mts"), `--volume=${v}`], {
        cwd: REPO_ROOT,
        encoding: "utf8",
        env: { ...process.env, DATABASE_URL: DB_URL, QCET_ALLOW_DB_TESTS: "1", NODE_ENV: "test" },
      });
      try {
        entry.api = JSON.parse((r.stdout || "").trim().split("\n").pop());
      } catch {
        entry.api = { error: (r.stderr || r.error || "api probe failed").toString().slice(0, 500) };
      }
    }
    report.results.push(entry);
    console.log(`[seed-volumes] volume=${v} totalTasks=${totalTasks} totalDepartments=${totalDepartments} list50.p75=${probe.list50.p75}ms filtered.p75=${probe.filteredSearch.p75}ms orgTree.p75=${probe.orgTree.p75}ms${entry.api ? ` api.p75=${entry.api.p75}ms` : ""}`);
    const removed = await clean();
    console.log(`[seed-volumes] cleaned ${JSON.stringify(removed)}`);
  }

  fs.mkdirSync(PERF_ARTIFACTS, { recursive: true });
  const outPath = path.join(PERF_ARTIFACTS, "volume-probe.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`[seed-volumes] wrote ${path.relative(REPO_ROOT, outPath)}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(`seed-volumes fatal: ${err.message}`);
  try { await prisma.$disconnect(); } catch { /* ignore */ }
  process.exit(2);
});
