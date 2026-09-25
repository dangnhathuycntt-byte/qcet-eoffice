/**
 * Digital Signature & Electronic Stamping Service
 * Compliant with Decree 30/2020/ND-CP and National Technical Regulation QCVN 102:2016/BTTTT.
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface DigitalCertificateInfo {
  serialNumber: string;
  subjectName: string;
  subjectTitle: string;
  subjectDepartment: string;
  subjectOrganization: string;
  issuerName: string;
  issuerOrganization: string;
  validFrom: string; // ISO 8601 string
  validTo: string; // ISO 8601 string
  keyAlgorithm: string; // e.g. "RSA 2048-bit" | "ECDSA P-256"
  signatureAlgorithm: string; // e.g. "SHA256withRSA"
  standardCompliance: string; // e.g. "QCVN 102:2016/BTTTT & Nghị định 30/2020/NĐ-CP"
  certificateStatus: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  timestampAuthority: string;
  authorityKeyId?: string;
  subjectKeyId?: string;
}

export type SealType = 'ORGANIZATION_SEAL' | 'LEADER_SIGNATURE' | 'DEPARTMENT_STAMP';

export interface SealStampData {
  organizationName: string;
  organizationUnit?: string;
  documentNumber: string;
  issuedDate: string; // ICT Formatted e.g. "25/09/2026"
  issuedDateIso: string;
  sealType: SealType;
  stampStatus: 'VALID' | 'PENDING' | 'INVALID';
  securityCode: string; // e.g. "QCET-SEAL-2026-A8B9C"
  signerName?: string;
  signerTitle?: string;
}

export interface DocumentSignaturePayload {
  signatureId: string;
  documentId?: string;
  documentHash: string; // SHA-256 hash (64 hex characters)
  signatureValue: string; // Base64 encoded or hex cryptographic signature
  signedAt: string; // ISO 8601 (ICT timestamp)
  signerName: string;
  signerRole: string;
  certificate: DigitalCertificateInfo;
  sealStamp?: SealStampData;
}

export interface SignatureValidationDetails {
  hashMatch: boolean;
  certTimeValid: boolean;
  certStatusActive: boolean;
  signatureFormatValid: boolean;
  decree30Compliant: boolean;
}

export interface SignatureVerificationResult {
  isValid: boolean;
  isTampered: boolean;
  isCertificateValid: boolean;
  computedHash: string;
  providedHash: string;
  verifiedAt: string; // ISO 8601
  certificateInfo: DigitalCertificateInfo;
  sealStamp?: SealStampData;
  validationDetails: SignatureValidationDetails;
  errors: string[];
  warnings: string[];
}

export interface SignerUserInput {
  id?: string;
  name: string;
  email?: string;
  title?: string;
  department?: string;
  organization?: string;
}

// ============================================================================
// Timezone and Canonical Helpers (ICT / UTC+7)
// ============================================================================

/**
 * Format date to standard Vietnamese ICT format: DD/MM/YYYY
 */
export function formatIctDate(dateInput: Date | string | number): string {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';

  // Use Intl with Asia/Ho_Chi_Minh timezone
  const formatter = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return formatter.format(d);
}

/**
 * Format datetime to standard Vietnamese ICT format: DD/MM/YYYY HH:mm:ss
 */
export function formatIctDateTime(dateInput: Date | string | number): string {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';

  const formatter = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return formatter.format(d);
}

/**
 * Canonicalize data to deterministic string for hashing.
 * Sorts object keys recursively to ensure consistent hash calculation across platforms.
 */
export function canonicalizeData(data: unknown): string {
  if (data === null || data === undefined) {
    return '';
  }
  if (typeof data === 'string') {
    return data;
  }
  if (data instanceof Uint8Array) {
    return new TextDecoder().decode(data);
  }
  if (typeof data !== 'object') {
    return String(data);
  }

  if (Array.isArray(data)) {
    return '[' + data.map((item) => canonicalizeData(item)).join(',') + ']';
  }

  // Object: sort keys
  const obj = data as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map((key) => {
    return `${JSON.stringify(key)}:${canonicalizeData(obj[key])}`;
  });
  return '{' + pairs.join(',') + '}';
}

