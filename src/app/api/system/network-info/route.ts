import { NextResponse } from "next/server";
import os from "os";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Endpoint not available in production" },
      { status: 404 }
    );
  }

  try {
    const interfaces = os.networkInterfaces();
    let tailscaleIp: string | null = null;
    let lanIp: string | null = null;

    for (const [name, addrs] of Object.entries(interfaces)) {
      if (!addrs) continue;
      for (const addr of addrs) {
        if (addr.family === "IPv4" && !addr.internal) {
          // Check for Tailscale (100.64.0.0/10 CGNAT range or utun/tailscale interface)
          if (
            addr.address.startsWith("100.") ||
            name.toLowerCase().includes("tailscale")
          ) {
            tailscaleIp = addr.address;
          } else if (
            addr.address.startsWith("192.168.") ||
            addr.address.startsWith("10.") ||
            addr.address.startsWith("172.")
          ) {
            if (!lanIp) {
              lanIp = addr.address;
            }
          }
        }
      }
    }

    const port = process.env.PORT || "3001";

    return NextResponse.json({
      tailscaleIp,
      lanIp,
      port: Number(port),
      tailscaleUrl: tailscaleIp ? `http://${tailscaleIp}:${port}` : null,
      lanUrl: lanIp ? `http://${lanIp}:${port}` : null,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch network info" },
      { status: 500 }
    );
  }
}
