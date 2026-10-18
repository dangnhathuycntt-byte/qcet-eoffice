import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalizeData,
  computeDocumentSha256,
  computeDocumentSha256Sync,
  formatIctDate,
  formatIctDateTime,
  verifyDocumentSignature,
  createDocumentSignaturePayload,
  type DocumentSignaturePayload,
  type SignerUserInput,
} from '../src/lib/crypto/digital-signature-service';

// ---------------------------------------------------------------------------
// 1. canonicalizeData — edge cases
// ---------------------------------------------------------------------------
describe('canonicalizeData — edge cases', () => {
  it('null trả về chuỗi rỗng', () => {
    assert.equal(canonicalizeData(null), '');
  });

  it('undefined trả về chuỗi rỗng', () => {
    assert.equal(canonicalizeData(undefined), '');
  });

  it('number 42 trả về "42"', () => {
    assert.equal(canonicalizeData(42), '42');
  });

  it('boolean true trả về "true"', () => {
    assert.equal(canonicalizeData(true), 'true');
  });

  it('chuỗi rỗng trả về chuỗi rỗng', () => {
    assert.equal(canonicalizeData(''), '');
  });

  it('object rỗng trả về "{}"', () => {
    assert.equal(canonicalizeData({}), '{}');
  });

  it('mảng rỗng trả về "[]"', () => {
    assert.equal(canonicalizeData([]), '[]');
  });

  it('Uint8Array được giải mã thành chuỗi UTF-8', () => {
    const bytes = new TextEncoder().encode('xin chào');
    assert.equal(canonicalizeData(bytes), 'xin chào');
  });

  it('object lồng sâu sắp xếp key ở mọi cấp', () => {
    const input = { z: { b: 2, a: { d: 4, c: 3 } }, y: 1 };
    const result = canonicalizeData(input);
    // Keys must be sorted: y before z, a before b, c before d
    assert.equal(result, '{"y":1,"z":{"a":{"c":3,"d":4},"b":2}}');
  });

  it('mảng giữ nguyên thứ tự phần tử (không sắp xếp)', () => {
    const input = [3, 1, 2];
    assert.equal(canonicalizeData(input), '[3,1,2]');
  });

  it('object có key dạng số sắp xếp theo thứ tự từ điển', () => {
    const input = { '10': 'a', '2': 'b', '1': 'c' };
    const result = canonicalizeData(input);
    // Lexicographic: "1" < "10" < "2"
    assert.equal(result, '{"1":c,"10":a,"2":b}');
  });
});

// ---------------------------------------------------------------------------
// 2. computeDocumentSha256 — determinism
// ---------------------------------------------------------------------------
describe('computeDocumentSha256 — tính xác định', () => {
  it('cùng đầu vào cho cùng hash qua nhiều lần gọi', async () => {
    const data = { key: 'giá trị' };
    const h1 = await computeDocumentSha256(data);
    const h2 = await computeDocumentSha256(data);
    const h3 = await computeDocumentSha256(data);
    assert.equal(h1, h2);
    assert.equal(h2, h3);
  });

  it('đầu vào khác nhau cho hash khác nhau', async () => {
    const h1 = await computeDocumentSha256('alpha');
    const h2 = await computeDocumentSha256('beta');
    assert.notEqual(h1, h2);
  });

  it('hash luôn là 64 ký tự hex', async () => {
    for (const input of ['', 0, null, { a: 1 }, [1, 2]]) {
      const h = await computeDocumentSha256(input);
      assert.equal(h.length, 64);
      assert.match(h, /^[0-9a-f]{64}$/);
    }
  });

  it('hash của chuỗi rỗng, null và undefined', async () => {
    const hEmpty = await computeDocumentSha256('');
    const hNull = await computeDocumentSha256(null);
    const hUndef = await computeDocumentSha256(undefined);
    // null and undefined both canonicalize to '' so must equal empty string hash
    assert.equal(hNull, hEmpty);
    assert.equal(hUndef, hEmpty);
  });
});

// ---------------------------------------------------------------------------
// 3. computeDocumentSha256Sync — parity với async
// ---------------------------------------------------------------------------
describe('computeDocumentSha256Sync — tương đương async', () => {
  it('object rỗng cho hash giống nhau sync vs async', async () => {
    const asyncH = await computeDocumentSha256({});
    const syncH = computeDocumentSha256Sync({});
    assert.equal(asyncH, syncH);
  });

  it('mảng cho hash giống nhau sync vs async', async () => {
    const data = [1, 'hai', { ba: 3 }];
    const asyncH = await computeDocumentSha256(data);
    const syncH = computeDocumentSha256Sync(data);
    assert.equal(asyncH, syncH);
  });

  it('cấu trúc lồng sâu cho hash giống nhau sync vs async', async () => {
    const data = { a: { b: { c: [1, { d: 2 }] } } };
    const asyncH = await computeDocumentSha256(data);
    const syncH = computeDocumentSha256Sync(data);
    assert.equal(asyncH, syncH);
  });
});

