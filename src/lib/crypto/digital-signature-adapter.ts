/**
 * Digital Signature Provider Adapter Boundary
 *
 * Provider-neutral interface for digital signature operations.
 * Concrete providers (e.g. VNPT SmartCA, Viettel CA, FPT CA) implement
 * DigitalSignatureProvider and are registered via createDigitalSignatureService().
 *
 * This module defines the contract ONLY — no provider-specific logic.
 *
 * Feature gated by the `digitalSignature` flag (disabled by default).
 * When the flag is off, createDigitalSignatureService() returns the
 * unconfigured stub regardless of whether a provider is passed.
 */

import { isFeatureEnabled } from "@/features/flags";

// ============================================================================
// Request / Result Types
// ============================================================================

export interface SignatureRequest {
  /** Raw document data or pre-computed hash to sign */
  documentHash: string;
  /** ISO 8601 timestamp of signing intent */
  signingTime: string;
  /** Signer identity metadata */
  signer: {
    id: string;
    name: string;
    title?: string;
    department?: string;
    organization?: string;
  };
  /** Optional document reference for audit trail */
  documentId?: string;
  /** Optional document number for seal stamp */
  documentNumber?: string;
  /** Whether to include organizational seal */
  includeSeal?: boolean;
}

export interface SignatureResult {
  /** Whether the signing operation succeeded */
  success: boolean;
  /** Base64 or hex encoded signature value */
  signatureValue: string;
  /** Unique signature identifier from the provider */
  signatureId: string;
  /** ISO 8601 timestamp of actual signing (from provider) */
  signedAt: string;
  /** Certificate serial number used for signing */
  certificateSerial: string;
  /** Provider-specific metadata (opaque to consumers) */
  providerMetadata?: Record<string, unknown>;
}

export interface VerificationResult {
  /** Whether the signature is valid */
  isValid: boolean;
  /** Whether the document has been tampered with */
  isTampered: boolean;
  /** Whether the certificate was valid at signing time */
  isCertificateValid: boolean;
  /** ISO 8601 timestamp of verification */
  verifiedAt: string;
  /** Human-readable errors */
  errors: string[];
  /** Human-readable warnings */
  warnings: string[];
  /** Provider-specific verification details (opaque to consumers) */
  providerMetadata?: Record<string, unknown>;
}

export interface SignerInfo {
  /** Signer's full name from the certificate */
  name: string;
  /** Signer's title/position */
  title: string;
  /** Signer's department/unit */
  department: string;
  /** Signer's organization */
  organization: string;
  /** Certificate serial number */
  certificateSerial: string;
  /** Certificate validity period */
  validFrom: string;
  validTo: string;
  /** Certificate status */
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
}

// ============================================================================
// Provider Interface
// ============================================================================

/**
 * Provider-neutral adapter for digital signature operations.
 *
 * Each concrete CA provider (VNPT SmartCA, Viettel CA, etc.) implements
 * this interface. The application code depends on this contract, never
 * on the provider directly.
 */
export interface DigitalSignatureProvider {
  /** Human-readable provider name for diagnostics */
  readonly providerName: string;

  /**
   * Sign a document hash using the provider's signing infrastructure.
   * The provider is responsible for certificate selection and HSM access.
   */
  sign(request: SignatureRequest): Promise<SignatureResult>;

  /**
   * Verify a signature against the original document hash.
   * Includes certificate chain validation and revocation checking.
   */
  verify(
    documentHash: string,
    signatureValue: string,
    certificateSerial: string,
  ): Promise<VerificationResult>;

  /**
   * Retrieve signer information from a certificate serial number.
   * Used for display purposes and audit trails.
   */
  getSignerInfo(certificateSerial: string): Promise<SignerInfo>;
}

// ============================================================================
// Factory — throws until a real provider is configured
// ============================================================================

const PROVIDER_NOT_CONFIGURED_MSG =
  'DigitalSignatureProvider chưa được cấu hình. ' +
  'Vui lòng thiết lập nhà cung cấp chữ ký số (VNPT SmartCA, Viettel CA, v.v.) ' +
  'trước khi sử dụng tính năng ký số.';

const FEATURE_DISABLED_MSG =
  'Tính năng chữ ký số chưa được bật. ' +
  'Thiết lập FEATURE_FLAG_DIGITAL_SIGNATURE=true sau khi cấu hình nhà cung cấp CA.';

/**
 * Factory function for obtaining the configured digital signature provider.
 *
 * Until a real provider is registered, every method throws with a clear
 * configuration error. This prevents silent failures and makes it obvious
 * that provider setup is required.
 *
 * Usage:
 * ```ts
 * // At app startup, after provider selection:
 * // import { VnptSmartCaProvider } from '@/lib/crypto/providers/vnpt-smartca';
 * // const provider = createDigitalSignatureService(new VnptSmartCaProvider(config));
 *
 * // Until then:
 * const provider = createDigitalSignatureService();
 * await provider.sign(req); // throws "Provider not configured"
 * ```
 */
export function createDigitalSignatureService(
  provider?: DigitalSignatureProvider,
): DigitalSignatureProvider {
  // Feature flag gate — when disabled, always return the stub
  if (!isFeatureEnabled("digitalSignature")) {
    return {
      providerName: 'disabled',
      async sign(): Promise<SignatureResult> {
        throw new Error(FEATURE_DISABLED_MSG);
      },
      async verify(): Promise<VerificationResult> {
        throw new Error(FEATURE_DISABLED_MSG);
      },
      async getSignerInfo(): Promise<SignerInfo> {
        throw new Error(FEATURE_DISABLED_MSG);
      },
    };
  }

  if (provider) {
    return provider;
  }

  // Stub provider that throws on every operation
  return {
    providerName: 'unconfigured',

    async sign(): Promise<SignatureResult> {
      throw new Error(PROVIDER_NOT_CONFIGURED_MSG);
    },

    async verify(): Promise<VerificationResult> {
      throw new Error(PROVIDER_NOT_CONFIGURED_MSG);
    },

    async getSignerInfo(): Promise<SignerInfo> {
      throw new Error(PROVIDER_NOT_CONFIGURED_MSG);
    },
  };
}