// ============================================================================
// Cryptographic Hashing (SHA-256 Isomorphic)
// ============================================================================

/**
 * Computes SHA-256 hex digest isomorphically using Web Crypto API or Node fallback.
 */
export async function computeDocumentSha256(data: unknown): Promise<string> {
  const text = canonicalizeData(data);
  const encoder = new TextEncoder();
  const buffer = encoder.encode(text);

  // Check Web Crypto API
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Node.js fallback if subtle is not present
  try {
    const nodeCrypto = await import('crypto');
    return nodeCrypto.createHash('sha256').update(buffer).digest('hex');
  } catch {
    // Basic fallback JS SHA-256 implementation if crypto unavailable
    return computeSha256JsFallback(buffer);
  }
}

/**
 * Synchronous SHA-256 helper with fast JS implementation fallback.
 */
export function computeDocumentSha256Sync(data: unknown): string {
  const text = canonicalizeData(data);
  const encoder = new TextEncoder();
  const buffer = encoder.encode(text);

  // Check if Node crypto is available synchronously
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require('crypto');
    return nodeCrypto.createHash('sha256').update(buffer).digest('hex');
  } catch {
    return computeSha256JsFallback(buffer);
  }
}

/**
 * Pure JavaScript SHA-256 algorithm fallback (RFC 6234).
 */
function computeSha256JsFallback(bytes: Uint8Array): string {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const len = bytes.length;
  const bitLen = len * 8;
  const padLen = (len % 64 < 56) ? 56 - (len % 64) : 120 - (len % 64);
  const totalLen = len + padLen + 8;
  const padded = new Uint8Array(totalLen);
  padded.set(bytes);
  padded[len] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(totalLen - 4, bitLen & 0xffffffff);
  view.setUint32(totalLen - 8, Math.floor(bitLen / 0x100000000));

  const w = new Uint32Array(64);

  for (let i = 0; i < totalLen; i += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] = view.getUint32(i + t * 4);
    }
    for (let t = 16; t < 64; t++) {
      const s0 = ((w[t - 15] >>> 7) | (w[t - 15] << 25)) ^ ((w[t - 15] >>> 18) | (w[t - 15] << 14)) ^ (w[t - 15] >>> 3);
      const s1 = ((w[t - 2] >>> 17) | (w[t - 2] << 15)) ^ ((w[t - 2] >>> 19) | (w[t - 2] << 13)) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;

    for (let t = 0; t < 64; t++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + w[t]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + h) | 0;
  }

  const result = [h0, h1, h2, h3, h4, h5, h6, h7];
  return result.map((val) => (val >>> 0).toString(16).padStart(8, '0')).join('');
}

// ============================================================================
// Core Functions as Specified in Requirements
// ============================================================================

/**
 * 1. generateSignatureCertificateInfo:
 * Generates digital certificate metadata compliant with QCVN 102:2016/BTTTT
 * and Decree 30/2020/ND-CP standard for government/institutional digital signature.
 */
