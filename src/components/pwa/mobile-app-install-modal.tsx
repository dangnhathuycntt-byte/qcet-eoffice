"use client";

import * as React from "react";
import { Check, Copy, Download, MoreHorizontal, MoreVertical, PlusSquare, Share } from "lucide-react";
import QRCode from "qrcode";
import { checkIsIOS, usePWAInstall } from "@/hooks/use-pwa-install";
import { pwaOnboardingCoordinator } from "@/lib/pwa/onboarding-coordinator";
import { Button } from "@/components/ui/button";
import { StandardDialog } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

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

type UrlType = "tailscale" | "lan" | "current";
/** Thiết bị đang mở hộp này; quyết định hiện nút Cài đặt hay các bước thủ công. */
type Platform = "ios" | "android" | "mac-safari" | "desktop";

const URL_HINT: Record<UrlType, string> = {
  tailscale: "Cần bật Tailscale",
  lan: "Cần cùng Wi-Fi",
  current: "Cần mở được địa chỉ này",
};

function detectPlatform(): Platform {
  if (checkIsIOS()) return "ios";
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "android";
  if (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua)) return "mac-safari";
  return "desktop";
}

/** Ký hiệu nút của trình duyệt, đặt trong dòng chữ hướng dẫn. */
function Key({ icon: Icon, children }: { icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <span className="mx-0.5 inline-flex h-5 items-center gap-1 rounded-sm bg-muted px-1.5 align-middle text-xs leading-none text-foreground">
      {Icon ? <Icon className="size-3 text-muted-foreground" /> : null}
      {children}
    </span>
  );
}

const B = ({ children }: { children: React.ReactNode }) => <strong className="font-medium">{children}</strong>;

/**
 * Các bước thủ công khi trình duyệt không có nút cài (iOS, Safari trên Mac) hoặc chưa cho cài.
 * iOS 26: nút Chia sẻ có thể nằm trong menu ⋯ tùy cách bố trí tab; ứng dụng trên màn hình chính có bộ nhớ riêng nên phải đăng nhập lại.
 */
