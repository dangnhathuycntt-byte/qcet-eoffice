import { AddressInfo } from "node:net";
import net from "node:net";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { scanReadableWithClamAv } from "../src/lib/services/file-service";

async function startFakeClamAv(reply: string) {
  let scannedBytes = Buffer.alloc(0);
  const server = net.createServer((socket) => {
    let buffered = Buffer.alloc(0);
    let commandRead = false;
    let scanFinished = false;

    socket.on("data", (chunk) => {
      buffered = Buffer.concat([buffered, chunk]);
      if (!commandRead) {
        const commandEnd = buffered.indexOf(0);
        if (commandEnd === -1) return;
        assert.equal(buffered.subarray(0, commandEnd).toString("ascii"), "zINSTREAM");
        buffered = buffered.subarray(commandEnd + 1);
        commandRead = true;
      }

      while (buffered.length >= 4 && !scanFinished) {
        const chunkLength = buffered.readUInt32BE(0);
        if (buffered.length < 4 + chunkLength) return;
        if (chunkLength === 0) {
          scanFinished = true;
          buffered = buffered.subarray(4);
          socket.end(Buffer.from(`${reply}\0`));
          return;
        }
        scannedBytes = Buffer.concat([scannedBytes, buffered.subarray(4, 4 + chunkLength)]);
        buffered = buffered.subarray(4 + chunkLength);
      }
    });

    socket.on("error", () => undefined);
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  return {
    port: address.port,
    scannedBytes: () => scannedBytes,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

async function* sampleChunks() {
  yield Buffer.from("first chunk ");
  yield Buffer.from("second chunk");
}

async function* largeChunks() {
  for (let i = 0; i < 24; i += 1) {
    yield Buffer.alloc(32 * 1024, i);
  }
}

describe("ClamAV INSTREAM adapter", () => {
  it("streams all bytes and records a clean response", async () => {
    const server = await startFakeClamAv("stream: OK");
    try {
      const result = await scanReadableWithClamAv(sampleChunks(), "127.0.0.1", server.port);
      assert.deepEqual(result, { status: "CLEAN", result: "stream: OK" });
      assert.equal(server.scannedBytes().toString(), "first chunk second chunk");
    } finally {
      await server.close();
    }
  });

  it("marks a signature match infected and keeps daemon errors failed", async () => {
    const infectedServer = await startFakeClamAv("stream: Eicar-Test-Signature FOUND");
    try {
      const result = await scanReadableWithClamAv(sampleChunks(), "127.0.0.1", infectedServer.port);
      assert.equal(result.status, "INFECTED");
    } finally {
      await infectedServer.close();
    }

    const failedServer = await startFakeClamAv("stream: size limit exceeded ERROR");
    try {
      const result = await scanReadableWithClamAv(sampleChunks(), "127.0.0.1", failedServer.port);
      assert.equal(result.status, "FAILED");
    } finally {
      await failedServer.close();
    }
  });

  it("cleans up write listeners while streaming through repeated backpressure", async () => {
    const server = await startFakeClamAv("stream: OK");
    const listenerWarnings: Error[] = [];
    const onWarning = (warning: Error) => {
      if (warning.name === "MaxListenersExceededWarning") listenerWarnings.push(warning);
    };
    process.on("warning", onWarning);

    try {
      const result = await scanReadableWithClamAv(largeChunks(), "127.0.0.1", server.port);
      assert.equal(result.status, "CLEAN");
      assert.equal(server.scannedBytes().byteLength, 24 * 32 * 1024);
      await new Promise<void>((resolve) => setImmediate(resolve));
      assert.deepEqual(listenerWarnings, []);
    } finally {
      process.removeListener("warning", onWarning);
      await server.close();
    }
  });
});
