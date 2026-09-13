/**
 * S-PERF — server-side API latency probe at realistic data volumes (T75).
 *
 * Imports the CANONICAL tasks route handler (no parallel query engine) and
 * measures GET /api/tasks latency for a given seeded volume. Run via tsx by
 * seed-volumes.mjs with DATABASE_URL pointed at a disposable DB.
 *
 * Emits one JSON line: { volume, iterations, p50, p75, p95, min, max }.
 */
import { NextRequest } from "next/server";
import { GET as getTasks } from "../../src/app/api/tasks/route";
import { signSessionToken, SESSION_COOKIE_NAME } from "../../src/lib/jwt-session";
import { prisma } from "../../src/lib/prisma";
import { TaskScope } from "@prisma/client";

const arg = (name: string, def: string) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};

function percentile(sortedAsc: number[], p: number): number {
  if (!sortedAsc.length) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const idx = (sortedAsc.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo);
}

async function main() {
  const volume = Number(arg("volume", "0"));
  const iterations = Number(arg("iterations", "30"));
  const user = await prisma.user.findFirst();
  if (!user) throw new Error("no user in DB");
  // Server truth wins: sign the session with the selected user's ACTUAL role.
  // Never assert a synthetic elevated role here (PERF-09) — the probe runs
  // against a disposable *_test DB via seed-volumes.mjs, but a fabricated
  // authority would still be a false representation of the session.
  const token = signSessionToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    departmentId: user.departmentId,
  });
  const headers = { cookie: `${SESSION_COOKIE_NAME}=${token}` };
  const paths = ["/api/tasks?limit=50&page=1", "/api/tasks?limit=50&page=1&status=IN_PROGRESS"];
  const samples: number[] = [];
  const listSamples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const req = new NextRequest(`http://localhost:3000${paths[0]}`, { headers });
    const t0 = performance.now();
    const res = await getTasks(req);
    await res.json();
    listSamples.push(performance.now() - t0);
    const req2 = new NextRequest(`http://localhost:3000${paths[1]}`, { headers });
    const t1 = performance.now();
    const res2 = await getTasks(req2);
    await res2.json();
    samples.push(performance.now() - t1);
  }
  const s = [...listSamples].sort((a, b) => a - b);
  const f = [...samples].sort((a, b) => a - b);
  const total = await prisma.task.count({ where: { scope: TaskScope.SCHOOL } });
  process.stdout.write(
    JSON.stringify({
      volume,
      iterations,
      tasksInDb: total,
      list50: { p50: +percentile(s, 0.5).toFixed(2), p75: +percentile(s, 0.75).toFixed(2), p95: +percentile(s, 0.95).toFixed(2) },
      filtered: { p50: +percentile(f, 0.5).toFixed(2), p75: +percentile(f, 0.75).toFixed(2), p95: +percentile(f, 0.95).toFixed(2) },
      p75: +percentile(s, 0.75).toFixed(2),
    }) + "\n"
  );
  await prisma.$disconnect();
}

main().catch(async (err) => {
  process.stderr.write(`api-volume-probe fatal: ${err.message}\n`);
  process.exit(2);
});
