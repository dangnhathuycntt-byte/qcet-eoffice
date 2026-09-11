"use client";

import * as React from "react";
import {
  Smartphone,
  QrCode,
  Copy,
  Check,
  Share,
  PlusSquare,
  Sparkles,
  X,
  Laptop,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  Loader2,
  Wifi,
  Network,
  Download,
} from "lucide-react";
import QRCode from "qrcode";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { cn } from "@/lib/utils";

export interface MobileAppInstallModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

interface NetworkInfo {
  tailscaleIp: string | null;
  lanIp: string | null;
  port: number;
  tailscaleUrl: string | null;
  lanUrl: string | null;
}

export function MobileAppInstallModal({
  isOpen: propIsOpen,
  onClose: propOnClose,
}: MobileAppInstallModalProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isOpen = propIsOpen !== undefined ? propIsOpen : internalOpen;
  const handleClose = React.useCallback(() => {
    if (propOnClose) {
      propOnClose();
    } else {
      setInternalOpen(false);
    }
  }, [propOnClose]);

  const { isInstallable, isStandalone, installApp } = usePWAInstall();
  const [networkInfo, setNetworkInfo] = React.useState<NetworkInfo | null>(null);
  const [selectedUrlType, setSelectedUrlType] = React.useState<
    "tailscale" | "lan" | "current"
  >("tailscale");
  const [qrCodeDataUrl, setQrCodeDataUrl] = React.useState<string>("");
  const [copied, setCopied] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"ios" | "android" | "desktop">(
    "ios"
  );
  const [isGeneratingQr, setIsGeneratingQr] = React.useState(false);
  const [isMobileDevice, setIsMobileDevice] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const checkMobile = () => {
      const isMobileWidth = window.innerWidth < 768;
      const isMobileUA =
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      setIsMobileDevice(isMobileWidth || isMobileUA);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  React.useEffect(() => {
    if (typeof navigator !== "undefined") {
      const isIOS =
        /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      const isAndroid = /Android/i.test(navigator.userAgent);
      if (isIOS) {
        setActiveTab("ios");
      } else if (isAndroid) {
        setActiveTab("android");
      }
    }
  }, []);

  // Global event listener to open modal from anywhere
  React.useEffect(() => {
    const handleOpen = () => setInternalOpen(true);
    window.addEventListener("qcet:open-install-modal", handleOpen);
    return () => window.removeEventListener("qcet:open-install-modal", handleOpen);
  }, []);

  // Fetch local network & Tailscale info
  React.useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;

    async function fetchNetwork() {
      try {
        const res = await fetch("/api/system/network-info");
        if (res.ok) {
          const data: NetworkInfo = await res.json();
          if (isMounted) {
            setNetworkInfo(data);
            if (data.tailscaleUrl) {
              setSelectedUrlType("tailscale");
            } else if (data.lanUrl) {
              setSelectedUrlType("lan");
            } else {
              setSelectedUrlType("current");
            }
          }
        }
      } catch {
        // Fallback to current window origin
      }
    }

    fetchNetwork();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Compute the current active URL to encode into QR code
  const activeUrl = React.useMemo(() => {
    if (typeof window === "undefined") return "";
    if (selectedUrlType === "tailscale" && networkInfo?.tailscaleUrl) {
      return networkInfo.tailscaleUrl;
    }
    if (selectedUrlType === "lan" && networkInfo?.lanUrl) {
      return networkInfo.lanUrl;
    }
    return window.location.origin;
  }, [selectedUrlType, networkInfo]);

  // Generate QR code whenever activeUrl changes
  React.useEffect(() => {
    if (!activeUrl) return;
    let isMounted = true;
    setIsGeneratingQr(true);

    QRCode.toDataURL(activeUrl, {
      width: 240,
      margin: 2,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    })
      .then((url) => {
        if (isMounted) {
          setQrCodeDataUrl(url);
          setIsGeneratingQr(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsGeneratingQr(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeUrl]);

  // Escape key handler
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  const handleCopyLink = async () => {
    if (!activeUrl) return;
    try {
      await navigator.clipboard.writeText(activeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-modal-title"
    >
      <div
        className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 bg-muted/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Smartphone size={18} strokeWidth={2} />
            </div>
            <div>
              <h2
                id="install-modal-title"
                className="text-sm sm:text-base font-bold text-foreground leading-tight"
              >
                Cài đặt Ứng dụng QCET E-Office
              </h2>
              <p className="text-xs text-muted-foreground">
                Hoạt động như ứng dụng di động độc lập (PWA), nhận thông báo chuông tức thì
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {isMobileDevice ? (
            /* Direct Mobile Install / Quick Action Card */
            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Smartphone size={16} className="text-primary shrink-0" />
                    <h4 className="text-sm font-bold text-foreground">
                      {isStandalone
                        ? "Ứng dụng đã được cài đặt"
                        : "Cài đặt ứng dụng trên thiết bị này"}
                    </h4>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isStandalone
                      ? "Bạn đang sử dụng QCET E-Office ở chế độ App toàn màn hình với hiệu năng tối ưu."
                      : "Trải nghiệm mượt mà, khởi chạy từ màn hình chính và nhận thông báo công việc tức thì."}
                  </p>
                </div>

                {isInstallable && !isStandalone && (
                  <button
                    type="button"
                    onClick={async () => {
                      await installApp();
                      handleClose();
                    }}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-lg bg-primary text-primary-foreground font-semibold text-xs shadow-md hover:bg-primary/90 active:scale-95 transition-all cursor-pointer shrink-0"
                  >
                    <Download size={14} />
                    <span>Cài đặt ứng dụng</span>
                  </button>
                )}
              </div>

              {/* Copy URL Row for Mobile */}
              <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                <input
                  type="text"
                  readOnly
                  value={activeUrl}
                  className="flex-1 px-2.5 py-1.5 text-xs font-mono rounded-lg border border-border bg-background text-foreground select-all truncate"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={cn(
                    "inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0",
                    copied
                      ? "bg-emerald-600 text-white"
                      : "bg-card hover:bg-muted border border-border text-foreground"
                  )}
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copied ? "Đã chép" : "Chép liên kết"}</span>
                </button>
              </div>
            </div>
          ) : (
            /* QR Code & Direct Connect Section */
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center p-4 rounded-xl border border-primary/20 bg-primary/5">
            {/* Left: QR Display */}
            <div className="md:col-span-5 flex flex-col items-center justify-center text-center">
              <div className="relative p-2.5 bg-white rounded-xl shadow-md border border-border/40 inline-flex items-center justify-center">
                {isGeneratingQr || !qrCodeDataUrl ? (
                  <div className="size-[180px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 size={24} className="animate-spin text-primary" />
                    <span className="text-xs font-medium">Đang tạo mã QR...</span>
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrCodeDataUrl}
                    alt="Mã QR mở ứng dụng trên điện thoại"
                    className="size-[180px] rounded-lg block"
                  />
                )}
              </div>
              <p className="mt-2 text-xs font-semibold text-foreground flex items-center gap-1.5">
                <QrCode size={13} className="text-primary" />
                <span>Quét bằng Camera điện thoại</span>
              </p>
            </div>

            {/* Right: Network Address Options & Copy */}
            <div className="md:col-span-7 space-y-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Chọn kênh kết nối đến điện thoại:
                </span>
                <div className="mt-1.5 space-y-1.5">
                  {/* Tailscale Option */}
                  {networkInfo?.tailscaleUrl && (
                    <button
                      type="button"
                      onClick={() => setSelectedUrlType("tailscale")}
                      className={cn(
                        "w-full flex items-center justify-between p-2.5 rounded-lg border text-xs font-medium transition-all text-left cursor-pointer",
                        selectedUrlType === "tailscale"
                          ? "bg-primary text-primary-foreground border-primary shadow-xs font-semibold"
                          : "bg-card hover:bg-muted/70 border-border/60 text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Network size={14} className="shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate">Mạng Tailscale VPN</span>
                            <span
                              className={cn(
                                "px-1.5 py-0.5 rounded text-xs uppercase font-bold",
                                selectedUrlType === "tailscale"
                                  ? "bg-white/20 text-white"
                                  : "bg-emerald-500/15 text-emerald-600"
                              )}
                            >
                              Khuyên dùng
                            </span>
                          </div>
                          <p
                            className={cn(
                              "text-xs font-mono truncate",
                              selectedUrlType === "tailscale"
                                ? "text-white/80"
                                : "text-muted-foreground"
                            )}
                          >
                            {networkInfo.tailscaleUrl}
                          </p>
                        </div>
                      </div>
                      {selectedUrlType === "tailscale" && (
                        <CheckCircle2 size={14} className="shrink-0 ml-2" />
                      )}
                    </button>
                  )}

                  {/* LAN Wi-Fi Option */}
                  {networkInfo?.lanUrl && (
                    <button
                      type="button"
                      onClick={() => setSelectedUrlType("lan")}
                      className={cn(
                        "w-full flex items-center justify-between p-2.5 rounded-lg border text-xs font-medium transition-all text-left cursor-pointer",
                        selectedUrlType === "lan"
                          ? "bg-primary text-primary-foreground border-primary shadow-xs font-semibold"
                          : "bg-card hover:bg-muted/70 border-border/60 text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Wifi size={14} className="shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate">Wi-Fi nội bộ (Cùng mạng)</span>
                          </div>
                          <p
                            className={cn(
                              "text-xs font-mono truncate",
                              selectedUrlType === "lan"
                                ? "text-white/80"
                                : "text-muted-foreground"
                            )}
                          >
                            {networkInfo.lanUrl}
                          </p>
                        </div>
                      </div>
                      {selectedUrlType === "lan" && (
                        <CheckCircle2 size={14} className="shrink-0 ml-2" />
                      )}
                    </button>
                  )}

                  {/* Current / Localhost Option */}
                  <button
                    type="button"
                    onClick={() => setSelectedUrlType("current")}
                    className={cn(
                      "w-full flex items-center justify-between p-2.5 rounded-lg border text-xs font-medium transition-all text-left cursor-pointer",
                      selectedUrlType === "current"
                        ? "bg-primary text-primary-foreground border-primary shadow-xs font-semibold"
                        : "bg-card hover:bg-muted/70 border-border/60 text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Laptop size={14} className="shrink-0" />
                      <div className="min-w-0">
                        <span className="truncate">Địa chỉ hiện tại</span>
                        <p
                          className={cn(
                            "text-xs font-mono truncate",
                            selectedUrlType === "current"
                              ? "text-white/80"
                              : "text-muted-foreground"
                          )}
                        >
                          {typeof window !== "undefined" ? window.location.origin : "http://localhost:3001"}
                        </p>
                      </div>
                    </div>
                    {selectedUrlType === "current" && (
                      <CheckCircle2 size={14} className="shrink-0 ml-2" />
                    )}
                  </button>
                </div>
              </div>

              {/* Copy URL Row */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  readOnly
                  value={activeUrl}
                  className="flex-1 px-2.5 py-1.5 text-xs font-mono rounded-lg border border-border bg-background text-foreground select-all"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                    copied
                      ? "bg-emerald-600 text-white"
                      : "bg-secondary text-foreground hover:bg-secondary/80 border border-border/60"
                  )}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copied ? "Đã chép" : "Chép link"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

          {/* Platform Installation Guide Tabs */}
          <div>
            <div className="flex items-center gap-1.5 border-b border-border/60 pb-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab("ios")}
                className={cn(
                  "flex items-center justify-center gap-1.5 px-3.5 py-2.5 min-h-[44px] rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0",
                  activeTab === "ios"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <span>iPhone / iPad (iOS)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("android")}
                className={cn(
                  "flex items-center justify-center gap-1.5 px-3.5 py-2.5 min-h-[44px] rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0",
                  activeTab === "android"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <span>Điện thoại Android</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("desktop")}
                className={cn(
                  "flex items-center justify-center gap-1.5 px-3.5 py-2.5 min-h-[44px] rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0",
                  activeTab === "desktop"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <span>Máy tính (Desktop App)</span>
              </button>
            </div>

            {/* iOS Guide */}
            {activeTab === "ios" && (
              <div className="pt-3 space-y-2.5">
                <div className="p-3 rounded-xl border border-border/60 bg-muted/20 space-y-2 text-xs">
                  <div className="flex items-start gap-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      1
                    </span>
                    <p className="text-foreground leading-relaxed">
                      Mở <strong>Safari</strong> trên iPhone/iPad và truy cập vào địa chỉ hệ thống (hoặc quét mã QR ở trên).
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      2
                    </span>
                    <div className="text-foreground leading-relaxed flex items-center gap-1 flex-wrap">
                      <span>Nhấn biểu tượng</span>
                      <strong className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary text-foreground border border-border/60">
                        <Share size={12} className="text-primary" /> Chia sẻ (Share)
                      </strong>
                      <span>ở thanh công cụ dưới đáy Safari.</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      3
                    </span>
                    <div className="text-foreground leading-relaxed flex items-center gap-1 flex-wrap">
                      <span>Chọn</span>
                      <strong className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary text-foreground border border-border/60">
                        <PlusSquare size={12} className="text-primary" /> Thêm vào MH chính (Add to Home Screen)
                      </strong>
                      <span>rồi nhấn <strong>Thêm (Add)</strong>.</span>
                    </div>
                  </div>
                  <div className="mt-1 pt-1.5 border-t border-border/40 text-xs text-muted-foreground">
                    Thao tác nhanh: <strong>Nhấn biểu tượng Chia sẻ &rarr; Thêm vào Màn hình chính</strong>.
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-xs flex items-center gap-2">
                  <CheckCircle2 size={15} className="shrink-0" />
                  <span>
                    App sẽ xuất hiện trên màn hình chính của iPhone với biểu tượng QCET, chạy toàn màn hình và nhận thông báo đẩy (Push Notifications) như app App Store!
                  </span>
                </div>
              </div>
            )}

            {/* Android Guide */}
            {activeTab === "android" && (
              <div className="pt-3 space-y-2.5">
                <div className="p-3 rounded-xl border border-border/60 bg-muted/20 space-y-2 text-xs">
                  <div className="flex items-start gap-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      1
                    </span>
                    <p className="text-foreground leading-relaxed">
                      Mở trình duyệt <strong>Google Chrome</strong> trên điện thoại Android và mở liên kết Tailscale (hoặc quét mã QR).
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      2
                    </span>
                    <p className="text-foreground leading-relaxed">
                      Bấm vào biểu tượng menu <strong>3 dấu chấm (⋮)</strong> ở góc trên bên phải màn hình.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      3
                    </span>
                    <p className="text-foreground leading-relaxed">
                      Chọn <strong>&ldquo;Cài đặt ứng dụng&rdquo;</strong> (hoặc &ldquo;Thêm vào Màn hình chính&rdquo;) $\rightarrow$ Xác nhận <strong>Cài đặt</strong>.
                    </p>
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-xs flex items-center gap-2">
                  <CheckCircle2 size={15} className="shrink-0" />
                  <span>
                    Ứng dụng được cài đặt vào ngăn chứa ứng dụng của Android, hỗ trợ thông báo chuông và rung độc lập.
                  </span>
                </div>
              </div>
            )}

            {/* Desktop Guide */}
            {activeTab === "desktop" && (
              <div className="pt-3 space-y-2.5">
                <div className="p-3 rounded-xl border border-border/60 bg-muted/20 space-y-3 text-xs">
                  {isStandalone ? (
                    <div className="flex items-center gap-2 text-emerald-600 font-semibold">
                      <CheckCircle2 size={16} />
                      <span>QCET E-Office đã được cài đặt và đang chạy ở chế độ Desktop App độc lập.</span>
                    </div>
                  ) : isInstallable ? (
                    <div className="space-y-2">
                      <p className="text-foreground leading-relaxed">
                        Trình duyệt hiện tại sẵn sàng cài đặt ứng dụng QCET E-Office trực tiếp lên máy tính của bạn:
                      </p>
                      <button
                        type="button"
                        onClick={async () => {
                          await installApp();
                          handleClose();
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all cursor-pointer shadow-sm active:scale-95"
                      >
                        <Laptop size={15} />
                        <span>Cài đặt ngay lên máy tính này</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <p className="text-foreground leading-relaxed">
                        Trên trình duyệt <strong>Google Chrome</strong> hoặc <strong>Microsoft Edge</strong>:
                      </p>
                      <p className="text-muted-foreground leading-relaxed">
                        Nhìn vào góc bên phải của thanh địa chỉ URL (gần biểu tượng Dấu sao Bookmark), bấm vào biểu tượng <strong>Cài đặt ứng dụng</strong> (hình màn hình máy tính có mũi tên tải xuống).
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border/60 bg-muted/10 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Sparkles size={13} className="text-primary" />
            <span>Đồng bộ thời gian thực qua Tailscale &amp; Web Push</span>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 min-h-[44px] rounded-lg border border-border/60 bg-secondary hover:bg-secondary/80 text-foreground font-medium transition-colors cursor-pointer flex items-center justify-center"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
