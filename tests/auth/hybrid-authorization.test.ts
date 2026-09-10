import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  authorize,
  assertAuthorized,
  isAuthorized,
  checkSeparationOfDuties,
  checkPortfolioAlignment,
  getResourceRelationships,
  isCapabilityAction,
  isSystemAdminUser,
  isExecutivePosition,
  isUnitLeaderPosition,
  SeparationOfPowersError,
  SeparationOfDutiesError,
  PortfolioMismatchError,
  DelegationExpiredError,
  NonDelegablePowerError,
  SingleDRIError,
  HybridAuthorizationError,
  TASK_CAPABILITIES,
  DOCUMENT_INCOMING_CAPABILITIES,
  DOCUMENT_OUTGOING_CAPABILITIES,
  DOSSIER_CAPABILITIES,
  SYSTEM_CAPABILITIES,
  NON_DELEGABLE_CAPABILITIES,
  type AuthenticatedUserContext,
  type AuthorizationResource,
  type AuthorizationContext,
  type ActiveDelegationGrantContext,
} from "../../src/lib/auth/hybrid-authorization";

describe("Hybrid Authorization Engine (QCET E-Office)", () => {
  // Mock Base Users
  const rectorUser: AuthenticatedUserContext = {
    id: "usr_rector_001",
    email: "tuong.pv@cdktcnqn.edu.vn",
    name: "Phạm Văn Tường",
    activePositionCode: "HIEU_TRUONG",
    portfolios: ["INSTITUTIONAL_STRATEGY"],
    isActive: true,
  };

  const viceRectorAcademic: AuthenticatedUserContext = {
    id: "usr_vr_acad_002",
    email: "kiem.tt@cdktcnqn.edu.vn",
    name: "Trần Trọng Kiệm",
    activePositionCode: "PHO_HIEU_TRUONG_DT",
    portfolios: ["ACADEMIC"],
    isActive: true,
  };

  const viceRectorLogistics: AuthenticatedUserContext = {
    id: "usr_vr_log_003",
    email: "nguyen.lx@cdktcnqn.edu.vn",
    name: "Lê Xuân Nguyên",
    activePositionCode: "PHO_HIEU_TRUONG_HC",
    portfolios: ["ADMINISTRATION_LOGISTICS"],
    isActive: true,
  };

  const departmentHead: AuthenticatedUserContext = {
    id: "usr_dept_head_004",
    email: "truc.vv@cdktcnqn.edu.vn",
    name: "Vũ Văn Trực",
    activePositionCode: "TRUONG_DON_VI",
    departmentId: "dept_qldt",
    isActive: true,
  };

  const deputyHead: AuthenticatedUserContext = {
    id: "usr_deputy_head_005",
    email: "deputy@cdktcnqn.edu.vn",
    name: "Phó Trưởng phòng QLĐT",
    activePositionCode: "PHO_TRUONG_DON_VI",
    departmentId: "dept_qldt",
    isActive: true,
  };

  const staffUser: AuthenticatedUserContext = {
    id: "usr_staff_006",
    email: "staff.a@cdktcnqn.edu.vn",
    name: "Nguyễn Văn A",
    activePositionCode: "GIANG_VIEN_CHUYEN_VIEN",
    departmentId: "dept_qldt",
    isActive: true,
  };

  const clerkUser: AuthenticatedUserContext = {
    id: "usr_clerk_007",
    email: "vanthu@cdktcnqn.edu.vn",
    name: "Cán bộ Văn thư",
    activePositionCode: "VAN_THU",
    departmentId: "dept_hcqt",
    isActive: true,
  };

  const archivistUser: AuthenticatedUserContext = {
    id: "usr_archivist_008",
    email: "luutru@cdktcnqn.edu.vn",
    name: "Cán bộ Lưu trữ",
    activePositionCode: "LUU_TRU",
    departmentId: "dept_hcqt",
    isActive: true,
  };

  const systemAdminUser: AuthenticatedUserContext = {
    id: "usr_sysadmin_009",
    email: "admin@cdktcnqn.edu.vn",
    name: "Quản trị viên Hệ thống",
    activePositionCode: "QUAN_TRI_HE_THONG",
    systemRole: "SYSTEM_ADMIN",
    isActive: true,
  };

  // --------------------------------------------------------------------------
  // 1. Capability Catalog Tests
  // --------------------------------------------------------------------------
  describe("1. Typed Capability Catalog", () => {
    test("defines all required task capabilities", () => {
      const requiredTaskActions = [
        "task.view",
        "task.create",
        "task.assign",
        "task.reassign",
        "task.update_execution",
        "task.submit_result",
        "task.review",
        "task.approve",
        "task.monitor",
        "task.remind",
        "task.close",
        "task.cancel",
      ];
      for (const action of requiredTaskActions) {
        assert.ok(
          TASK_CAPABILITIES.includes(action as any),
          `Missing task action: ${action}`
        );
        assert.equal(isCapabilityAction(action), true);
      }
    });

    test("defines all required document incoming capabilities", () => {
      const requiredIncoming = [
        "document.incoming.register",
        "document.incoming.present",
        "document.incoming.direct",
        "document.incoming.assign_unit",
        "document.incoming.assign_person",
        "document.incoming.execute",
      ];
      for (const action of requiredIncoming) {
        assert.ok(
          DOCUMENT_INCOMING_CAPABILITIES.includes(action as any),
          `Missing incoming action: ${action}`
        );
        assert.equal(isCapabilityAction(action), true);
      }
    });

    test("defines all required document outgoing capabilities", () => {
      const requiredOutgoing = [
        "document.outgoing.draft",
        "document.outgoing.review_content",
        "document.outgoing.review_format",
        "document.outgoing.sign",
        "document.outgoing.number",
        "document.outgoing.organization_sign",
        "document.outgoing.issue",
      ];
      for (const action of requiredOutgoing) {
        assert.ok(
          DOCUMENT_OUTGOING_CAPABILITIES.includes(action as any),
          `Missing outgoing action: ${action}`
        );
        assert.equal(isCapabilityAction(action), true);
      }
    });

    test("defines all required dossier capabilities", () => {
      const requiredDossier = [
        "dossier.open",
        "dossier.add_item",
        "dossier.close",
        "dossier.transfer_archive",
        "dossier.accept_archive",
      ];
      for (const action of requiredDossier) {
        assert.ok(
          DOSSIER_CAPABILITIES.includes(action as any),
          `Missing dossier action: ${action}`
        );
        assert.equal(isCapabilityAction(action), true);
      }
    });

    test("defines all required system capabilities", () => {
      const requiredSystem = [
        "account.manage",
        "org.manage",
        "position.manage",
        "system.configure",
        "audit.view",
      ];
      for (const action of requiredSystem) {
        assert.ok(
          SYSTEM_CAPABILITIES.includes(action as any),
          `Missing system action: ${action}`
        );
        assert.equal(isCapabilityAction(action), true);
      }
    });
  });

  // --------------------------------------------------------------------------
  // 2. Step 1: Authentication & Identity Status
  // --------------------------------------------------------------------------
  describe("2. Step 1: Authentication & Identity Status", () => {
    const sampleResource: AuthorizationResource = {
      id: "task_001",
      type: "task",
    };

    test("rejects unauthenticated requests (null user)", async () => {
      const res = await authorize(null as any, "task.view", sampleResource);
      assert.equal(res.allowed, false);
      assert.equal(res.granted, false);
      assert.equal(res.rejectionCode, "UNAUTHENTICATED");
      assert.equal(res.statusCode, "UNAUTHENTICATED");
    });

    test("rejects deactivated account", async () => {
      const deactivatedUser = { ...staffUser, isActive: false };
      const res = await authorize(deactivatedUser, "task.view", sampleResource);
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, "DEACTIVATED_ACCOUNT");
    });

    test("rejects account with deactivatedAt set", async () => {
      const deactivatedUser = {
        ...staffUser,
        deactivatedAt: new Date("2026-01-01"),
      };
      const res = await authorize(deactivatedUser, "task.view", sampleResource);
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, "DEACTIVATED_ACCOUNT");
    });

    test("rejects invalid session token", async () => {
      const invalidSessionUser = { ...staffUser, sessionTokenValid: false };
      const res = await authorize(invalidSessionUser, "task.view", sampleResource);
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, "UNAUTHENTICATED");
    });
  });

  // --------------------------------------------------------------------------
  // 3. Step 2: Legal Hard Invariants
  // --------------------------------------------------------------------------
  describe("3. Step 2: Legal Hard Invariants (Data Classification)", () => {
    test("strictly prohibits STATE_SECRET documents even for Rector", async () => {
      const secretResource: AuthorizationResource = {
        id: "doc_secret_999",
        type: "document_incoming",
        classification: "STATE_SECRET",
      };

      const res = await authorize(rectorUser, "document.incoming.direct", secretResource);
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, "STATE_SECRET_STRICT_PROHIBITION");
      assert.equal(res.statusCode, "STATE_SECRET_STRICT_PROHIBITION");
    });

    test("strictly prohibits TUYET_MAT documents", async () => {
      const secretResource: AuthorizationResource = {
        id: "doc_secret_998",
        type: "document_outgoing",
        securityLevel: "TUYET_MAT",
      };

      const res = await authorize(rectorUser, "document.outgoing.sign", secretResource);
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, "STATE_SECRET_STRICT_PROHIBITION");
    });

    test("blocks unauthorized access to PERSONAL data without legal basis", async () => {
      const personalResource: AuthorizationResource = {
        id: "task_personal_123",
        type: "task",
        classification: "PERSONAL",
        targetUserId: "usr_other_person",
      };

      const res = await authorize(staffUser, "task.view", personalResource, {
        hasConsentOrLegalBasis: false,
      });
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, "PERSONAL_DATA_PRIVACY_BREACH");
    });

    test("allows data subject to access their own PERSONAL data", async () => {
      const personalResource: AuthorizationResource = {
        id: "task_personal_self",
        type: "task",
        classification: "PERSONAL",
        targetUserId: staffUser.id,
        primaryOwnerId: staffUser.id,
      };

      const res = await authorize(staffUser, "task.view", personalResource);
      assert.equal(res.allowed, true);
      assert.equal(res.statusCode, "GRANTED");
    });
  });

  // --------------------------------------------------------------------------
  // 4. Step 3: Strict Separation of Powers (SoP)
  // --------------------------------------------------------------------------
  describe("4. Step 3: Strict Separation of Powers (SoP)", () => {
    const taskResource: AuthorizationResource = {
      id: "task_business_001",
      type: "task",
      departmentId: "dept_qldt",
      primaryOwnerId: staffUser.id,
    };

    const docResource: AuthorizationResource = {
      id: "doc_business_001",
      type: "document_outgoing",
      draftingDeptId: "dept_qldt",
    };

    test("denies System Admin from creating business tasks", async () => {
      const res = await authorize(systemAdminUser, "task.create", taskResource);
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, "SEPARATION_OF_POWERS_VIOLATION");
    });

    test("denies System Admin from approving business tasks", async () => {
      const res = await authorize(systemAdminUser, "task.approve", taskResource);
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, "SEPARATION_OF_POWERS_VIOLATION");
    });

    test("denies System Admin from signing official documents", async () => {
      const res = await authorize(systemAdminUser, "document.outgoing.sign", docResource);
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, "SEPARATION_OF_POWERS_VIOLATION");
    });

    test("denies System Admin from directing incoming documents", async () => {
      const res = await authorize(systemAdminUser, "document.incoming.direct", {
        id: "doc_in_1",
        type: "document_incoming",
      });
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, "SEPARATION_OF_POWERS_VIOLATION");
    });

    test("allows System Admin to perform infrastructure capabilities", async () => {
      const sysResource: AuthorizationResource = {
        id: "sys_account_1",
        type: "system",
      };

      const manageAccount = await authorize(systemAdminUser, "account.manage", sysResource);
      assert.equal(manageAccount.allowed, true);
      assert.equal(manageAccount.statusCode, "GRANTED");

      const configSystem = await authorize(systemAdminUser, "system.configure", sysResource);
      assert.equal(configSystem.allowed, true);
      assert.equal(configSystem.statusCode, "GRANTED");

      const viewAudit = await authorize(systemAdminUser, "audit.view", sysResource);
      assert.equal(viewAudit.allowed, true);
      assert.equal(viewAudit.statusCode, "GRANTED");

      const monitorTasks = await authorize(systemAdminUser, "task.monitor", taskResource);
      assert.equal(monitorTasks.allowed, true);
      assert.equal(monitorTasks.statusCode, "GRANTED");
    });

    test("denies non-admin staff from executing system infrastructure capabilities", async () => {
      const sysResource: AuthorizationResource = {
        id: "sys_conf_1",
        type: "system",
      };

      const res = await authorize(staffUser, "system.configure", sysResource);
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, "INSUFFICIENT_CAPABILITY");
    });
  });

  // --------------------------------------------------------------------------
  // 5. Step 4: Separation of Duties (SoD)
  // --------------------------------------------------------------------------
  describe("5. Step 4: Separation of Duties (SoD)", () => {
    test("enforces Creator != Approver: creator cannot approve own task", async () => {
      const ownTask: AuthorizationResource = {
        id: "task_dept_self",
        type: "task",
        createdById: departmentHead.id,
        departmentId: departmentHead.departmentId,
        primaryOwnerId: staffUser.id,
      };

      const res = await authorize(departmentHead, "task.approve", ownTask);
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, "SOD_VIOLATION");
    });

    test("enforces Primary Owner != Approver: primary owner cannot approve own task", async () => {
      const ownLeadTask: AuthorizationResource = {
        id: "task_dept_lead",
        type: "task",
        createdById: "usr_some_other_creator",
        departmentId: departmentHead.departmentId,
        primaryOwnerId: departmentHead.id,
      };

      const res = await authorize(departmentHead, "task.approve", ownLeadTask);
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, "SOD_VIOLATION");
    });

    test("enforces Executor != Reviewer: submitter cannot review own product", async () => {
      const deliverableTask: AuthorizationResource = {
        id: "task_deliv_1",
        type: "task",
        departmentId: departmentHead.departmentId,
        primaryOwnerId: staffUser.id,
        submittedByUserId: departmentHead.id,
      };

      const res = await authorize(departmentHead, "task.review", deliverableTask);
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, "SOD_VIOLATION");
    });

    test("enforces Signer != Numberer: document signer cannot number document", async () => {
      const signedDoc: AuthorizationResource = {
        id: "doc_out_signed",
        type: "document_outgoing",
        signerId: clerkUser.id,
      };

      const res = await authorize(clerkUser, "document.outgoing.number", signedDoc);
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, "SOD_VIOLATION");
    });

    test("enforces Signer != Organization Signer: document signer cannot apply org seal", async () => {
      const signedDoc: AuthorizationResource = {
        id: "doc_out_signed_seal",
        type: "document_outgoing",
        signerId: clerkUser.id,
      };

      const res = await authorize(clerkUser, "document.outgoing.organization_sign", signedDoc);
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, "SOD_VIOLATION");
    });

    test("enforces Numberer != Signer: clerk who numbered document cannot sign as executive", async () => {
      const numberedDoc: AuthorizationResource = {
        id: "doc_out_numbered",
        type: "document_outgoing",
        numbererId: rectorUser.id,
      };

      const res = await authorize(rectorUser, "document.outgoing.sign", numberedDoc);
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, "SOD_VIOLATION");
    });
  });

  // --------------------------------------------------------------------------
  // 6. Step 5: Resource Relationship (ReBAC) & Single DRI Rule
  // --------------------------------------------------------------------------
  describe("6. Step 5: ReBAC & Single DRI Rule", () => {
    test("calculates relationship flags accurately", () => {
      const task: AuthorizationResource = {
        id: "task_multi_rel",
        type: "task",
        createdById: departmentHead.id,
        departmentId: "dept_qldt",
        primaryOwnerId: staffUser.id,
        collaboratorIds: ["usr_collab_1", "usr_collab_2"],
        reviewerIds: ["usr_rev_1"],
        approverIds: ["usr_app_1"],
        observerIds: ["usr_obs_1"],
      };

      const relsCreator = getResourceRelationships(departmentHead, task);
      assert.equal(relsCreator.has("ASSIGNER"), true);
      assert.equal(relsCreator.has("LEAD_UNIT"), true);
      assert.equal(relsCreator.has("DRI"), false);

      const relsDri = getResourceRelationships(staffUser, task);
      assert.equal(relsDri.has("DRI"), true);
      assert.equal(relsDri.has("LEAD_UNIT"), true);
      assert.equal(relsDri.has("COLLABORATOR"), false);

      const collabUser: AuthenticatedUserContext = {
        id: "usr_collab_1",
        activePositionCode: "GIANG_VIEN_CHUYEN_VIEN",
      };
      const relsCollab = getResourceRelationships(collabUser, task);
      assert.equal(relsCollab.has("COLLABORATOR"), true);
      assert.equal(relsCollab.has("DRI"), false);
    });

    test("Single DRI rule: collaborator cannot reassign DRI", async () => {
      const task: AuthorizationResource = {
        id: "task_with_collab",
        type: "task",
        departmentId: "dept_cntt",
        primaryOwnerId: "usr_original_dri",
        collaboratorIds: [staffUser.id],
      };

      const res = await authorize(staffUser, "task.reassign", task);
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, "COLLABORATOR_CANNOT_REASSIGN_DRI");
      assert.equal(res.statusCode, "SINGLE_DRI_VIOLATION");
    });

    test("Department Head can reassign DRI within department", async () => {
      const task: AuthorizationResource = {
        id: "task_reassign_by_head",
        type: "task",
        departmentId: departmentHead.departmentId,
        createdById: departmentHead.id,
        primaryOwnerId: staffUser.id,
      };

      const res = await authorize(departmentHead, "task.reassign", task);
      assert.equal(res.allowed, true);
      assert.equal(res.statusCode, "GRANTED");
    });

    test("denies non-DRI non-collaborator from updating task execution", async () => {
      const task: AuthorizationResource = {
        id: "task_other_dept",
        type: "task",
        departmentId: "dept_khac",
        primaryOwnerId: "usr_other_worker",
        collaboratorIds: ["usr_worker_2"],
      };

      const res = await authorize(staffUser, "task.update_execution", task);
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, "INSUFFICIENT_RELATIONSHIP");
    });

    test("allows primary owner (DRI) to update execution and submit result", async () => {
      const task: AuthorizationResource = {
        id: "task_my_work",
        type: "task",
        departmentId: staffUser.departmentId,
        primaryOwnerId: staffUser.id,
      };

      const updateRes = await authorize(staffUser, "task.update_execution", task);
      assert.equal(updateRes.allowed, true);

      const submitRes = await authorize(staffUser, "task.submit_result", task);
      assert.equal(submitRes.allowed, true);
    });
  });

  // --------------------------------------------------------------------------
  // 7. Step 6: ABAC, Portfolio Alignment & Delegation
  // --------------------------------------------------------------------------
  describe("7. Step 6: Portfolio Alignment & Delegation Checking", () => {
    test("Rector has universal portfolio authority (Scenario 1)", async () => {
      const academicTask: AuthorizationResource = {
        id: "task_acad_1",
        type: "task",
        portfolio: "ACADEMIC",
        createdById: "usr_dept_head",
      };

      const res = await authorize(rectorUser, "task.approve", academicTask);
      assert.equal(res.allowed, true);
      assert.equal(res.statusCode, "GRANTED");
    });

    test("Vice Rector Academic can approve tasks in ACADEMIC portfolio", async () => {
      const academicTask: AuthorizationResource = {
        id: "task_acad_2",
        type: "task",
        portfolio: "ACADEMIC",
        createdById: departmentHead.id,
      };

      const res = await authorize(viceRectorAcademic, "task.approve", academicTask);
      assert.equal(res.allowed, true);
      assert.equal(res.statusCode, "GRANTED");
    });

    test("Vice Rector Academic denied when acting in ADMINISTRATION_LOGISTICS portfolio (Cross-portfolio)", async () => {
      const logisticsDoc: AuthorizationResource = {
        id: "doc_dorm_repair",
        type: "document_outgoing",
        portfolio: "ADMINISTRATION_LOGISTICS",
        draftingDeptId: "dept_hcqt",
      };

      const res = await authorize(viceRectorAcademic, "document.outgoing.sign_kt", logisticsDoc);
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, "PORTFOLIO_MISMATCH");
    });

    test("Vice Rector Academic can sign cross-portfolio doc when holding valid DelegationGrant", async () => {
      const validDelegation: ActiveDelegationGrantContext = {
        id: "del_grant_001",
        grantorUserId: viceRectorLogistics.id,
        granteeUserId: viceRectorAcademic.id,
        capability: "document.outgoing.sign_kt",
        responsibilityArea: "ADMINISTRATION_LOGISTICS",
        validFrom: new Date("2026-09-01"),
        validUntil: new Date("2026-09-30"),
        status: "ACTIVE",
        sourceDocumentNumber: "TB-619/TB-CDKTCNQN",
      };

      const delegatedViceRector: AuthenticatedUserContext = {
        ...viceRectorAcademic,
        delegationGrants: [validDelegation],
      };

      const logisticsDoc: AuthorizationResource = {
        id: "doc_dorm_repair_with_del",
        type: "document_outgoing",
        portfolio: "ADMINISTRATION_LOGISTICS",
        draftingDeptId: "dept_hcqt",
      };

      const now = new Date("2026-09-10");
      const res = await authorize(delegatedViceRector, "document.outgoing.sign_kt", logisticsDoc, {}, now);
      assert.equal(res.allowed, true);
      assert.equal(res.statusCode, "GRANTED");
      assert.equal(res.delegationContext?.isDelegated, true);
      assert.equal(res.delegationContext?.sourceDocument, "TB-619/TB-CDKTCNQN");
    });

    test("rejects expired DelegationGrant", async () => {
      const expiredDelegation: ActiveDelegationGrantContext = {
        id: "del_grant_expired",
        grantorUserId: viceRectorLogistics.id,
        granteeUserId: viceRectorAcademic.id,
        capability: "document.outgoing.sign_kt",
        responsibilityArea: "ADMINISTRATION_LOGISTICS",
        validFrom: new Date("2026-08-01"),
        validUntil: new Date("2026-08-31"),
        status: "ACTIVE",
      };

      const delegatedViceRector: AuthenticatedUserContext = {
        ...viceRectorAcademic,
        delegationGrants: [expiredDelegation],
      };

      const logisticsDoc: AuthorizationResource = {
        id: "doc_expired_check",
        type: "document_outgoing",
        portfolio: "ADMINISTRATION_LOGISTICS",
      };

      const now = new Date("2026-09-10");
      const res = await authorize(delegatedViceRector, "document.outgoing.sign_kt", logisticsDoc, {}, now);
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, "DELEGATION_EXPIRED");
    });

    test("rejects revoked DelegationGrant", async () => {
      const revokedDelegation: ActiveDelegationGrantContext = {
        id: "del_grant_revoked",
        grantorUserId: viceRectorLogistics.id,
        granteeUserId: viceRectorAcademic.id,
        capability: "document.outgoing.sign_kt",
        responsibilityArea: "ADMINISTRATION_LOGISTICS",
        validFrom: new Date("2026-09-01"),
        validUntil: new Date("2026-09-30"),
        status: "REVOKED",
        revokedAt: new Date("2026-09-05"),
      };

      const delegatedViceRector: AuthenticatedUserContext = {
        ...viceRectorAcademic,
        delegationGrants: [revokedDelegation],
      };

      const logisticsDoc: AuthorizationResource = {
        id: "doc_revoked_check",
        type: "document_outgoing",
        portfolio: "ADMINISTRATION_LOGISTICS",
      };

      const now = new Date("2026-09-10");
      const res = await authorize(delegatedViceRector, "document.outgoing.sign_kt", logisticsDoc, {}, now);
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, "DELEGATION_REVOKED");
    });

    test("strictly rejects delegation of statutory non-delegable capabilities", async () => {
      const nonDelegableGrant: ActiveDelegationGrantContext = {
        id: "del_illegal_grant",
        grantorUserId: rectorUser.id,
        granteeUserId: viceRectorAcademic.id,
        capability: "position.manage_leadership",
        validFrom: new Date("2026-09-01"),
        validUntil: new Date("2026-09-30"),
        status: "ACTIVE",
      };

      const delegatedUser: AuthenticatedUserContext = {
        ...viceRectorAcademic,
        delegationGrants: [nonDelegableGrant],
      };

      const res = await authorize(
        delegatedUser,
        "position.manage_leadership" as any,
        { id: "pos_lead_1", type: "system" },
        {},
        new Date("2026-09-10")
      );
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, "NON_DELEGABLE_POWER_VIOLATION");
    });

    test("rejects delegate attempting self-approval (Scenario 5B)", async () => {
      const validDelegation: ActiveDelegationGrantContext = {
        id: "del_deputy_approval",
        grantorUserId: departmentHead.id,
        granteeUserId: deputyHead.id,
        capability: "task.approve",
        validFrom: new Date("2026-09-01"),
        validUntil: new Date("2026-09-30"),
        status: "ACTIVE",
        sourceDocumentNumber: "QD-142/QD-CDKTCN",
      };

      const delegatedDeputy: AuthenticatedUserContext = {
        ...deputyHead,
        delegationGrants: [validDelegation],
      };

      // Deputy's own personal task
      const deputySelfTask: AuthorizationResource = {
        id: "task_deputy_self",
        type: "task",
        createdById: deputyHead.id,
        primaryOwnerId: deputyHead.id,
        departmentId: deputyHead.departmentId,
      };

      const res = await authorize(
        delegatedDeputy,
        "task.approve",
        deputySelfTask,
        {},
        new Date("2026-09-10")
      );
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, "SOD_VIOLATION");
    });

    test("allows delegate approving peer staff task under valid delegation (Scenario 5A)", async () => {
      const validDelegation: ActiveDelegationGrantContext = {
        id: "del_deputy_peer_approval",
        grantorUserId: departmentHead.id,
        granteeUserId: deputyHead.id,
        capability: "task.approve",
        validFrom: new Date("2026-09-01"),
        validUntil: new Date("2026-09-30"),
        status: "ACTIVE",
        sourceDocumentNumber: "QD-142/QD-CDKTCN",
      };

      const delegatedDeputy: AuthenticatedUserContext = {
        ...deputyHead,
        delegationGrants: [validDelegation],
      };

      const peerStaffTask: AuthorizationResource = {
        id: "task_peer_staff",
        type: "task",
        createdById: departmentHead.id,
        primaryOwnerId: staffUser.id,
        submittedByUserId: staffUser.id,
        departmentId: deputyHead.departmentId,
      };

      const res = await authorize(
        delegatedDeputy,
        "task.approve",
        peerStaffTask,
        {},
        new Date("2026-09-10")
      );
      assert.equal(res.allowed, true);
      assert.equal(res.statusCode, "GRANTED");
      assert.equal(res.delegationContext?.isDelegated, true);
    });
  });

  // --------------------------------------------------------------------------
  // 8. Step 7: Master Capability Matrix & Role Invariants
  // --------------------------------------------------------------------------
  describe("8. Step 7: Master Capability Matrix Resolution", () => {
    test("Clerk (VAN_THU) can number and stamp documents, but cannot sign leadership docs", async () => {
      const doc: AuthorizationResource = {
        id: "doc_for_clerk",
        type: "document_outgoing",
        signerId: rectorUser.id,
      };

      const numRes = await authorize(clerkUser, "document.outgoing.number", doc);
      assert.equal(numRes.allowed, true);

      const orgSignRes = await authorize(clerkUser, "document.outgoing.organization_sign", doc);
      assert.equal(orgSignRes.allowed, true);

      const formatRes = await authorize(clerkUser, "document.outgoing.review_format", doc);
      assert.equal(formatRes.allowed, true);

      const signRes = await authorize(clerkUser, "document.outgoing.sign", doc);
      assert.equal(signRes.allowed, false);
      assert.equal(signRes.rejectionCode, "INSUFFICIENT_CAPABILITY");
    });

    test("Archivist (LUU_TRU) can accept archive, but cannot register incoming docs", async () => {
      const dossier: AuthorizationResource = {
        id: "dossier_001",
        type: "dossier",
      };

      const acceptRes = await authorize(archivistUser, "dossier.accept_archive", dossier);
      assert.equal(acceptRes.allowed, true);

      const regRes = await authorize(archivistUser, "document.incoming.register", {
        id: "doc_in_1",
        type: "document_incoming",
      });
      assert.equal(regRes.allowed, false);
      assert.equal(regRes.rejectionCode, "INSUFFICIENT_CAPABILITY");
    });

    test("Department Head cannot approve tasks outside their department", async () => {
      const foreignTask: AuthorizationResource = {
        id: "task_foreign_dept",
        type: "task",
        departmentId: "dept_other",
        createdById: "usr_foreign_creator",
        primaryOwnerId: "usr_foreign_dri",
      };

      const res = await authorize(departmentHead, "task.approve", foreignTask);
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, "DEPARTMENT_BOUNDARY_VIOLATION");
    });

    test("Deputy Head without delegation cannot approve tasks", async () => {
      const unitTask: AuthorizationResource = {
        id: "task_in_unit",
        type: "task",
        departmentId: deputyHead.departmentId,
        createdById: departmentHead.id,
        primaryOwnerId: staffUser.id,
      };

      const res = await authorize(deputyHead, "task.approve", unitTask);
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, "INSUFFICIENT_CAPABILITY");
    });
  });

  // --------------------------------------------------------------------------
  // 9. Helper Utilities & Error Classes
  // --------------------------------------------------------------------------
  describe("9. Helper Utilities & Error Classes", () => {
    test("assertAuthorized passes cleanly on granted action", async () => {
      const task: AuthorizationResource = {
        id: "task_clean_assert",
        type: "task",
        departmentId: staffUser.departmentId,
        primaryOwnerId: staffUser.id,
      };

      const res = await assertAuthorized(staffUser, "task.update_execution", task);
      assert.equal(res.allowed, true);
    });

    test("assertAuthorized throws SeparationOfPowersError for System Admin doing business", async () => {
      await assert.rejects(
        async () => {
          await assertAuthorized(systemAdminUser, "task.approve", {
            id: "t1",
            type: "task",
          });
        },
        (err: any) => {
          assert.ok(err instanceof SeparationOfPowersError);
          assert.equal(err.rejectionCode, "SEPARATION_OF_POWERS_VIOLATION");
          return true;
        }
      );
    });

    test("assertAuthorized throws SeparationOfDutiesError on SoD violation", async () => {
      await assert.rejects(
        async () => {
          await assertAuthorized(departmentHead, "task.approve", {
            id: "t2",
            type: "task",
            createdById: departmentHead.id,
          });
        },
        (err: any) => {
          assert.ok(err instanceof SeparationOfDutiesError);
          assert.equal(err.rejectionCode, "SOD_VIOLATION");
          return true;
        }
      );
    });

    test("assertAuthorized throws PortfolioMismatchError on portfolio mismatch", async () => {
      await assert.rejects(
        async () => {
          await assertAuthorized(viceRectorAcademic, "document.outgoing.sign_kt", {
            id: "d1",
            type: "document_outgoing",
            portfolio: "ADMINISTRATION_LOGISTICS",
          });
        },
        (err: any) => {
          assert.ok(err instanceof PortfolioMismatchError);
          assert.equal(err.rejectionCode, "PORTFOLIO_MISMATCH");
          return true;
        }
      );
    });

    test("isAuthorized returns boolean properly", async () => {
      const allowed = await isAuthorized(rectorUser, "task.view", {
        id: "t3",
        type: "task",
      });
      assert.equal(allowed, true);

      const denied = await isAuthorized(staffUser, "document.outgoing.sign", {
        id: "d3",
        type: "document_outgoing",
      });
      assert.equal(denied, false);
    });

    test("standalone checkSeparationOfDuties catches SoD violations", () => {
      const violation = checkSeparationOfDuties(
        staffUser,
        "task.approve",
        { id: "t", type: "task", primaryOwnerId: staffUser.id }
      );
      assert.equal(violation.valid, false);
      assert.equal(violation.rejectionCode, "SOD_VIOLATION");

      const clean = checkSeparationOfDuties(
        departmentHead,
        "task.approve",
        { id: "t", type: "task", primaryOwnerId: staffUser.id, createdById: "other" }
      );
      assert.equal(clean.valid, true);
    });

    test("standalone checkPortfolioAlignment validates correctly", () => {
      const mismatch = checkPortfolioAlignment(viceRectorAcademic, "task.approve", {
        id: "t",
        type: "task",
        portfolio: "ADMINISTRATION_LOGISTICS",
      });
      assert.equal(mismatch.valid, false);

      const rectorUniversal = checkPortfolioAlignment(rectorUser, "task.approve", {
        id: "t",
        type: "task",
        portfolio: "ADMINISTRATION_LOGISTICS",
      });
      assert.equal(rectorUniversal.valid, true);
    });
  });
});