// ---------------------------------------------------------------------------
// 4. formatIctDate / formatIctDateTime — edge cases
// ---------------------------------------------------------------------------
describe('formatIctDate / formatIctDateTime — edge cases', () => {
  it('đầu vào ngày không hợp lệ trả về chuỗi rỗng', () => {
    assert.equal(formatIctDate('not-a-date'), '');
    assert.equal(formatIctDateTime('not-a-date'), '');
  });

  it('NaN trả về chuỗi rỗng', () => {
    assert.equal(formatIctDate(NaN), '');
    assert.equal(formatIctDateTime(NaN), '');
  });

  it('đầu vào Invalid Date trả về chuỗi rỗng', () => {
    assert.equal(formatIctDate(new Date('invalid')), '');
    assert.equal(formatIctDateTime(new Date('invalid')), '');
  });

  it('nửa đêm UTC hiển thị đúng ngày ICT (UTC+7)', () => {
    // 2026-09-25 00:00:00 UTC = 2026-09-25 07:00:00 ICT → same date
    const d = new Date('2026-09-25T00:00:00.000Z');
    const ictDate = formatIctDate(d);
    assert.match(ictDate, /25\/09\/2026/);
  });

  it('ranh giới cuối năm: 31/12 UTC đêm muộn = 01/01 ICT', () => {
    // 2026-12-31 23:00:00 UTC = 2027-01-01 06:00:00 ICT
    const d = new Date('2026-12-31T23:00:00.000Z');
    const ictDate = formatIctDate(d);
    assert.match(ictDate, /01\/01\/2027/);
  });
});

// ---------------------------------------------------------------------------
// 5. verifyDocumentSignature — boundary conditions
// ---------------------------------------------------------------------------
describe('verifyDocumentSignature — điều kiện biên', () => {
  it('signaturePayload null trả về isValid=false, isTampered=true, lỗi thiếu payload', async () => {
    const result = await verifyDocumentSignature('data', null as unknown as DocumentSignaturePayload);
    assert.equal(result.isValid, false);
    assert.equal(result.isTampered, true);
    assert.ok(result.errors.some((e) => e.includes('Signature payload missing')));
  });

  it('signatureValue quá ngắn (<16 ký tự) thất bại xác thực định dạng', async () => {
    const signer: SignerUserInput = { name: 'Test', title: 'Dev' };
    const payload = await createDocumentSignaturePayload('doc', signer, {
      documentNumber: 'NUM-001',
    });
    // Shorten signatureValue to < 16 chars
    payload.signatureValue = 'short';

    const result = await verifyDocumentSignature('doc', payload);
    assert.equal(result.validationDetails.signatureFormatValid, false);
    assert.ok(result.errors.some((e) => e.includes('Định dạng mã chữ ký số')));
  });

  it('thiếu sealStamp thì decree30Compliant=false (cảnh báo, không lỗi)', async () => {
    const signer: SignerUserInput = { name: 'Test', title: 'Dev' };
    // No documentNumber �� no sealStamp generated
    const payload = await createDocumentSignaturePayload('doc', signer);

    const result = await verifyDocumentSignature('doc', payload);
    assert.equal(result.validationDetails.decree30Compliant, false);
    assert.ok(result.warnings.some((w) => w.includes('Nghị định 30/2020')));
  });

  it('thiếu certificate thì isCertificateValid=false', async () => {
    const signer: SignerUserInput = { name: 'Test', title: 'Dev' };
    const payload = await createDocumentSignaturePayload('doc', signer);
    // Remove certificate
    (payload as unknown as Record<string, unknown>).certificate = undefined;

    const result = await verifyDocumentSignature('doc', payload);
    assert.equal(result.isCertificateValid, false);
    assert.ok(result.errors.some((e) => e.includes('Certificate missing')));
  });
});

// ---------------------------------------------------------------------------
// 6. createDocumentSignaturePayload — options variants
// ---------------------------------------------------------------------------
describe('createDocumentSignaturePayload — các biến thể tuỳ chọn', () => {
  const signer: SignerUserInput = {
    name: 'Nguyễn Thị Lan',
    title: 'Phó Hiệu trưởng',
    department: 'Ban Giám hiệu',
    organization: 'Trường CĐKTCN',
  };

  it('không có documentNumber thì sealStamp là undefined', async () => {
    const payload = await createDocumentSignaturePayload('nội dung', signer);
    assert.equal(payload.sealStamp, undefined);
  });

  it('includeSeal=false thì sealStamp là undefined dù có documentNumber', async () => {
    const payload = await createDocumentSignaturePayload('nội dung', signer, {
      documentNumber: 'VB-001',
      includeSeal: false,
    });
    assert.equal(payload.sealStamp, undefined);
  });

  it('signingTime tuỳ chỉnh phản ánh đúng trong signedAt', async () => {
    const customTime = new Date('2025-06-15T10:00:00.000Z');
    const payload = await createDocumentSignaturePayload('nội dung', signer, {
      signingTime: customTime,
    });
    assert.equal(payload.signedAt, customTime.toISOString());
  });

  it('role tuỳ chỉnh phản ánh đúng trong signerRole', async () => {
    const payload = await createDocumentSignaturePayload('nội dung', signer, {
      role: 'Trưởng phòng Đào tạo',
    });
    assert.equal(payload.signerRole, 'Trưởng phòng Đào tạo');
  });

  it('không có role và signer.title thì signerRole mặc định "Người ký"', async () => {
    const minimalSigner: SignerUserInput = { name: 'Trần Văn A' };
    const payload = await createDocumentSignaturePayload('nội dung', minimalSigner);
    assert.equal(payload.signerRole, 'Người ký');
  });
});
