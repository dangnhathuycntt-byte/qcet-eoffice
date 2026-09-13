/**
 * W0 baseline — same-data auth proxy.
 *
 * Chromium's CLI `--screenshot` cannot inject an HttpOnly session cookie. This
 * tiny same-origin reverse proxy forwards to the app and attaches the real
 * `qcet_session` cookie, so headless frames render authenticated "same-data"
 * output instead of the zero-state shell.
 *
 * Env:
 *   TARGET_ORIGIN   upstream app origin (default http://127.0.0.1:3000)
 *   LISTEN_PORT     proxy listen port (default 3399)
 *   SESSION_COOKIE  full Cookie header value, e.g. "qcet_session=<jwt>"
 *                   (provided at runtime; never written to disk)
 *
 * READ-ONLY toward the app: only safe methods (GET/HEAD/OPTIONS) are forwarded
 * (plus upgrade sockets for HMR). Every mutating request (POST/PUT/PATCH/DELETE)
 * is answered locally with 204 and NEVER reaches the app, so a baseline capture
 * can never mutate the frozen dataset snapshot.
 */
import http from "node:http";
import net from "node:net";

const TARGET = new URL(process.env.TARGET_ORIGIN || "http://127.0.0.1:3000");
const PORT = Number(process.env.LISTEN_PORT || 3399);
const SESSION_COOKIE = process.env.SESSION_COOKIE || "";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

if (!SESSION_COOKIE) {
  console.error("SESSION_COOKIE is required (e.g. qcet_session=<jwt>).");
  process.exit(2);
}

const server = http.createServer((req, res) => {
  // Hard read-only guard: never forward a mutating verb to the app/DB.
  if (!SAFE_METHODS.has(req.method || "GET")) {
    res.writeHead(204, { "content-type": "text/plain", "x-qcet-proxy": "read-only-dropped" });
    res.end();
    return;
  }
  const headers = { ...req.headers };
  headers["cookie"] = SESSION_COOKIE;
  headers["host"] = TARGET.host;

  const proxyReq = http.request(
    {
      protocol: TARGET.protocol,
      hostname: TARGET.hostname,
      port: TARGET.port,
      method: req.method,
      path: req.url,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );
  proxyReq.on("error", (err) => {
    res.writeHead(502, { "content-type": "text/plain" });
    res.end(`proxy error: ${err.message}`);
  });
  req.pipe(proxyReq);
});

// Forward websocket/HMR upgrades (dev servers) transparently.
server.on("upgrade", (req, socket, head) => {
  const headers = { ...req.headers, cookie: SESSION_COOKIE, host: TARGET.host };
  const upstream = net.connect(Number(TARGET.port || 80), TARGET.hostname, () => {
    const path = req.url;
    let raw = `${req.method} ${path} HTTP/1.1\r\n`;
    for (const [k, v] of Object.entries(headers)) raw += `${k}: ${v}\r\n`;
    raw += "\r\n";
    upstream.write(raw);
    if (head && head.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on("error", () => socket.destroy());
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`auth-proxy listening on http://127.0.0.1:${PORT} -> ${TARGET.origin} (cookie injected)`);
});
