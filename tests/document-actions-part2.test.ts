import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { POST as presentRoute } from '@/app/api/documents/[id]/actions/present/route';
import { POST as rejectContentRoute } from '@/app/api/documents/[id]/actions/reject-content/route';
import { POST as resolveRoute } from '@/app/api/documents/[id]/actions/resolve/route';
import { POST as revisionRoute } from '@/app/api/documents/[id]/actions/revision/route';
import { POST as signRoute } from '@/app/api/documents/[id]/actions/sign/route';
import { POST as submitContentReviewRoute } from '@/app/api/documents/[id]/actions/submit-content-review/route';
import { POST as submitFormatCheckRoute } from '@/app/api/documents/[id]/actions/submit-format-check/route';
import { signSessionToken } from '@/lib/jwt-session';

describe('Document Action Routes (Part 2)', () => {
  let testUser: any;
  let token: string;

  before(async () => {
    testUser = await prisma.user.findFirst({
      where: { email: 'doc-action-part2-test@qcet.edu.vn' },
    });
    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          email: 'doc-action-part2-test@qcet.edu.vn',
          name: 'Doc Action Tester',
          role: 'CHUYEN_VIEN',
        },
      });
    }

    token = signSessionToken({
      id: testUser.id,
      email: testUser.email,
      name: testUser.name,
      role: 'CHUYEN_VIEN',
    });
  });

  after(async () => {
    if (testUser) {
      await prisma.user.deleteMany({
        where: { email: 'doc-action-part2-test@qcet.edu.vn' },
      });
    }
  });

  it('1. POST present/route validates input with PresentDocumentSchema and rejects invalid json', async () => {
    const req = new NextRequest('http://localhost:3000/api/documents/doc-1/actions/present', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: 'invalid-json',
    });

    const res = await presentRoute(req, { params: Promise.resolve({ id: 'doc-1' }) });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.code, 'VALIDATION_ERROR');
  });

  it('2. POST reject-content/route enforces CSRF protection and validates schema', async () => {
    // Missing CSRF with cookie auth
    const reqCsrf = new NextRequest('http://localhost:3000/api/documents/doc-1/actions/reject-content', {
      method: 'POST',
      headers: {
        Cookie: `authjs.session-token=${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notes: 'Cần sửa đổi' }),
    });

    const resCsrf = await rejectContentRoute(reqCsrf, { params: Promise.resolve({ id: 'doc-1' }) });
    assert.equal(resCsrf.status, 403);
    const bodyCsrf = await resCsrf.json();
    assert.equal(bodyCsrf.success, false);
    assert.equal(bodyCsrf.code, 'CSRF_VALIDATION_FAILED');
  });

  it('3. POST resolve/route requires resolutionSummary in body', async () => {
    const req = new NextRequest('http://localhost:3000/api/documents/doc-1/actions/resolve', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const res = await resolveRoute(req, { params: Promise.resolve({ id: 'doc-1' }) });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.code, 'VALIDATION_ERROR');
    assert.ok(body.fieldErrors?.resolutionSummary);
  });

  it('4. POST revision/route requires changeReason in body', async () => {
    const req = new NextRequest('http://localhost:3000/api/documents/doc-1/actions/revision', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'New title only' }),
    });

    const res = await revisionRoute(req, { params: Promise.resolve({ id: 'doc-1' }) });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.code, 'VALIDATION_ERROR');
    assert.ok(body.fieldErrors?.changeReason);
  });

  it('5. POST sign/route validates signatureType enum if provided', async () => {
    const req = new NextRequest('http://localhost:3000/api/documents/doc-1/actions/sign', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ signatureType: 'INVALID_TYPE' }),
    });

    const res = await signRoute(req, { params: Promise.resolve({ id: 'doc-1' }) });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.code, 'VALIDATION_ERROR');
    assert.ok(body.fieldErrors?.signatureType);
  });

  it('6. POST submit-content-review/route validates body schema correctly', async () => {
    const req = new NextRequest('http://localhost:3000/api/documents/doc-1/actions/submit-content-review', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ contentReviewerId: 'u-reviewer-1', notes: 'Kính trình duyệt' }),
    });

    const res = await submitContentReviewRoute(req, { params: Promise.resolve({ id: 'non-existent-doc' }) });
    // Should pass validation and reach service (which throws NOT_FOUND for non-existent-doc)
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.code, 'NOT_FOUND');
  });

  it('7. POST submit-format-check/route validates body schema correctly', async () => {
    const req = new NextRequest('http://localhost:3000/api/documents/doc-1/actions/submit-format-check', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ formatReviewerId: 'u-clerk-1', notes: 'Kiểm tra thể thức' }),
    });

    const res = await submitFormatCheckRoute(req, { params: Promise.resolve({ id: 'non-existent-doc' }) });
    // Should pass validation and reach service (which throws NOT_FOUND for non-existent-doc)
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.code, 'NOT_FOUND');
  });
});