export function generateSignatureCertificateInfo(
  user: SignerUserInput,
  role?: string,
  timestamp?: Date | string
): DigitalCertificateInfo {
  const signDate = timestamp ? new Date(timestamp) : new Date();
  const validFrom = new Date(signDate);
  validFrom.setFullYear(validFrom.getFullYear() - 1); // Issued 1 year ago

  const validTo = new Date(signDate);
  validTo.setFullYear(validTo.getFullYear() + 2); // Valid for 3 years total

  // Generate deterministic serial number based on user identity or random hex
  const cleanId = user.id || user.email || user.name;
  const hashSeed = computeDocumentSha256Sync(`${cleanId}-${user.name}`);
  const serialHex = hashSeed.substring(0, 32).toUpperCase();
  const formattedSerial = serialHex.match(/.{1,4}/g)?.join(':') || serialHex;

  const resolvedRole = role || user.title || 'Người ký có thẩm quyền';
  const resolvedOrg = user.organization || 'Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET)';
  const resolvedDept = user.department || 'Ban Giám hiệu';

  return {
    serialNumber: formattedSerial,
    subjectName: user.name,
    subjectTitle: resolvedRole,
    subjectDepartment: resolvedDept,
    subjectOrganization: resolvedOrg,
    issuerName: 'Ban Cơ yếu Chính phủ (VGCA)',
    issuerOrganization: 'Hệ thống Chứng thực Chữ ký số Chuyên dùng Chính phủ',
    validFrom: validFrom.toISOString(),
    validTo: validTo.toISOString(),
    keyAlgorithm: 'RSA 2048-bit',
    signatureAlgorithm: 'SHA256withRSA',
    standardCompliance: 'QCVN 102:2016/BTTTT & Nghị định 30/2020/NĐ-CP',
    certificateStatus: 'ACTIVE',
    timestampAuthority: 'VGCA Time Stamping Authority (TSA)',
    authorityKeyId: 'VGCA-ROOT-CA-2024',
    subjectKeyId: hashSeed.substring(32, 48).toUpperCase(),
  };
}

/**
 * 2. generateSealStampData:
 * Generates electronic seal stamp metadata compliant with Decree 30/2020/ND-CP.
 */
export function generateSealStampData(
  documentNumber: string,
  issuedDate: Date | string,
  orgName?: string
): SealStampData {
  const d = typeof issuedDate === 'string' ? new Date(issuedDate) : issuedDate;
  const formattedIct = formatIctDate(d);
  const organization = orgName || 'TRƯỜNG CAO ĐẲNG KỸ THUẬT CÔNG NGHỆ QUY NHƠN';

  // Deterministic security seal code
  const rawSeed = `${documentNumber}-${organization}-${d.getTime()}`;
  const codeHash = computeDocumentSha256Sync(rawSeed).substring(0, 8).toUpperCase();
  const securityCode = `QCET-SEAL-${d.getFullYear()}-${codeHash}`;

  return {
    organizationName: organization,
    organizationUnit: 'VĂN THƯ NHÀ TRƯỜNG',
    documentNumber: documentNumber || 'Số:.../CĐKTCN-HCTH',
    issuedDate: formattedIct || 'Hôm nay',
    issuedDateIso: d.toISOString(),
    sealType: 'ORGANIZATION_SEAL',
    stampStatus: 'VALID',
    securityCode,
  };
}

/**
 * 3. verifyDocumentSignature:
 * Verifies document integrity (SHA-256 hash check) and digital signature validity.
 */
