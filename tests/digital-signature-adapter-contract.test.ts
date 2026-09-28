import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDigitalSignatureService,
  type DigitalSignatureProvider,
  type SignatureRequest,
  type SignatureResult,
  type VerificationResult,
  type SignerInfo,
} from '../src/lib/crypto/digital-signature-adapter';
import {
  setFeatureFlagOverride,
  resetFeatureFlagOverrides,
} from '../src/features/flags';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(overrides?: Partial<SignatureRequest>): SignatureRequest {
  return {
    documentHash: 'abc123def456',
    signingTime: '2025-01-15T08:00:00+07:00',
    signer: { id: 'u1', name: 'Nguyễn Văn A' },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// InMemoryProvider — mock đầy đủ lifecycle
// ---------------------------------------------------------------------------

class InMemoryProvider implements DigitalSignatureProvider {
  readonly providerName = 'in-memory';
  private store = new Map<string, { hash: string; cert: string }>();

  async sign(req: SignatureRequest): Promise<SignatureResult> {
    const sigValue = 'SIG-' + req.documentHash.slice(0, 8);
    const certSerial = 'CERT-001';
    this.store.set(sigValue, { hash: req.documentHash, cert: certSerial });
    return {
      success: true,
      signatureValue: sigValue,
      signatureId: 'sid-' + Date.now(),
      signedAt: req.signingTime,
      certificateSerial: certSerial,
    };
  }

  async verify(
    documentHash: string,
    signatureValue: string,
    certificateSerial: string,
  ): Promise<VerificationResult> {
    const entry = this.store.get(signatureValue);
    if (!entry) {
      return {
        isValid: false, isTampered: false, isCertificateValid: false,
        verifiedAt: new Date().toISOString(), errors: ['Signature not found'], warnings: [],
      };
    }
    const tampered = entry.hash !== documentHash;
    return {
      isValid: !tampered && entry.cert === certificateSerial,
      isTampered: tampered,
      isCertificateValid: entry.cert === certificateSerial,
      verifiedAt: new Date().toISOString(),
      errors: tampered ? ['Document hash mismatch'] : [],
      warnings: [],
    };
  }

  async getSignerInfo(_cert: string): Promise<SignerInfo> {
    return {
      name: 'Nguyễn Văn A', title: 'Trưởng phòng', department: 'Phòng CNTT',
      organization: 'QCET', certificateSerial: 'CERT-001',
      validFrom: '2025-01-01', validTo: '2026-01-01', status: 'ACTIVE',
    };
  }
}

// ===========================================================================
// Tests
// ===========================================================================

describe('Factory — stub khi feature flag tắt (disabled)', () => {
  const stub = createDigitalSignatureService();

  it('providerName = "disabled"', () => {
    assert.equal(stub.providerName, 'disabled');
  });

  it('sign() reject với lỗi chứa "chưa được bật"', async () => {
    await assert.rejects(() => stub.sign(makeRequest()), (err: Error) => {
      assert.ok(err.message.includes('chưa được bật'));
      return true;
    });
  });

  it('verify() reject với lỗi chứa "chưa được bật"', async () => {
    await assert.rejects(() => stub.verify('h', 'v', 'c'), (err: Error) => {
      assert.ok(err.message.includes('chưa được bật'));
      return true;
    });
  });

  it('getSignerInfo() reject với lỗi chứa "chưa được bật"', async () => {
    await assert.rejects(() => stub.getSignerInfo('c'), (err: Error) => {
      assert.ok(err.message.includes('chưa được bật'));
      return true;
    });
  });
});

describe('Factory — trả về provider khi feature flag bật và truyền provider', () => {
  const mock = new InMemoryProvider();

  beforeEach(() => {
    setFeatureFlagOverride('digitalSignature', true);
  });

  afterEach(() => {
    resetFeatureFlagOverrides();
  });

  it('trả về đúng instance provider', () => {
    const svc = createDigitalSignatureService(mock);
    assert.strictEqual(svc, mock);
    assert.equal(svc.providerName, 'in-memory');
  });

  it('sign/verify/getSignerInfo hoạt động qua factory', async () => {
    const svc = createDigitalSignatureService(mock);
    const result = await svc.sign(makeRequest());
    assert.equal(result.success, true);
    const info = await svc.getSignerInfo(result.certificateSerial);
    assert.equal(info.status, 'ACTIVE');
  });
});

describe('Contract — SignatureRequest type completeness', () => {
  it('chấp nhận đầy đủ required + optional fields', () => {
    const req: SignatureRequest = {
      documentHash: 'hash',
      signingTime: '2025-01-01T00:00:00Z',
      signer: {
        id: 'u1', name: 'Test',
        title: 'Director', department: 'IT', organization: 'QCET',
      },
      documentId: 'doc-1',
      documentNumber: 'VB-001',
      includeSeal: true,
    };
    assert.equal(typeof req.documentHash, 'string');
    assert.equal(typeof req.signer.id, 'string');
    assert.ok('documentId' in req);
    assert.ok('includeSeal' in req);
  });
});

describe('Contract — SignatureResult type completeness', () => {
  it('có đầy đủ required fields và optional providerMetadata', () => {
    const res: SignatureResult = {
      success: true, signatureValue: 'sig', signatureId: 'id',
      signedAt: '2025-01-01T00:00:00Z', certificateSerial: 'CERT',
      providerMetadata: { extra: 1 },
    };
    for (const k of ['success', 'signatureValue', 'signatureId', 'signedAt', 'certificateSerial']) {
      assert.ok(k in res, `missing ${k}`);
    }
    assert.equal(typeof res.providerMetadata, 'object');
  });
});

describe('Contract — VerificationResult type completeness', () => {
  it('có đầy đủ required fields', () => {
    const vr: VerificationResult = {
      isValid: true, isTampered: false, isCertificateValid: true,
      verifiedAt: '2025-01-01T00:00:00Z', errors: [], warnings: ['w'],
      providerMetadata: {},
    };
    for (const k of ['isValid', 'isTampered', 'isCertificateValid', 'verifiedAt', 'errors', 'warnings']) {
      assert.ok(k in vr, `missing ${k}`);
    }
    assert.ok(Array.isArray(vr.errors));
    assert.ok(Array.isArray(vr.warnings));
  });
});

describe('Contract — SignerInfo type completeness', () => {
  it('có đầy đủ fields và status enum hợp lệ', () => {
    const info: SignerInfo = {
      name: 'A', title: 'B', department: 'C', organization: 'D',
      certificateSerial: 'CERT', validFrom: '2025-01-01', validTo: '2026-01-01',
      status: 'ACTIVE',
    };
    for (const k of ['name', 'title', 'department', 'organization', 'certificateSerial', 'validFrom', 'validTo', 'status']) {
      assert.ok(k in info, `missing ${k}`);
    }
    assert.ok(['ACTIVE', 'REVOKED', 'EXPIRED'].includes(info.status));
  });
});

describe('Mock provider — implements full lifecycle', () => {
  const provider = new InMemoryProvider();

  it('sign → verify → hợp lệ', async () => {
    const req = makeRequest();
    const signed = await provider.sign(req);
    assert.equal(signed.success, true);
    assert.ok(signed.signatureValue.startsWith('SIG-'));

    const vr = await provider.verify(req.documentHash, signed.signatureValue, signed.certificateSerial);
    assert.equal(vr.isValid, true);
    assert.equal(vr.isTampered, false);
    assert.equal(vr.errors.length, 0);
  });

  it('sign → sửa hash → verify → phát hiện giả mạo', async () => {
    const req = makeRequest({ documentHash: 'original-hash-999' });
    const signed = await provider.sign(req);

    const vr = await provider.verify('tampered-hash', signed.signatureValue, signed.certificateSerial);
    assert.equal(vr.isValid, false);
    assert.equal(vr.isTampered, true);
    assert.ok(vr.errors.length > 0);
  });

  it('getSignerInfo trả đúng thông tin người ký', async () => {
    const info = await provider.getSignerInfo('CERT-001');
    assert.equal(info.name, 'Nguyễn Văn A');
    assert.equal(info.status, 'ACTIVE');
    assert.equal(typeof info.validFrom, 'string');
    assert.equal(typeof info.validTo, 'string');
  });
});
