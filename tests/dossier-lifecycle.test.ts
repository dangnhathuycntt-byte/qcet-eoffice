/**
 * QCET E-Office: Comprehensive Dossier Lifecycle Integration Test Suite
 * Sprint 6 - Workstream 6.4 (Dossier Lifecycle & Archival Domain)
 *
 * Invariants Verified:
 * 1. Lifecycle State Machine: OPEN -> ACTIVE -> CLOSED -> READY_FOR_ARCHIVE -> SUBMITTED_TO_ARCHIVE -> ACCEPTED -> ARCHIVED
 * 2. Multi-Entity Linking: Seamlessly binds Documents, Tasks, and Meeting Resolutions
 * 3. Pre-Close Verification: Enforces completion of linked tasks before closing dossier when required
 * 4. Immutability: Strictly prohibits adding/removing items once closed, submitted, or archived
 * 5. Separation of Duties (SoD): Submitter/Responsible Person cannot accept their own dossier into institutional archives
 * 6. Archival Finalization: Assigns storage location, physical shelf index, and archivist metadata
 */

import { describe, test, before } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import {
  DossierStatus,
  DossierItemType,
  DataClassification,
  UserRole,
  TaskStatus,
  TaskPriority,
  DocumentType,
  DocumentUrgency,
  MeetingStatus,
  UnitType,
  UnitStatus,
} from "@prisma/client";
import { DossierService } from "@/lib/services/dossier-service";
import {
  InvalidTransitionError,
  ForbiddenError,
  ValidationError,
  NotFoundError,
} from "@/server/api/errors";

