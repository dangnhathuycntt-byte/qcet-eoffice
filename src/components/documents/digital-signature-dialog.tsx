"use client";

import * as React from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  FileCheck2,
  Lock,
  Building,
  Award,
  RefreshCw,
  Stamp,
  X,
  Clock,
  Sparkles,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  type DigitalCertificateInfo,
  type SealStampData,
  type DocumentSignaturePayload,
  type SignatureVerificationResult,
  verifyDocumentSignature,
  createDocumentSignaturePayload,
  formatIctDate,
  formatIctDateTime,
  computeDocumentSha256,
} from "@/lib/crypto/digital-signature-service";

export interface DigitalSignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentData: unknown;
  documentNumber?: string;
  documentTitle?: string;
  existingSignature?: DocumentSignaturePayload | null;
  onSignComplete?: (payload: DocumentSignaturePayload) => void;
  currentUser?: {
    id?: string;
    name: string;
    email?: string;
    title?: string;
    department?: string;
    organization?: string;
  };
  initialMode?: "verify" | "sign";
}

type TabKey = "stamp" | "certificate" | "integrity";

export function DigitalSignatureDialog({
  open,
  onOpenChange,
  documentData,
  documentNumber = "Số:.../CĐKTCN-HCTH",
  documentTitle = "Văn bản hành chính điện tử",
  existingSignature,
  onSignComplete,
  currentUser = {
    name: "TS. Nguyễn Văn Hùng",
    title: "Hiệu trưởng",
    department: "Ban Giám hiệu",
    organization: "Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn",
  },
  initialMode = "verify",
}: DigitalSignatureDialogProps) {
  const [activeTab, setActiveTab] = React.useState<TabKey>("stamp");
  const [copiedHash, setCopiedHash] = React.useState(false);
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [isSigning, setIsSigning] = React.useState(false);
  const [currentSignature, setCurrentSignature] = React.useState<DocumentSignaturePayload | null>(
    existingSignature || null
  );
  const [verificationResult, setVerificationResult] =
    React.useState<SignatureVerificationResult | null>(null);

  // Sync state when props change
  React.useEffect(() => {
    if (existingSignature) {
      setCurrentSignature(existingSignature);
    }
  }, [existingSignature]);

  // Execute verification
  const runVerification = React.useCallback(async (sigPayload: DocumentSignaturePayload | null) => {
    if (!sigPayload) {
      setVerificationResult(null);
      return;
    }
    setIsVerifying(true);
    try {
      const result = await verifyDocumentSignature(documentData, sigPayload);
      setVerificationResult(result);
    } catch (err) {
      console.error("Signature verification failed:", err);
    } finally {
      setIsVerifying(false);
    }
  }, [documentData]);

  // Initial verification on open
  React.useEffect(() => {
    if (open && currentSignature) {
      runVerification(currentSignature);
    }
  }, [open, currentSignature, runVerification]);

  // Copy hash handler
  const handleCopyHash = (hash: string) => {
    if (!hash) return;
    navigator.clipboard.writeText(hash).then(() => {
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    });
  };

  // Signing handler
  const handleSignDocument = async () => {
    setIsSigning(true);
    try {
      const newPayload = await createDocumentSignaturePayload(documentData, currentUser, {
        documentNumber,
        role: currentUser.title || "Hiệu trưởng",
        orgName: currentUser.organization || "Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn",
        includeSeal: true,
      });

      setCurrentSignature(newPayload);
      await runVerification(newPayload);
      onSignComplete?.(newPayload);
      setActiveTab("stamp");
    } catch (error) {
      console.error("Signing document error:", error);
    } finally {
      setIsSigning(false);
    }
  };

  const cert: DigitalCertificateInfo | undefined =
    currentSignature?.certificate || verificationResult?.certificateInfo;
  const seal: SealStampData | undefined =
    currentSignature?.sealStamp || verificationResult?.sealStamp;
  const isValid = verificationResult ? verificationResult.isValid : !!currentSignature;
  const isTampered = verificationResult ? verificationResult.isTampered : false;

  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity duration-150 motion-safe:transition-opacity motion-safe:duration-150" />
        <BaseDialog.Popup
          data-slot="digital-signature-dialog"
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 outline-none",
            "max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl",
            "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95"
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-border/60 pb-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-lg border",
                  isValid && !isTampered
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                    : isTampered
                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                    : "border-primary/30 bg-primary/10 text-primary"
                )}
              >
                {isValid && !isTampered ? (
                  <ShieldCheck className="size-5" />
                ) : isTampered ? (
                  <ShieldAlert className="size-5" />
                ) : (
                  <Stamp className="size-5" />
                )}
              </div>
              <div>
                <BaseDialog.Title className="text-lg font-semibold tracking-tight text-foreground">
                  Chứng thực & Ký số Điện tử
                </BaseDialog.Title>
                <BaseDialog.Description className="text-xs text-muted-foreground">
                  Chuẩn QCVN 102:2016/BTTTT và Nghị định 30/2020/NĐ-CP
                </BaseDialog.Description>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {currentSignature && (
                <Badge
                  variant={isValid && !isTampered ? "emerald" : isTampered ? "destructive" : "secondary"}
                  className="gap-1 px-2.5 py-1"
                >
                  {isValid && !isTampered ? (
                    <>
                      <CheckCircle2 className="size-3.5" />
                      Chữ ký số hợp lệ
                    </>
                  ) : isTampered ? (
                    <>
                      <XCircle className="size-3.5" />
                      Dữ liệu đã bị sửa đổi
                    </>
                  ) : (
                    <>
                      <Clock className="size-3.5" />
                      Chờ xác thực
                    </>
                  )}
                </Badge>
              )}
              <BaseDialog.Close
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Đóng"
              >
                <X className="size-4" />
              </BaseDialog.Close>
            </div>
          </div>

          {/* Document Summary Bar */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 p-3 text-xs">
            <div className="flex items-center gap-2">
              <FileCheck2 className="size-4 text-primary shrink-0" />
              <span className="font-semibold text-foreground">{documentNumber}</span>
              <span className="text-muted-foreground">—</span>
              <span className="text-muted-foreground truncate max-w-[280px]">{documentTitle}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="size-3.5" />
              <span>
                {currentSignature?.signedAt
                  ? formatIctDateTime(currentSignature.signedAt)
                  : "Chưa ký"}
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="mt-4 flex border-b border-border/80 text-sm font-medium">
            <button
              type="button"
              onClick={() => setActiveTab("stamp")}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-2.5 transition-colors cursor-pointer active:scale-[0.98]",
                activeTab === "stamp"
                  ? "border-primary text-primary font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Stamp className="size-4" />
              Dấu & Chữ ký điện tử
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("certificate")}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-2.5 transition-colors cursor-pointer active:scale-[0.98]",
                activeTab === "certificate"
                  ? "border-primary text-primary font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Award className="size-4" />
              Chứng thư số QCVN 102
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("integrity")}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-2.5 transition-colors cursor-pointer active:scale-[0.98]",
                activeTab === "integrity"
                  ? "border-primary text-primary font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Lock className="size-4" />
              Kiểm tra toàn vẹn
            </button>
          </div>

          {/* Tab Content */}
          <div className="mt-4 space-y-4">
            {/* TAB 1: VISUAL STAMP & SIGNATURE */}
            {activeTab === "stamp" && (
              <div className="space-y-4">
                {currentSignature ? (
                  <div className="rounded-xl border border-border bg-card p-4 shadow-subtle">
                    <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <Sparkles className="size-3.5 text-amber-500" />
                        Trực quan hóa chữ ký & Con dấu theo NĐ 30/2020/NĐ-CP
                      </span>
                      <span className="text-emerald-600 font-medium">Định dạng chuẩn Vector SVG</span>
                    </div>

                    {/* Official Electronic Stamp & Signature Container */}
                    <div className="relative flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-background/80 p-6">
                      <div className="relative flex w-full max-w-md items-center justify-end">
                        {/* 1. Red Organization Seal (Overlaps 1/3 of the signature on the left) */}
                        <div className="absolute right-[140px] top-1/2 -translate-y-1/2 z-10 transition-transform duration-200">
                          <ElectronicSealSvg
                            organizationName={seal?.organizationName || currentUser.organization || "QCET"}
                            dateStr={seal?.issuedDate || formatIctDate(new Date())}
                            securityCode={seal?.securityCode || "QCET-SEAL-VERIFIED"}
                          />
                        </div>

                        {/* 2. Blue Personal Signature Block */}
                        <div className="relative z-0 flex flex-col items-center justify-center text-center pl-16">
                          <span className="text-xs font-bold text-foreground">
                            {currentSignature.signerRole || "HIỆU TRƯỞNG"}
                          </span>

                          {/* Signature Stroke SVG */}
                          <div className="my-1.5 h-14 w-40 text-blue-700">
                            <SignatureStrokeSvg name={currentSignature.signerName} />
                          </div>

                          <span className="text-sm font-semibold text-foreground">
                            {currentSignature.signerName}
                          </span>

                          <div className="mt-1 flex items-center gap-1 rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-mono text-blue-700">
                            <CheckCircle2 className="size-3 shrink-0" />
                            <span>Ký số: {formatIctDateTime(currentSignature.signedAt)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Stamp Metadata Details */}
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-md bg-muted/40 p-2.5">
                        <span className="text-muted-foreground block text-[11px]">Đơn vị chứng thực</span>
                        <span className="font-medium text-foreground">{cert?.issuerName || "Ban Cơ yếu Chính phủ"}</span>
                      </div>
                      <div className="rounded-md bg-muted/40 p-2.5">
                        <span className="text-muted-foreground block text-[11px]">Mã bảo mật con dấu</span>
                        <span className="font-mono font-medium text-foreground">{seal?.securityCode || "QCET-SEAL-2026"}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-8 text-center">
                    <Stamp className="size-12 text-muted-foreground/50 mb-3" />
                    <p className="text-sm font-semibold text-foreground">Văn bản chưa được ký số</p>
                    <p className="text-xs text-muted-foreground max-w-sm mt-1">
                      Thực hiện ký số điện tử bằng chứng thư số chuyên dùng Chính phủ để ban hành văn bản chính thức.
                    </p>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleSignDocument}
                      disabled={isSigning}
                      className="mt-4 gap-2"
                    >
                      {isSigning ? (
                        <>
                          <RefreshCw className="size-3.5 animate-spin" />
                          Đang tạo chữ ký số...
                        </>
                      ) : (
                        <>
                          <KeyRound className="size-3.5" />
                          Ký số & Đóng dấu điện tử
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: CERTIFICATE DETAILS */}
            {activeTab === "certificate" && (
              <div className="space-y-3">
                {cert ? (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-border bg-muted/30 p-3.5 text-xs space-y-2.5">
                      <div className="flex items-center justify-between border-b border-border/50 pb-2">
                        <span className="text-muted-foreground">Chủ thể chứng thư (Subject):</span>
                        <span className="font-semibold text-foreground">{cert.subjectName}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-border/50 pb-2">
                        <span className="text-muted-foreground">Chức vụ & Đơn vị:</span>
                        <span className="font-medium text-foreground">
                          {cert.subjectTitle} — {cert.subjectDepartment}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-b border-border/50 pb-2">
                        <span className="text-muted-foreground">Cơ quan ban hành:</span>
                        <span className="font-medium text-foreground">{cert.subjectOrganization}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-border/50 pb-2">
                        <span className="text-muted-foreground">Tổ chức cấp phát (Issuer CA):</span>
                        <span className="font-semibold text-emerald-700">{cert.issuerName}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-border/50 pb-2">
                        <span className="text-muted-foreground">Số Serial chứng thư:</span>
                        <span className="font-mono text-[11px] text-foreground">{cert.serialNumber}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-border/50 pb-2">
                        <span className="text-muted-foreground">Thuật toán khóa & Chữ ký:</span>
                        <span className="font-mono text-foreground">
                          {cert.keyAlgorithm} ({cert.signatureAlgorithm})
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-b border-border/50 pb-2">
                        <span className="text-muted-foreground">Thời hạn hiệu lực:</span>
                        <span className="font-medium text-foreground">
                          {formatIctDate(cert.validFrom)} đến {formatIctDate(cert.validTo)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Tiêu chuẩn kỹ thuật:</span>
                        <Badge variant="sapphire" className="text-[10px]">
                          {cert.standardCompliance}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    Chưa có thông tin chứng thư số.
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: INTEGRITY & AUDIT */}
            {activeTab === "integrity" && (
              <div className="space-y-3">
                {/* SHA-256 Hash Box */}
                <div className="rounded-lg border border-border bg-muted/40 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Lock className="size-3.5 text-primary" />
                      Mã băm toàn vẹn văn bản (SHA-256 Digest)
                    </span>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handleCopyHash(currentSignature?.documentHash || "")}
                      className="gap-1 text-xs"
                    >
                      {copiedHash ? (
                        <>
                          <Check className="size-3 text-emerald-600" />
                          Đã sao chép
                        </>
                      ) : (
                        <>
                          <Copy className="size-3" />
                          Sao chép
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="rounded bg-background p-2.5 font-mono text-[11px] text-muted-foreground break-all border border-border/60">
                    {currentSignature?.documentHash || "Chưa tính toán mã băm"}
                  </div>
                </div>

                {/* Audit Checklist */}
                {verificationResult && (
                  <div className="rounded-lg border border-border p-3.5 space-y-2 text-xs">
                    <span className="font-semibold text-foreground block mb-2">
                      Kết quả kiểm định mật mã tự động
                    </span>
                    <div className="space-y-1.5">
                      <CheckItem
                        label="Khớp mã băm SHA-256 (Toàn vẹn nội dung)"
                        passed={verificationResult.validationDetails.hashMatch}
                      />
                      <CheckItem
                        label="Chứng thư số trong thời hạn hiệu lực"
                        passed={verificationResult.validationDetails.certTimeValid}
                      />
                      <CheckItem
                        label="Trạng thái chứng thư số Hoạt động (ACTIVE)"
                        passed={verificationResult.validationDetails.certStatusActive}
                      />
                      <CheckItem
                        label="Cấu trúc chữ ký số chuẩn QCVN 102:2016"
                        passed={verificationResult.validationDetails.signatureFormatValid}
                      />
                      <CheckItem
                        label="Tuân thủ thể thức dấu và chữ ký theo NĐ 30/2020"
                        passed={verificationResult.validationDetails.decree30Compliant}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="mt-6 flex items-center justify-between border-t border-border/60 pt-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="size-3.5 text-muted-foreground" />
              <span>Ký số ICT (UTC+7)</span>
            </div>

            <div className="flex items-center gap-2">
              {currentSignature && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runVerification(currentSignature)}
                  disabled={isVerifying}
                  className="gap-1.5"
                >
                  <RefreshCw className={cn("size-3.5", isVerifying && "animate-spin")} />
                  Xác minh lại
                </Button>
              )}

              {!currentSignature && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSignDocument}
                  disabled={isSigning}
                  className="gap-1.5"
                >
                  <KeyRound className="size-3.5" />
                  Ký số ngay
                </Button>
              )}

              <Button
                variant="secondary"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Đóng
              </Button>
            </div>
          </div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

// ============================================================================
// Internal Visual Sub-components
// ============================================================================

function CheckItem({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-muted-foreground">{label}</span>
      {passed ? (
        <span className="flex items-center gap-1 text-emerald-600 font-medium text-[11px]">
          <CheckCircle2 className="size-3.5" />
          Đạt
        </span>
      ) : (
        <span className="flex items-center gap-1 text-destructive font-medium text-[11px]">
          <XCircle className="size-3.5" />
          Không đạt
        </span>
      )}
    </div>
  );
}

/**
 * Standard Vietnamese Government/Institutional Electronic Red Seal SVG
 * Con dấu tròn màu đỏ của cơ quan, tổ chức theo Nghị định 30/2020/NĐ-CP.
 */
function ElectronicSealSvg({
  organizationName,
  dateStr,
  securityCode,
}: {
  organizationName: string;
  dateStr: string;
  securityCode: string;
}) {
  return (
    <svg
      viewBox="0 0 200 200"
      className="size-36 text-red-600 drop-shadow-sm select-none"
      aria-label="Con dấu điện tử cơ quan"
    >
      {/* Outer double red ring */}
      <circle cx="100" cy="100" r="94" fill="none" stroke="currentColor" strokeWidth="3.5" />
      <circle cx="100" cy="100" r="87" fill="none" stroke="currentColor" strokeWidth="1.2" />

      {/* Center 5-pointed star */}
      <polygon
        points="100,50 106,68 125,68 110,80 115,98 100,86 85,98 90,80 75,68 94,68"
        fill="currentColor"
      />

      {/* Middle Organization text (Upper Arch) */}
      <path id="sealUpperArch" d="M 22 100 A 78 78 0 1 1 178 100" fill="none" />
      <text fill="currentColor" fontSize="9.5" fontWeight="bold" letterSpacing="0.6">
        <textPath href="#sealUpperArch" startOffset="50%" textAnchor="middle">
          {organizationName.toUpperCase().slice(0, 48)}
        </textPath>
      </text>

      {/* Middle Text: VĂN THƯ */}
      <text
        x="100"
        y="118"
        fill="currentColor"
        fontSize="10"
        fontWeight="bold"
        textAnchor="middle"
        letterSpacing="1"
      >
        VĂN THƯ
      </text>

      {/* Lower Date Arch */}
      <path id="sealLowerArch" d="M 178 100 A 78 78 0 0 1 22 100" fill="none" />
      <text fill="currentColor" fontSize="8" fontWeight="600" letterSpacing="0.4">
        <textPath href="#sealLowerArch" startOffset="50%" textAnchor="middle">
          ★ KÝ SỐ: {dateStr} ★
        </textPath>
      </text>
    </svg>
  );
}

/**
 * Signature Cursive Vector Stroke SVG
 * Chữ ký tay nét mực xanh điện tử theo Nghị định 30/2020/NĐ-CP.
 */
function SignatureStrokeSvg({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 240 80"
      className="size-full stroke-blue-700 fill-none select-none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Dynamic elegant signature calligraphy stroke */}
      <path
        d="M20 50 C 40 20, 60 10, 80 40 C 95 65, 110 20, 130 35 C 145 45, 160 15, 180 30 C 195 40, 210 25, 225 35"
        strokeWidth="2.8"
      />
      <path
        d="M35 55 C 80 65, 140 60, 215 48"
        strokeWidth="2.2"
      />
      <path
        d="M60 25 C 75 45, 85 55, 95 30"
        strokeWidth="1.8"
      />
      <path
        d="M135 25 Q 150 60 165 28"
        strokeWidth="1.8"
      />
    </svg>
  );
}
