import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDocumentSha256,
  computeDocumentSha256Sync,
  canonicalizeData,
  generateSignatureCertificateInfo,
  generateSealStampData,
  verifyDocumentSignature,
  createDocumentSignaturePayload,
  formatIctDate,
  formatIctDateTime,
} from '../src/lib/crypto/digital-signature-service';

describe('Digital Signature & Stamping Service (QCVN 102:2016 & NĐ 30/2020)', () => {
  const sampleDocument = {
    documentId: 'DOC-2026-001',
    documentNumber: '125/QĐ-CĐKTCN',
    title: 'Quyết định ban hành Quy chế Công tác Văn thư điện tử',
    issuedDate: '2026-09-25T08:30:00.000Z',
    content: 'Ban hành kèm theo Quyết định này Quy chế Công tác Văn thư điện tử...',
    signerName: 'TS. Nguyễn Văn Hùng',
  };

  const sampleSigner = {
    id: 'usr_leader_01',
    name: 'TS. Nguyễn Văn Hùng',
    email: 'nguyenvanhung@qcet.edu.vn',
    title: 'Hiệu trưởng',
    department: 'Ban Giám hiệu',
    organization: 'Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn',
  };

  it('computes consistent SHA-256 hash across object key order variations', async () => {
    const doc1 = { b: 2, a: 1, c: { y: 'bar', x: 'foo' } };
    const doc2 = { a: 1, b: 2, c: { x: 'foo', y: 'bar' } };

    const hash1 = await computeDocumentSha256(doc1);
    const hash2 = await computeDocumentSha256(doc2);
    const syncHash = computeDocumentSha256Sync(doc1);

    assert.equal(hash1, hash2, 'Canonicalized hash must be identical regardless of key order');
    assert.equal(hash1, syncHash, 'Sync hash must match async WebCrypto hash');
    assert.equal(hash1.length, 64, 'SHA-256 hex string must be 64 characters');
  });

  it('formats ICT dates and datetimes correctly', () => {
    const testDate = new Date('2026-09-25T01:30:00.000Z'); // 08:30 in ICT
    const ictDate = formatIctDate(testDate);
    const ictDateTime = formatIctDateTime(testDate);

    assert.match(ictDate, /25\/09\/2026/);
    assert.match(ictDateTime, /25\/09\/2026/);
    assert.match(ictDateTime, /08:30:00/);
  });

  it('generates certificate info according to QCVN 102:2016 standard', () => {
    const fixedDate = new Date('2026-09-25T08:00:00.000Z');
    const cert = generateSignatureCertificateInfo(sampleSigner, 'Hiệu trưởng', fixedDate);

    assert.equal(cert.subjectName, sampleSigner.name);
    assert.equal(cert.subjectTitle, 'Hiệu trưởng');
    assert.equal(cert.subjectOrganization, sampleSigner.organization);
    assert.equal(cert.issuerName, 'Ban Cơ yếu Chính phủ (VGCA)');
    assert.equal(cert.standardCompliance, 'QCVN 102:2016/BTTTT & Nghị định 30/2020/NĐ-CP');
    assert.equal(cert.keyAlgorithm, 'RSA 2048-bit');
    assert.equal(cert.signatureAlgorithm, 'SHA256withRSA');
    assert.equal(cert.certificateStatus, 'ACTIVE');
    assert.ok(cert.serialNumber.length > 10, 'Serial number must be present and formatted');
  });

  it('generates electronic seal stamp according to Decree 30/2020/ND-CP', () => {
    const fixedDate = new Date('2026-09-25T08:00:00.000Z');
    const seal = generateSealStampData('125/QĐ-CĐKTCN', fixedDate);

    assert.equal(seal.sealType, 'ORGANIZATION_SEAL');
    assert.equal(seal.documentNumber, '125/QĐ-CĐKTCN');
    assert.equal(seal.stampStatus, 'VALID');
    assert.ok(seal.organizationName.includes('QUY NHƠN'));
    assert.ok(seal.securityCode.startsWith('QCET-SEAL-2026'));
  });

  it('successfully creates signature and verifies untampered document', async () => {
    const payload = await createDocumentSignaturePayload(sampleDocument, sampleSigner, {
      documentNumber: '125/QĐ-CĐKTCN',
      role: 'Hiệu trưởng',
    });

    assert.ok(payload.signatureId);
    assert.equal(payload.signerName, sampleSigner.name);
    assert.equal(payload.sealStamp?.documentNumber, '125/QĐ-CĐKTCN');

    const result = await verifyDocumentSignature(sampleDocument, payload);

    assert.equal(result.isValid, true, 'Verification should be valid for untampered document');
    assert.equal(result.isTampered, false, 'Document should not be marked as tampered');
    assert.equal(result.isCertificateValid, true);
    assert.equal(result.validationDetails.hashMatch, true);
    assert.equal(result.validationDetails.certTimeValid, true);
    assert.equal(result.validationDetails.certStatusActive, true);
    assert.equal(result.validationDetails.decree30Compliant, true);
    assert.equal(result.errors.length, 0);
  });

  it('detects tampering when document data is altered after signing', async () => {
    const payload = await createDocumentSignaturePayload(sampleDocument, sampleSigner, {
      documentNumber: '125/QĐ-CĐKTCN',
    });

    const tamperedDocument = {
      ...sampleDocument,
      content: 'Nội dung đã bị sửa đổi trái phép sau khi ký...',
    };

    const result = await verifyDocumentSignature(tamperedDocument, payload);

    assert.equal(result.isValid, false, 'Tampered document must fail verification');
    assert.equal(result.isTampered, true, 'Document must be flagged as tampered');
    assert.equal(result.validationDetails.hashMatch, false);
    assert.ok(result.errors.some((err) => err.includes('SHA-256 Hash Mismatch')));
  });

  it('handles expired or invalid certificate status correctly', async () => {
    const payload = await createDocumentSignaturePayload(sampleDocument, sampleSigner);

    // Force expired certificate
    payload.certificate.validTo = new Date('2020-01-01T00:00:00.000Z').toISOString();
    payload.certificate.certificateStatus = 'REVOKED';

    const result = await verifyDocumentSignature(sampleDocument, payload);

    assert.equal(result.isValid, false);
    assert.equal(result.isCertificateValid, false);
    assert.equal(result.validationDetails.certTimeValid, false);
    assert.equal(result.validationDetails.certStatusActive, false);
  });
});