describe("Sprint 6: Work Dossier Lifecycle & Archival Domain (Nghị định 30/2020/NĐ-CP)", () => {
  const testRunId = Date.now().toString(36);

  // Actors
  const officerUser = {
    id: `officer_${testRunId}`,
    email: `officer_${testRunId}@cdktcnqn.edu.vn`,
    name: "Nguyễn Văn Chuyên Viên",
    role: "CHUYEN_VIEN",
    userRole: UserRole.CHUYEN_VIEN,
  };

  const archivistUser = {
    id: `archivist_${testRunId}`,
    email: `archivist_${testRunId}@cdktcnqn.edu.vn`,
    name: "Trần Thị Văn Thư Lưu Trữ",
    role: "VAN_THU",
    activePositionCode: "VAN_THU",
    userRole: UserRole.VAN_THU,
  };

  const deanUser = {
    id: `dean_${testRunId}`,
    email: `dean_${testRunId}@cdktcnqn.edu.vn`,
    name: "Phạm Văn Trưởng Khoa",
    role: "TRUONG_KHOA",
    userRole: UserRole.TRUONG_PHONG,
  };

  let unitId: string;
  let retentionRuleId: string;
  let sampleTaskId: string;
  let sampleDocId: string;
  let sampleResolutionId: string;

  let testDossierId: string;
  let testDossierCode: string;

  before(async () => {
    // 1. Create test users
    await prisma.user.createMany({
      data: [
        {
          id: officerUser.id,
          email: officerUser.email,
          name: officerUser.name,
          role: officerUser.userRole,
        },
        {
          id: archivistUser.id,
          email: archivistUser.email,
          name: archivistUser.name,
          role: archivistUser.userRole,
        },
        {
          id: deanUser.id,
          email: deanUser.email,
          name: deanUser.name,
          role: deanUser.userRole,
        },
      ],
    });

    // 2. Create organizational unit
    const unit = await prisma.organizationalUnit.create({
      data: {
        code: `KCNTT_${testRunId.toUpperCase()}`,
        name: `Khoa Công nghệ Thông tin ${testRunId}`,
        type: UnitType.FACULTY,
        status: UnitStatus.ACTIVE,
      },
    });
    unitId = unit.id;

    // 3. Create canonical retention rule (Bảng thời hạn bảo quản hồ sơ)
    const retentionRule = await prisma.retentionRule.create({
      data: {
        code: `THBQ_${testRunId.toUpperCase()}`,
        name: "Hồ sơ đề án, kế hoạch đào tạo đại học và nghề nghiệp",
        durationYears: 10,
        legalBasis: "Thông tư 10/2022/TT-BNV và Quyết định 420/QĐ-CĐKTCNQN",
        description: "Bảo quản 10 năm đối với hồ sơ kế hoạch đào tạo",
      },
    });
    retentionRuleId = retentionRule.id;

    // 4. Create sample Task
    const task = await prisma.task.create({
      data: {
        code: `CV-${testRunId.toUpperCase()}`,
        title: "Xây dựng đề án tuyển sinh và chương trình đào tạo năm 2026",
        description: "Xây dựng dự thảo và xin ý kiến các bên liên quan",
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.HIGH,
        createdById: deanUser.id,
        academicMonth: 3,
        academicYear: "2025-2026",
        startDate: new Date(),
        dueDate: new Date(Date.now() + 86400000 * 30),
      },
    });
    sampleTaskId = task.id;

    // 5. Create sample Document
    const regNum = Math.floor(Math.random() * 800000) + 100000;
    const doc = await prisma.document.create({
      data: {
        type: DocumentType.VAN_BAN_DEN,
        registrationNumber: regNum,
        documentYear: 2026,
        originalNumber: "123/KH-UBND",
        issuedDate: new Date(),
        issuingAuthority: "UBND Tỉnh Bình Định",
        category: "Kế hoạch",
        summary: "Kế hoạch phát triển nhân lực công nghệ cao và CNTT giai đoạn 2026-2030",
        urgency: DocumentUrgency.THUONG,
        registeredById: archivistUser.id,
      },
    });
    sampleDocId = doc.id;

    // 6. Create sample Meeting & Resolution
    const meeting = await prisma.meeting.create({
      data: {
        title: "Phiên họp Hội đồng Khoa học & Đào tạo tháng 03/2026",
        status: MeetingStatus.MINUTES_CONFIRMED,
        startTime: new Date(),
        organizerId: deanUser.id,
        unitId: unitId,
      },
    });

    const resolution = await prisma.meetingResolution.create({
      data: {
        meetingId: meeting.id,
        code: `NQ-HĐKH-${testRunId.toUpperCase()}`,
        title: "Thông qua đề án tuyển sinh ngành An toàn thông tin năm học 2026-2027",
        content: "Hội đồng nhất trí 100% thông qua nội dung đề án tuyển sinh.",
        leadUnitId: unitId,
        leadUserId: deanUser.id,
      },
    });
    sampleResolutionId = resolution.id;
  });

  // =========================================================================
  // 1. OPEN STAGE: CREATE WORK DOSSIER
  // =========================================================================
  describe("1. Dossier Creation (OPEN Stage)", () => {
    test("Successfully creates a work dossier in OPEN state", async () => {
      const dossier = await DossierService.createDossier(officerUser, {
        title: "Hồ sơ xây dựng và phát triển chương trình đào tạo ngành An ninh mạng 2026",
        owningUnitId: unitId,
        responsiblePersonId: officerUser.id,
        retentionRuleId,
        classification: DataClassification.INTERNAL,
        storageLocation: "Tủ 04 - Ngăn 02 - Khoa CNTT",
        notes: "Hồ sơ công việc theo kế hoạch năm học",
      });

      assert.ok(dossier.id);
      assert.equal(dossier.status, DossierStatus.OPEN);
      assert.equal(dossier.owningUnitId, unitId);
      assert.equal(dossier.responsiblePersonId, officerUser.id);
      assert.equal(dossier.retentionRuleId, retentionRuleId);
      assert.ok(dossier.code.startsWith("HS-"));

      testDossierId = dossier.id;
      testDossierCode = dossier.code;
    });

    test("Rejects creation with empty title or invalid unit", async () => {
      await assert.rejects(
        async () => {
          await DossierService.createDossier(officerUser, {
            title: "",
            owningUnitId: unitId,
          });
        },
        (err: any) => err instanceof ValidationError
      );

      await assert.rejects(
        async () => {
          await DossierService.createDossier(officerUser, {
            title: "Hồ sơ hợp lệ",
            owningUnitId: "non_existent_unit_id",
          });
        },
        (err: any) => err instanceof NotFoundError
      );
    });
  });

  // =========================================================================
  // 2. ACTIVE STAGE: LINKING ENTITIES (TASK, DOCUMENT, RESOLUTION)
  // =========================================================================
  describe("2. Adding Items & Entity Linking (ACTIVE Stage)", () => {
    let docItemId: string;

    test("Transitions from OPEN to ACTIVE upon adding the first item", async () => {
      const item = await DossierService.addItemToDossier(officerUser, {
        dossierId: testDossierId,
        itemType: DossierItemType.DOCUMENT,
        title: "Bản dự thảo thuyết minh đề án An ninh mạng",
        documentNumber: "01/DT-TM",
        pageCount: 15,
        sequence: 1,
      });

      assert.ok(item.id);
      assert.equal(item.dossierId, testDossierId);
      docItemId = item.id;

      // Verify dossier transitioned to ACTIVE
      const dossier = await prisma.workDossier.findUnique({
        where: { id: testDossierId },
      });
      assert.equal(dossier?.status, DossierStatus.ACTIVE);
    });

    test("Links Document to Dossier via linkDocument()", async () => {
      const item = await DossierService.linkDocument(officerUser, {
        dossierId: testDossierId,
        documentId: sampleDocId,
        notes: "Văn bản căn cứ pháp lý từ UBND tỉnh",
      });

      assert.ok(item.id);
      assert.equal(item.itemType, DossierItemType.DOCUMENT);
      assert.equal(item.itemId, sampleDocId);
      assert.match(item.title, /Kế hoạch phát triển nhân lực/);
    });

    test("Links Task to Dossier via linkTask()", async () => {
      const item = await DossierService.linkTask(officerUser, {
        dossierId: testDossierId,
        taskId: sampleTaskId,
        notes: "Nhiệm vụ trực tiếp thực hiện đề án",
      });

      assert.ok(item.id);
      assert.equal(item.itemType, DossierItemType.TASK);
      assert.equal(item.itemId, sampleTaskId);
      assert.match(item.title, /Xây dựng đề án tuyển sinh/);
    });

    test("Links Meeting Resolution to Dossier via linkMeetingResolution()", async () => {
      const item = await DossierService.linkMeetingResolution(officerUser, {
        dossierId: testDossierId,
        resolutionId: sampleResolutionId,
        notes: "Nghị quyết phê duyệt của Hội đồng KH&ĐT",
      });

      assert.ok(item.id);
      assert.equal(item.itemType, DossierItemType.DECISION);
      assert.equal(item.itemId, sampleResolutionId);
      assert.match(item.title, /Thông qua đề án tuyển sinh ngành An toàn thông tin/);
    });

    test("Allows removing an item during ACTIVE stage", async () => {
      const result = await DossierService.removeItemFromDossier(officerUser, {
        dossierId: testDossierId,
        itemId: docItemId,
      });
      assert.equal(result.success, true);

      const check = await prisma.dossierItem.findUnique({
        where: { id: docItemId },
      });
      assert.equal(check, null);
    });
  });

  // =========================================================================
  // 3. CLOSED STAGE: PRE-CLOSE COMPLETION CHECKS & IMMUTABILITY
  // =========================================================================
  describe("3. Closing Dossier & Pre-Close Validation (CLOSED Stage)", () => {
    test("Rejects closing dossier if linked tasks are not completed and requireAllTasksCompleted is true", async () => {
      // sampleTaskId is currently IN_PROGRESS
      await assert.rejects(
        async () => {
          await DossierService.closeDossier(officerUser, {
            dossierId: testDossierId,
            requireAllTasksCompleted: true,
            notes: "Cố gắng đóng khi nhiệm vụ chưa hoàn thành",
          });
        },
        (err: any) => {
          assert.ok(err instanceof ValidationError);
          assert.match(err.message, /nhiệm vụ chưa hoàn thành/);
          return true;
        }
      );
    });

    test("Successfully closes dossier once linked task is marked completed", async () => {
      // Mark linked task as COMPLETED
      await prisma.task.update({
        where: { id: sampleTaskId },
        data: { status: TaskStatus.COMPLETED },
      });

      const closedDossier = await DossierService.closeDossier(officerUser, {
        dossierId: testDossierId,
        requireAllTasksCompleted: true,
        notes: "Đã hoàn thành toàn bộ các công việc và văn bản trong đề án",
      });

      assert.equal(closedDossier.status, DossierStatus.CLOSED);
      assert.ok(closedDossier.closedAt);
    });

    test("Enforces Immutability: Rejects adding new items to CLOSED dossier", async () => {
      await assert.rejects(
        async () => {
          await DossierService.addItemToDossier(officerUser, {
            dossierId: testDossierId,
            itemType: DossierItemType.DOCUMENT,
            title: "Tài liệu bổ sung sau khi đóng hồ sơ",
          });
        },
        (err: any) => {
          assert.ok(err instanceof InvalidTransitionError);
          assert.match(err.message, /Không thể thêm tài liệu vào hồ sơ đã đóng/);
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 4. READY_FOR_ARCHIVE & SUBMITTED_TO_ARCHIVE STAGES
  // =========================================================================
  describe("4. Archival Preparation & Submission (READY_FOR_ARCHIVE & SUBMITTED)", () => {
    test("Marks dossier as READY_FOR_ARCHIVE when retention rule is present", async () => {
      const readyDossier = await DossierService.markReadyForArchive(officerUser, {
        dossierId: testDossierId,
        notes: "Đã kiểm tra đủ mục lục và biên mục hồ sơ",
      });

      assert.equal(readyDossier.status, DossierStatus.READY_FOR_ARCHIVE);
    });

    test("Submits dossier to institutional archives (SUBMITTED_TO_ARCHIVE)", async () => {
      const submitted = await DossierService.submitArchive(officerUser, {
        dossierId: testDossierId,
        notes: "Kính chuyển Bộ phận Văn thư - Lưu trữ tiếp nhận hồ sơ",
      });

      assert.equal(submitted.status, DossierStatus.SUBMITTED_TO_ARCHIVE);
      assert.ok(submitted.submittedArchiveAt);
      assert.equal(submitted.submittedById, officerUser.id);
    });

    test("Rejects re-submitting already submitted dossier", async () => {
      await assert.rejects(
        async () => {
          await DossierService.submitArchive(officerUser, {
            dossierId: testDossierId,
          });
        },
        (err: any) => err instanceof InvalidTransitionError
      );
    });
  });

  // =========================================================================
  // 5. ACCEPTED & ARCHIVED STAGES: SEPARATION OF DUTIES & FINAL ARCHIVE
  // =========================================================================
  describe("5. Archival Acceptance & Finalization (ACCEPTED & ARCHIVED)", () => {
    test("Enforces Separation of Duties (SoD): Submitter cannot accept their own dossier", async () => {
      await assert.rejects(
        async () => {
          // officerUser is both responsiblePerson and submitter
          await DossierService.acceptArchive(officerUser, {
            dossierId: testDossierId,
            status: DossierStatus.ACCEPTED,
          });
        },
        (err: any) => {
          assert.ok(err instanceof ForbiddenError);
          assert.match(err.message, /Vi phạm nguyên tắc phân công độc lập SoD/);
          return true;
        }
      );
    });

    test("Archivist successfully accepts dossier into institutional archives (ACCEPTED)", async () => {
      const accepted = await DossierService.acceptArchive(archivistUser, {
        dossierId: testDossierId,
        status: DossierStatus.ACCEPTED,
        storageLocation: "Kho lưu trữ cơ quan - Kệ B3 - Tầng 2",
        notes: "Đã kiểm tra tính toàn vẹn và thành phần tài liệu đạt yêu cầu",
      });

      assert.equal(accepted.status, DossierStatus.ACCEPTED);
      assert.equal(accepted.storageLocation, "Kho lưu trữ cơ quan - Kệ B3 - Tầng 2");
    });

    test("Archivist finalizes archiving into repository (ARCHIVED)", async () => {
      const finalized = await DossierService.finalizeArchive(archivistUser, {
        dossierId: testDossierId,
        storageLocation: "Kho lưu trữ cơ quan - Kệ B3 - Hộp số 12",
        notes: "Đã đóng hộp, lập thẻ kho và xếp vào giá lưu trữ",
      });

      assert.equal(finalized.status, DossierStatus.ARCHIVED);
      assert.ok(finalized.archivedAt);
      assert.equal(finalized.archivedById, archivistUser.id);
      assert.equal(finalized.storageLocation, "Kho lưu trữ cơ quan - Kệ B3 - Hộp số 12");
    });

    test("Enforces Absolute Immutability: ARCHIVED dossier rejects modifications", async () => {
      await assert.rejects(
        async () => {
          await DossierService.addItemToDossier(archivistUser, {
            dossierId: testDossierId,
            itemType: DossierItemType.DOCUMENT,
            title: "Không thể thêm tài liệu vào hồ sơ đã lưu trữ vĩnh viễn",
          });
        },
        (err: any) => err instanceof InvalidTransitionError
      );
    });
  });
});