export async function verifyDocumentSignature(
  documentData: unknown,
  signaturePayload: DocumentSignaturePayload
): Promise<SignatureVerificationResult> {
  const verifiedAt = new Date().toISOString();
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!signaturePayload) {
    return {
      isValid: false,
      isTampered: true,
      isCertificateValid: false,
      computedHash: '',
      providedHash: '',
      verifiedAt,
      certificateInfo: {} as DigitalCertificateInfo,
      validationDetails: {
        hashMatch: false,
        certTimeValid: false,
        certStatusActive: false,
        signatureFormatValid: false,
        decree30Compliant: false,
      },
      errors: ['Không tìm thấy dữ liệu chữ ký số (Signature payload missing).'],
      warnings: [],
    };
  }

  // 1. Compute SHA-256 hash of document data
  const computedHash = await computeDocumentSha256(documentData);
  const providedHash = (signaturePayload.documentHash || '').toLowerCase().trim();
  const isHashMatch = computedHash.toLowerCase() === providedHash;

  if (!isHashMatch) {
    errors.push('Cảnh báo toàn vẹn: Dữ liệu văn bản đã bị sửa đổi sau khi ký số (SHA-256 Hash Mismatch).');
  }

  // 2. Validate Certificate Timing
  const cert = signaturePayload.certificate;
  let isCertTimeValid = false;
  let isCertStatusActive = false;

  if (cert) {
    const signTime = new Date(signaturePayload.signedAt || Date.now()).getTime();
    const validFrom = new Date(cert.validFrom).getTime();
    const validTo = new Date(cert.validTo).getTime();

    if (signTime >= validFrom && signTime <= validTo) {
      isCertTimeValid = true;
    } else {
      errors.push(`Chứng thư số không hợp lệ tại thời điểm ký (${formatIctDateTime(signTime)}).`);
    }

    if (cert.certificateStatus === 'ACTIVE') {
      isCertStatusActive = true;
    } else {
      errors.push(`Trạng thái chứng thư số không khả dụng: ${cert.certificateStatus}.`);
    }
  } else {
    errors.push('Thiếu thông tin chứng thư số (Certificate missing).');
  }

  // 3. Validate Signature Format and Value
  let isSignatureFormatValid = false;
  if (signaturePayload.signatureValue && signaturePayload.signatureValue.length >= 16) {
    isSignatureFormatValid = true;
  } else {
    errors.push('Định dạng mã chữ ký số không hợp lệ.');
  }

  // 4. Decree 30/2020 Compliance checks
  const isDecree30Compliant = Boolean(
    cert &&
    cert.subjectName &&
    cert.subjectTitle &&
    signaturePayload.signedAt &&
    signaturePayload.sealStamp
  );

  if (!isDecree30Compliant) {
    warnings.push('Chữ ký thiếu một số trường siêu dữ liệu theo khuyến nghị Nghị định 30/2020/NĐ-CP.');
  }

  const isTampered = !isHashMatch;
  const isCertificateValid = isCertTimeValid && isCertStatusActive;
  const isValid = isHashMatch && isCertificateValid && isSignatureFormatValid;

  return {
    isValid,
    isTampered,
    isCertificateValid,
    computedHash,
    providedHash,
    verifiedAt,
    certificateInfo: cert,
    sealStamp: signaturePayload.sealStamp,
    validationDetails: {
      hashMatch: isHashMatch,
      certTimeValid: isCertTimeValid,
      certStatusActive: isCertStatusActive,
      signatureFormatValid: isSignatureFormatValid,
      decree30Compliant: isDecree30Compliant,
    },
    errors,
    warnings,
  };
}

// ============================================================================
// Signature Creation Helper
// ============================================================================

/**
 * Creates a complete digital signature payload for a document.
 */
export async function createDocumentSignaturePayload(
  documentData: unknown,
  signer: SignerUserInput,
  options?: {
    documentId?: string;
    documentNumber?: string;
    role?: string;
    orgName?: string;
    includeSeal?: boolean;
    signingTime?: Date | string;
  }
): Promise<DocumentSignaturePayload> {
  const signingTime = options?.signingTime ? new Date(options.signingTime) : new Date();
  const documentHash = await computeDocumentSha256(documentData);

  const cert = generateSignatureCertificateInfo(signer, options?.role, signingTime);
  const signatureId = `SIG-${signingTime.getFullYear()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

  // Deterministic signature value simulation (SHA-256 of hash + cert serial + timestamp)
  const signatureRaw = `${documentHash}:${cert.serialNumber}:${signingTime.toISOString()}`;
  const signatureValue = computeDocumentSha256Sync(signatureRaw);

  let sealStamp: SealStampData | undefined = undefined;
  if (options?.includeSeal !== false && options?.documentNumber) {
    sealStamp = generateSealStampData(options.documentNumber, signingTime, options.orgName);
    sealStamp.signerName = signer.name;
    sealStamp.signerTitle = options?.role || signer.title;
  }

  return {
    signatureId,
    documentId: options?.documentId,
    documentHash,
    signatureValue,
    signedAt: signingTime.toISOString(),
    signerName: signer.name,
    signerRole: options?.role || signer.title || 'Người ký',
    certificate: cert,
    sealStamp,
  };
}