const STEPS: Record<Platform, React.ReactNode[]> = {
  ios: [
    <>Mở trang này bằng <B>Safari</B>.</>,
    <>Nhấn <Key icon={Share}>Chia sẻ</Key>. Không thấy thì nhấn <Key icon={MoreHorizontal}>Thêm</Key> trước.</>,
    <>Chọn <Key icon={PlusSquare}>Thêm vào MH chính</Key>, giữ bật mở dưới dạng ứng dụng web, rồi nhấn <B>Thêm</B>.</>,
    <>Mở QCET E-Office từ màn hình chính, đăng nhập lại một lần để nhận thông báo.</>,
  ],
  android: [
    <>Mở trang này bằng <B>Chrome</B>.</>,
    <>Nhấn <Key icon={MoreVertical}>Menu</Key> ở góc trên bên phải.</>,
    <>Chọn <B>Cài đặt ứng dụng</B> (hoặc Thêm vào màn hình chính) rồi xác nhận.</>,
  ],
  "mac-safari": [<>Trên thanh menu, chọn <B>File → Add to Dock</B>.</>, <>Nhấn <B>Add</B>; QCET E-Office mở trong cửa sổ riêng từ Dock.</>],
  desktop: [
    <>Mở trang này bằng <B>Chrome</B> hoặc <B>Edge</B>.</>,
    <>Bấm biểu tượng <Key icon={Download}>Cài đặt</Key> ở cuối thanh địa chỉ rồi chọn <B>Cài đặt</B>.</>,
  ],
};

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-2">
      {items.map((item, index) => (
        <li key={index} className="flex items-start gap-3 text-compact leading-6 text-foreground">
          <span className="w-3 shrink-0 text-right tabular-nums text-muted-foreground">{index + 1}</span>
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Hộp "Cài ứng dụng" (PWA), mở bằng sự kiện `qcet:open-install-modal`. Gọn theo đúng thiết bị đang dùng:
 * - Đã cài: một dòng báo đã cài.
 * - Trình duyệt cho cài (Chrome/Edge, Chrome Android): nút Cài đặt ở chân hộp.
 * - Không có nút cài (iOS, Safari trên Mac…): các bước của riêng thiết bị đó.
 * Máy tính có thêm hàng "Cài trên điện thoại" (mã QR + chép địa chỉ); quét xong, hộp này trên điện thoại tự hiện đúng các bước.
 * Chọn Tailscale / Wi-Fi nội bộ chỉ có khi chạy ở localhost (môi trường phát triển), bản thật dùng tên miền đang mở.
 */
export function MobileAppInstallModal({ isOpen: propIsOpen, onClose: propOnClose }: MobileAppInstallModalProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isOpen = propIsOpen !== undefined ? propIsOpen : internalOpen;
  const handleClose = React.useCallback(() => {
    if (propOnClose) propOnClose();
    else setInternalOpen(false);
  }, [propOnClose]);

  const { isInstallable, isStandalone, installApp } = usePWAInstall();
  const [platform, setPlatform] = React.useState<Platform>("desktop");
  const [isPhone, setIsPhone] = React.useState(false);
  const [canPrompt, setCanPrompt] = React.useState(false);
  const [isLocalHost, setIsLocalHost] = React.useState(false);
  const [networkInfo, setNetworkInfo] = React.useState<NetworkInfo | null>(null);
  const [urlType, setUrlType] = React.useState<UrlType>("current");
  const [qrCodeDataUrl, setQrCodeDataUrl] = React.useState("");
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    const detected = detectPlatform();
    setPlatform(detected);
    setIsPhone(detected === "ios" || detected === "android");
    setIsLocalHost(/^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname));
  }, []);

  // Hộp mở muộn hơn sự kiện beforeinstallprompt: hỏi bộ điều phối PWA đang giữ sự kiện đó
  React.useEffect(() => {
    if (isOpen) setCanPrompt(isInstallable || pwaOnboardingCoordinator.hasInstallPrompt());
  }, [isOpen, isInstallable]);

  // Mở từ bất kỳ đâu. Khi cha điều khiển `isOpen` (AppShell giữ listener) thì không đăng ký thêm, tránh mở hai đường (T68).
  React.useEffect(() => {
    if (propIsOpen !== undefined) return;
    const handleOpen = () => setInternalOpen(true);
    window.addEventListener("qcet:open-install-modal", handleOpen);
    return () => window.removeEventListener("qcet:open-install-modal", handleOpen);
  }, [propIsOpen]);

  // Chỉ môi trường phát triển (localhost) mới cần địa chỉ Tailscale / mạng nội bộ để điện thoại mở được
  React.useEffect(() => {
    if (!isOpen || !isLocalHost) return;
    let isMounted = true;
    (async () => {
      try {
        const res = await fetch("/api/system/network-info");
        if (!res.ok) return;
        const data: NetworkInfo = await res.json();
        if (!isMounted) return;
        setNetworkInfo(data);
        setUrlType(data.tailscaleUrl ? "tailscale" : data.lanUrl ? "lan" : "current");
      } catch {
        // Không lấy được thì dùng địa chỉ hiện tại
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [isOpen, isLocalHost]);

  const urlOptions = React.useMemo(() => {
    const options: { type: UrlType; label: string; url: string }[] = [];
    if (networkInfo?.tailscaleUrl) options.push({ type: "tailscale", label: "Tailscale", url: networkInfo.tailscaleUrl });
    if (networkInfo?.lanUrl) options.push({ type: "lan", label: "Wi-Fi nội bộ", url: networkInfo.lanUrl });
    if (typeof window !== "undefined") options.push({ type: "current", label: "Địa chỉ này", url: window.location.origin });
    return options;
  }, [networkInfo]);
  const activeUrl = urlOptions.find((o) => o.type === urlType)?.url ?? urlOptions[urlOptions.length - 1]?.url ?? "";

  React.useEffect(() => {
    if (!isOpen || isPhone || !activeUrl) return;
    let isMounted = true;
    QRCode.toDataURL(activeUrl, { width: 192, margin: 1, color: { dark: "#1a1d23", light: "#ffffff" } })
      .then((url) => {
        if (isMounted) setQrCodeDataUrl(url);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [isOpen, isPhone, activeUrl]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(activeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Trình duyệt chặn clipboard: địa chỉ vẫn hiện để chọn tay
    }
  };

  const install = async () => {
    const outcome = await installApp();
    if (outcome === "accepted") handleClose();
    else setCanPrompt(pwaOnboardingCoordinator.hasInstallPrompt());
  };

  const showSteps = !isStandalone && !canPrompt;

  return (
    <StandardDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
      title="Cài ứng dụng QCET E-Office"
      description="Cài QCET E-Office để mở như ứng dụng và nhận thông báo khi có việc mới."
      size="sm"
      showHeader={false}
      className="gap-5 p-5 sm:p-5"
    >
      {/* Không có đầu hộp: tiêu đề/mô tả chỉ cho trình đọc màn hình; nội dung và nút ở chân hộp đã đủ nói hộp này làm gì */}
      {isStandalone ? (
        <p className="flex items-center gap-2 text-compact text-foreground">
          <Check className="size-4 text-muted-foreground" />
          Bạn đang dùng ứng dụng đã cài.
        </p>
      ) : null}
      {canPrompt && !isStandalone && isPhone ? (
        <p className="text-compact text-foreground">Thêm QCET E-Office vào màn hình chính để nhận thông báo khi có việc mới.</p>
      ) : null}
      {showSteps ? <Steps items={STEPS[platform]} /> : null}

      {!isPhone ? (
        <section aria-labelledby="install-on-phone" className="flex items-center gap-4">
          <div className="size-16 shrink-0 overflow-hidden rounded-md bg-white">
            {qrCodeDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrCodeDataUrl} alt="Mã QR mở QCET E-Office trên điện thoại" width={64} height={64} className="size-full" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="install-on-phone" className="text-compact font-medium text-foreground">
              Cài trên điện thoại
            </h3>
            <p className="text-xs text-muted-foreground">Quét mã bằng camera điện thoại.</p>
            <div className="mt-0.5 flex min-w-0 items-center gap-0.5">
              <span className="min-w-0 truncate font-mono text-xs text-muted-foreground" title={activeUrl}>
                {activeUrl.replace(/^https?:\/\//, "")}
              </span>
              <Button size="icon-xs" variant="ghost" onClick={handleCopyLink} aria-label={copied ? "Đã chép địa chỉ" : "Chép địa chỉ"}>
                {copied ? <Check /> : <Copy />}
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {/* Môi trường phát triển: chọn địa chỉ điện thoại mở được */}
      {!isPhone && isLocalHost && urlOptions.length > 1 ? (
        <div className="-mt-2 flex items-center gap-2">
          <ToggleGroup
            aria-label="Địa chỉ mở trên điện thoại"
            size="xs"
            value={[urlType]}
            onValueChange={(next) => {
              if (next[0]) setUrlType(next[0] as UrlType);
            }}
          >
            {urlOptions.map((option) => (
              <ToggleGroupItem key={option.type} value={option.type}>
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <span className="truncate text-xs text-muted-foreground">{URL_HINT[urlType]}</span>
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        {canPrompt && !isStandalone ? (
          <>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              Để sau
            </Button>
            <Button size="sm" onClick={install}>
              <Download />
              {isPhone ? "Cài đặt" : "Cài trên máy này"}
            </Button>
          </>
        ) : (
          <Button variant="secondary" size="sm" onClick={handleClose}>
            Đóng
          </Button>
        )}
      </div>
    </StandardDialog>
  );
}
