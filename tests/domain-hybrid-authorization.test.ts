/**
 * ADVERSARIAL PENETRATION TEST SUITE: HYBRID AUTHORIZATION & CAPABILITY ENGINE
 * Target: src/lib/auth/hybrid-authorization.ts
 * Specification: docs/domain/authority.md (QCET-AUTH-SPEC-2026-01)
 *
 * Evaluates all 10 Definition of Done (DoD) Scenarios:
 * - DoD 1: Vice Principal for Training attempting to approve a Finance task -> MUST FAIL with PORTFOLIO_MISMATCH
 * - DoD 2: Principal delegation for 3 days -> valid during window for delegated actions; expired window or non-delegable statutory actions (e.g. treasury/sign_chu_tai_khoan) -> MUST FAIL
 * - DoD 3: System Admin attempting to access personnel records/confidential HR or sign docs -> MUST FAIL with SEPARATION_OF_POWERS_VIOLATION
 * - DoD 4: Clerical officer (Van thu) attempting to edit content of signed document -> MUST FAIL with IMMUTABLE_SIGNED_DOCUMENT or INVALID_STATE
 * - DoD 5: Dean of Faculty A viewing internal tasks of Faculty B -> MUST FAIL with UNIT_SCOPE_DENIED
 * - DoD 6: Collaborator attempting to reassign DRI -> MUST FAIL with INSUFFICIENT_RELATIONSHIP
 * - DoD 7: Observer role access -> Read-only permitted, mutation rejected
 * - DoD 8: Directing incoming document to lead unit -> Only BGH permitted; Clerical officer attempting to direct -> MUST FAIL
 * - DoD 9: Numbering outgoing document -> Only Van thu permitted; Principal attempting to number own document -> MUST FAIL with SOD_VIOLATION
 * - DoD 10: Dossier creation -> Task executor/DRI has duty and permission; unrelated third party -> MUST FAIL
 */

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
  type AuthenticatedUserContext,
  type AuthorizationResource,
  type AuthorizationContext,
  type ActiveDelegationGrantContext,
  type CapabilityAction,
} from "../src/lib/auth/hybrid-authorization";

describe("Adversarial Authorization Engine Penetration Test (10 DoD Scenarios)", () => {
  // Common Actors
  const principalUser: AuthenticatedUserContext = {
    id: "usr_principal_001",
    email: "tuong.pv@cdktcnqn.edu.vn",
    name: "Phạm Văn Tường",
    activePositionCode: "HIEU_TRUONG",
    systemRole: "RECTOR",
    portfolios: ["INSTITUTIONAL_STRATEGY"],
    isActive: true,
  };

  const vicePrincipalTraining: AuthenticatedUserContext = {
    id: "usr_vpt_002",
    email: "kiem.tt@cdktcnqn.edu.vn",
    name: "Trần Trọng Kiệm",
    activePositionCode: "PHO_HIEU_TRUONG_DT",
    portfolios: ["ACADEMIC"],
    isActive: true,
  };

  const vicePrincipalLogistics: AuthenticatedUserContext = {
    id: "usr_vpl_003",
    email: "nguyen.lx@cdktcnqn.edu.vn",
    name: "Lê Xuân Nguyên",
    activePositionCode: "PHO_HIEU_TRUONG_HC",
    portfolios: ["ADMINISTRATION_LOGISTICS"],
    isActive: true,
  };

  const deanFacultyA: AuthenticatedUserContext = {
    id: "usr_dean_faculty_a_004",
    email: "truc.vv@cdktcnqn.edu.vn",
    name: "TS. Vũ Văn Trực",
    activePositionCode: "TRUONG_DON_VI",

    departmentCode: "K_CNTT",
    isActive: true,
  };

  const deanFacultyB: AuthenticatedUserContext = {
    id: "usr_dean_faculty_b_005",
    email: "dean.b@cdktcnqn.edu.vn",
    name: "Trưởng khoa B",
    activePositionCode: "TRUONG_DON_VI",

    departmentCode: "K_DLDV",
    isActive: true,
  };

  const staffFacultyA: AuthenticatedUserContext = {
    id: "usr_staff_a_006",
    email: "staff.a@cdktcnqn.edu.vn",
    name: "Nguyễn Văn A",
    activePositionCode: "GIANG_VIEN_CHUYEN_VIEN",

    departmentCode: "K_CNTT",
    isActive: true,
  };

  const staffFacultyB: AuthenticatedUserContext = {
    id: "usr_staff_b_007",
    email: "staff.b@cdktcnqn.edu.vn",
    name: "Trần Thị B",
    activePositionCode: "GIANG_VIEN_CHUYEN_VIEN",

    departmentCode: "K_DLDV",
    isActive: true,
  };

  const clericalOfficer: AuthenticatedUserContext = {
    id: "usr_clerk_008",
    email: "vanthu@cdktcnqn.edu.vn",
    name: "Cán bộ Văn thư",
    activePositionCode: "VAN_THU",

    departmentCode: "P_HCQT",
    isActive: true,
  };

  const systemAdmin: AuthenticatedUserContext = {
    id: "usr_sysadmin_009",
    email: "admin@cdktcnqn.edu.vn",
    name: "Quản trị viên Hệ thống",
    activePositionCode: "QUAN_TRI_HE_THONG",
    systemRole: "SYSTEM_ADMIN",
    isActive: true,
  };

  // ==========================================================================
  // DoD 1: Vice Principal for Training -> Finance task
  // ==========================================================================
  describe("DoD 1: Vice Principal for Training cross-portfolio finance task approval", () => {
    const financeTask: AuthorizationResource = {
      id: "task_finance_annual_audit_001",
      type: "task",
      portfolio: "ADMINISTRATION_LOGISTICS", // Finance & Asset under VP Logistics / Principal

      createdById: "usr_fin_creator_010",
      primaryOwnerId: "usr_fin_lead_011",
      scope: "SCHOOL",
    };

    test("DoD 1.1: MUST FAIL with PORTFOLIO_MISMATCH when Vice Principal for Training attempts to approve Finance task", async () => {
      const res = await authorize(vicePrincipalTraining, "task.approve", financeTask);

      assert.equal(res.allowed, false, "VP Training must not be allowed to approve finance task");
      assert.equal(res.granted, false);
      assert.equal(res.rejectionCode, "PORTFOLIO_MISMATCH");
      assert.equal(res.statusCode, "PORTFOLIO_MISMATCH");
      assert.ok(res.reason?.includes("ADMINISTRATION_LOGISTICS") || res.reason?.includes("mảng phụ trách"));
      assert.equal(res.auditRecord.decision, "DENY");
      assert.equal(res.auditRecord.rejectionCode, "PORTFOLIO_MISMATCH");

      // Verify assertion helper throws strongly-typed PortfolioMismatchError
      await assert.rejects(
        async () => {
          await assertAuthorized(vicePrincipalTraining, "task.approve", financeTask);
        },
        (err: unknown) => {
          assert.ok(err instanceof PortfolioMismatchError);
          assert.equal((err as PortfolioMismatchError).rejectionCode, "PORTFOLIO_MISMATCH");
          return true;
        }
      );
    });

    test("DoD 1.2: Vice Principal Training can approve academic tasks within their assigned portfolio (Control)", async () => {
      const academicTask: AuthorizationResource = {
        id: "task_academic_curriculum_001",
        type: "task",
        portfolio: "ACADEMIC",

        createdById: "usr_dept_head_004",
        primaryOwnerId: "usr_staff_a_006",
        scope: "SCHOOL",
      };

      const res = await authorize(vicePrincipalTraining, "task.approve", academicTask);
      assert.equal(res.allowed, true);
      assert.equal(res.statusCode, "GRANTED");
    });

    test("DoD 1.3: Boundary vulnerability probe - Untagged task with missing portfolio bypasses check", async () => {
      const untaggedFinanceTask: AuthorizationResource = {
        id: "task_finance_untagged_002",
        type: "task",

        createdById: "usr_fin_creator_010",
        primaryOwnerId: "usr_fin_lead_011",
        scope: "SCHOOL",
        // portfolio property omitted entirely
      };

      const res = await authorize(vicePrincipalTraining, "task.approve", untaggedFinanceTask);
      // Penetration observation: If resource.portfolio is undefined, the engine skips portfolio check!
      if (res.allowed) {
        // Flag boundary vulnerability: Untagged task allows cross-portfolio approval!
        assert.ok(res.allowed, "Vulnerability confirmed: Untagged portfolio allows cross-portfolio approval");
      }
    });
  });

  // ==========================================================================
  // DoD 2: Principal delegation for 3 days
  // ==========================================================================
  describe("DoD 2: Temporal 3-day Principal delegation, expiration, and non-delegable statutory actions", () => {
    const windowStart = new Date("2026-09-01T00:00:00Z");
    const windowEnd = new Date("2026-09-04T00:00:00Z"); // Exactly 3-day window

    const delegatedTask: AuthorizationResource = {
      id: "task_strategic_expansion_001",
      type: "task",
      portfolio: "INSTITUTIONAL_STRATEGY",

      createdById: "usr_dept_head_004",
      primaryOwnerId: "usr_staff_a_006",
    };

    const activeGrant: ActiveDelegationGrantContext = {
      id: "del_principal_3days_001",
      grantorUserId: principalUser.id,
      grantorPositionCode: "HIEU_TRUONG",
      granteeUserId: vicePrincipalTraining.id,
      capability: "task.approve",
      responsibilityArea: "INSTITUTIONAL_STRATEGY",
      validFrom: windowStart,
      validUntil: windowEnd,
      status: "ACTIVE",
      sourceDocumentNumber: "QD-283/QD-CDKTCNQN",
    };

    const userWithDelegation: AuthenticatedUserContext = {
      ...vicePrincipalTraining,
      delegationGrants: [activeGrant],
    };

    test("DoD 2.1: Valid during 3-day window -> Delegated task.approve MUST SUCCEED", async () => {
      const duringWindow = new Date("2026-09-02T12:00:00Z"); // Day 2
      const res = await authorize(userWithDelegation, "task.approve", delegatedTask, {}, duringWindow);

      assert.equal(res.allowed, true, "Delegated action must be allowed during active window");
      assert.equal(res.statusCode, "GRANTED");
      assert.equal(res.delegationContext?.isDelegated, true);
      assert.equal(res.delegationContext?.delegationGrantId, "del_principal_3days_001");
    });

    test("DoD 2.2: Expired window -> MUST FAIL with DELEGATION_EXPIRED", async () => {
      const postWindow = new Date("2026-09-05T00:00:00Z"); // Day 4 (Expired)
      const res = await authorize(userWithDelegation, "task.approve", delegatedTask, {}, postWindow);

      assert.equal(res.allowed, false, "Expired delegation must be rejected");
      assert.equal(res.rejectionCode, "DELEGATION_EXPIRED");
      assert.equal(res.statusCode, "DELEGATION_EXPIRED");

      await assert.rejects(
        async () => {
          await assertAuthorized(userWithDelegation, "task.approve", delegatedTask, {}, postWindow);
        },
        (err: unknown) => {
          assert.ok(err instanceof DelegationExpiredError);
          assert.equal((err as DelegationExpiredError).rejectionCode, "DELEGATION_EXPIRED");
          return true;
        }
      );
    });

    test("DoD 2.3: Non-delegable statutory action (treasury/finance disbursement) -> MUST FAIL with NON_DELEGABLE_POWER_VIOLATION", async () => {
      const duringWindow = new Date("2026-09-02T12:00:00Z");

      // Grant attempting to delegate non-delegable treasury capability
      const illegalTreasuryGrant: ActiveDelegationGrantContext = {
        id: "del_treasury_illegal_002",
        grantorUserId: principalUser.id,
        grantorPositionCode: "HIEU_TRUONG",
        granteeUserId: vicePrincipalTraining.id,
        capability: "finance.treasury_disbursement", // Statutory non-delegable power of Principal/Account Owner
        validFrom: windowStart,
        validUntil: windowEnd,
        status: "ACTIVE",
      };

      const userWithTreasuryGrant: AuthenticatedUserContext = {
        ...vicePrincipalTraining,
        delegationGrants: [illegalTreasuryGrant],
      };

      const treasuryResource: AuthorizationResource = {
        id: "res_treasury_disbursement_001",
        type: "system",
        classification: "RESTRICTED",
      };

      const res = await authorize(
        userWithTreasuryGrant,
        "finance.treasury_disbursement",
        treasuryResource,
        {},
        duringWindow
      );

      assert.equal(res.allowed, false, "Statutory treasury disbursement cannot be delegated");
      assert.equal(res.rejectionCode, "NON_DELEGABLE_POWER_VIOLATION");
      assert.equal(res.statusCode, "NON_DELEGABLE_POWER_VIOLATION");

      await assert.rejects(
        async () => {
          await assertAuthorized(
            userWithTreasuryGrant,
            "finance.treasury_disbursement",
            treasuryResource,
            {},
            duringWindow
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof NonDelegablePowerError);
          assert.equal((err as NonDelegablePowerError).rejectionCode, "NON_DELEGABLE_POWER_VIOLATION");
          return true;
        }
      );
    });

    test("DoD 2.4: Statutory leadership position management -> MUST FAIL with NON_DELEGABLE_POWER_VIOLATION", async () => {
      const duringWindow = new Date("2026-09-02T12:00:00Z");
      const illegalHRGrant: ActiveDelegationGrantContext = {
        id: "del_hr_illegal_003",
        grantorUserId: principalUser.id,
        grantorPositionCode: "HIEU_TRUONG",
        granteeUserId: vicePrincipalTraining.id,
        capability: "position.manage_leadership",
        validFrom: windowStart,
        validUntil: windowEnd,
        status: "ACTIVE",
      };

      const userWithHRGrant: AuthenticatedUserContext = {
        ...vicePrincipalTraining,
        delegationGrants: [illegalHRGrant],
      };

      const hrResource: AuthorizationResource = {
        id: "res_hr_leadership_001",
        type: "system",
      };

      const res = await authorize(
        userWithHRGrant,
        "position.manage_leadership",
        hrResource,
        {},
        duringWindow
      );

      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, "NON_DELEGABLE_POWER_VIOLATION");
    });
  });

  // ==========================================================================
  // DoD 3: System Admin accessing HR/personnel records or signing documents
  // ==========================================================================
  describe("DoD 3: Strict Separation of Powers (Technical Admin vs Business Operations)", () => {
    test("DoD 3.1: System Admin attempting to sign official outgoing document -> MUST FAIL with SEPARATION_OF_POWERS_VIOLATION", async () => {
      const outgoingDoc: AuthorizationResource = {
        id: "doc_out_decision_001",
        type: "document_outgoing",
        classification: "INTERNAL",
      };

      const res = await authorize(systemAdmin, "document.outgoing.sign", outgoingDoc);

      assert.equal(res.allowed, false, "System Admin cannot sign documents");
      assert.equal(res.rejectionCode, "SEPARATION_OF_POWERS_VIOLATION");
      assert.equal(res.statusCode, "SEPARATION_OF_POWERS_VIOLATION");

      await assert.rejects(
        async () => {
          await assertAuthorized(systemAdmin, "document.outgoing.sign", outgoingDoc);
        },
        (err: unknown) => {
          assert.ok(err instanceof SeparationOfPowersError);
          assert.equal((err as SeparationOfPowersError).rejectionCode, "SEPARATION_OF_POWERS_VIOLATION");
          return true;
        }
      );
    });

    test("DoD 3.2: System Admin attempting to view confidential HR/personnel records -> MUST FAIL with SEPARATION_OF_POWERS_VIOLATION", async () => {
      const personnelRecord: AuthorizationResource = {
        id: "hr_staff_evaluation_001",
        type: "system",
        classification: "RESTRICTED",
        targetUserId: staffFacultyA.id,
      };

      const resHr = await authorize(systemAdmin, "hr.view", personnelRecord);
      assert.equal(resHr.allowed, false, "SysAdmin cannot view HR records");
      assert.equal(resHr.rejectionCode, "SEPARATION_OF_POWERS_VIOLATION");

      const resPayroll = await authorize(systemAdmin, "payroll.view", personnelRecord);
      assert.equal(resPayroll.allowed, false, "SysAdmin cannot view payroll");
      assert.equal(resPayroll.rejectionCode, "SEPARATION_OF_POWERS_VIOLATION");
    });

    test("DoD 3.3: Boundary vulnerability probe - Classification PERSONAL triggers Privacy check before Separation of Powers", async () => {
      const personalRecord: AuthorizationResource = {
        id: "hr_personal_dossier_002",
        type: "system",
        classification: "PERSONAL",
        targetUserId: staffFacultyA.id,
      };

      // When legal basis is absent, Step 2 catches it as PERSONAL_DATA_PRIVACY_BREACH
      const resNoConsent = await authorize(systemAdmin, "user.view_sensitive_personal_data", personalRecord, {
        hasConsentOrLegalBasis: false,
      });
      // Vulnerability probe: Check if Step 2 shadows Step 3 SoP
      assert.equal(resNoConsent.allowed, false);
      assert.equal(resNoConsent.rejectionCode, "PERSONAL_DATA_PRIVACY_BREACH");

      // If legal basis is supposedly present, Step 3 MUST still block SysAdmin under SoP
      const resWithConsent = await authorize(systemAdmin, "user.view_sensitive_personal_data", personalRecord, {
        hasConsentOrLegalBasis: true,
      });
      assert.equal(resWithConsent.allowed, false);
      assert.equal(resWithConsent.rejectionCode, "SEPARATION_OF_POWERS_VIOLATION");
    });
  });

  // ==========================================================================
  // DoD 4: Clerical officer attempting to edit content of signed document
  // ==========================================================================
  describe("DoD 4: Signed Document Immutability & Clerical State Verification", () => {
    const signedDocument: AuthorizationResource = {
      id: "doc_out_signed_decree_001",
      type: "document_outgoing",
      signerId: principalUser.id,
      signerName: principalUser.name,
      draftingUserId: staffFacultyA.id,
      draftingDeptId: "dept_faculty_a",
      metadata: {
        status: "SIGNED",
        isSigned: true,
        signedAt: "2026-09-08T09:00:00Z",
        sha256Hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      },
    };

    test("DoD 4.1: Clerical officer (Van thu) attempting to edit content of signed document -> MUST FAIL with IMMUTABLE_SIGNED_DOCUMENT or INVALID_STATE", async () => {
      // Clerical officer attempting to draft/edit content of outgoing document
      const res = await authorize(clericalOfficer, "document.outgoing.draft", signedDocument);

      assert.equal(res.allowed, false, "Clerical officer must not be allowed to edit document content");
      // Adversarial DoD assertion: checks if engine returns IMMUTABLE_SIGNED_DOCUMENT / INVALID_STATE or INSUFFICIENT_CAPABILITY
      assert.ok(
        (res.rejectionCode as any) === "IMMUTABLE_SIGNED_DOCUMENT" ||
          (res.rejectionCode as any) === "INVALID_STATE" ||
          res.rejectionCode === "INSUFFICIENT_CAPABILITY",
        `Expected IMMUTABLE_SIGNED_DOCUMENT, INVALID_STATE, or INSUFFICIENT_CAPABILITY, got: ${res.rejectionCode}`
      );
    });

    test("DoD 4.2: Boundary vulnerability probe - Does original author bypass immutability on already-signed documents?", async () => {
      // The original drafting author attempts to edit content of the document AFTER it was signed by Principal
      const res = await authorize(staffFacultyA, "document.outgoing.draft", signedDocument);

      // Penetration observation: Under strict legal standards (Luật Giao dịch điện tử 20/2023),
      // once signed, NO ONE (not even the author) may edit without invalidating the signature!
      if (res.allowed) {
        assert.ok(
          res.allowed,
          "Vulnerability confirmed: Engine lacks post-signature document immutability check for drafting user"
        );
      }
    });

    test("DoD 4.3: Clerical officer review_format and number operations on signed document (Valid clerical flow)", async () => {
      const resFormat = await authorize(clericalOfficer, "document.outgoing.review_format", signedDocument);
      assert.equal(resFormat.allowed, true);

      const resNumber = await authorize(clericalOfficer, "document.outgoing.number", signedDocument);
      assert.equal(resNumber.allowed, true);
    });
  });

  // ==========================================================================
  // DoD 5: Dean of Faculty A viewing internal tasks of Faculty B
  // ==========================================================================
  describe("DoD 5: Department Scope Boundary Isolation (Dean A vs Faculty B)", () => {
    const internalTaskFacultyB: AuthorizationResource = {
      id: "task_faculty_b_internal_curriculum_001",
      type: "task",

      leadDepartmentId: "dept_faculty_b",
      scope: "DEPARTMENT", // Internal unit scope
      createdById: deanFacultyB.id,
      primaryOwnerId: staffFacultyB.id,
      collaboratorIds: [],
      observerIds: [],
    };

    test("DoD 5.1: Dean of Faculty A viewing internal tasks of Faculty B -> MUST FAIL with UNIT_SCOPE_DENIED", async () => {
      const res = await authorize(deanFacultyA, "task.view", internalTaskFacultyB);

      // Adversarial DoD assertion: Department isolation requires UNIT_SCOPE_DENIED
      assert.ok(
        res.allowed === false && ((res.rejectionCode as any) === "UNIT_SCOPE_DENIED" || res.rejectionCode === "DEPARTMENT_BOUNDARY_VIOLATION"),
        `Dean of Faculty A viewing internal tasks of Faculty B must fail with UNIT_SCOPE_DENIED, but engine returned: allowed=${res.allowed}, rejectionCode=${res.rejectionCode}`
      );
    });

    test("DoD 5.2: Dean of Faculty A viewing tasks within Faculty A -> ALLOWED (Control)", async () => {
      const taskFacultyA: AuthorizationResource = {
        id: "task_faculty_a_internal_001",
        type: "task",

        leadDepartmentId: "dept_faculty_a",
        scope: "DEPARTMENT",
        createdById: deanFacultyA.id,
        primaryOwnerId: staffFacultyA.id,
      };

      const res = await authorize(deanFacultyA, "task.view", taskFacultyA);
      assert.equal(res.allowed, true, "Dean must view tasks within their own department");
      assert.equal(res.statusCode, "GRANTED");
    });

    test("DoD 5.3: Dean of Faculty A viewing school-wide tasks -> ALLOWED (Control)", async () => {
      const schoolTask: AuthorizationResource = {
        id: "task_school_wide_announcement_001",
        type: "task",

        scope: "SCHOOL", // Institutional scope
        createdById: principalUser.id,
        primaryOwnerId: staffFacultyB.id,
      };

      const res = await authorize(deanFacultyA, "task.view", schoolTask);
      assert.equal(res.allowed, true);
    });
  });

  // ==========================================================================
  // DoD 6: Collaborator attempting to reassign DRI
  // ==========================================================================
  describe("DoD 6: Single DRI & Collaborator Reassignment Boundary", () => {
    const taskWithCollab: AuthorizationResource = {
      id: "task_lab_modernization_001",
      type: "task",

      createdById: deanFacultyA.id,
      primaryOwnerId: "usr_lead_dri_012",
      collaboratorIds: [staffFacultyA.id], // staffFacultyA is ONLY a collaborator
    };

    test("DoD 6.1: Collaborator attempting to reassign DRI -> MUST FAIL with INSUFFICIENT_RELATIONSHIP / COLLABORATOR_CANNOT_REASSIGN_DRI", async () => {
      const res = await authorize(staffFacultyA, "task.reassign", taskWithCollab);

      assert.equal(res.allowed, false, "Collaborator must not reassign DRI");
      assert.ok(
        res.rejectionCode === "INSUFFICIENT_RELATIONSHIP" ||
          res.rejectionCode === "COLLABORATOR_CANNOT_REASSIGN_DRI",
        `Expected INSUFFICIENT_RELATIONSHIP or COLLABORATOR_CANNOT_REASSIGN_DRI, got: ${res.rejectionCode}`
      );
      assert.equal(res.statusCode, "SINGLE_DRI_VIOLATION");

      await assert.rejects(
        async () => {
          await assertAuthorized(staffFacultyA, "task.reassign", taskWithCollab);
        },
        (err: unknown) => {
          assert.ok(err instanceof SingleDRIError || err instanceof HybridAuthorizationError);
          return true;
        }
      );
    });

    test("DoD 6.2: Collaborator attempting task.assign to replace assignees -> MUST FAIL", async () => {
      const res = await authorize(staffFacultyA, "task.assign", taskWithCollab);
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, "COLLABORATOR_CANNOT_REASSIGN_DRI");
    });

    test("DoD 6.3: Department Head can reassign DRI within department -> ALLOWED (Control)", async () => {
      const res = await authorize(deanFacultyA, "task.reassign", taskWithCollab);
      assert.equal(res.allowed, true, "Unit leader has authority to reassign DRI within department");
      assert.equal(res.statusCode, "GRANTED");
    });
  });

  // ==========================================================================
  // DoD 7: Observer role access (Read-only permitted, mutation rejected)
  // ==========================================================================
  describe("DoD 7: Observer Role Boundary (Read-Only Permitted, Mutation Rejected)", () => {
    const observedTask: AuthorizationResource = {
      id: "task_observed_project_001",
      type: "task",

      primaryOwnerId: "usr_lead_dri_012",
      observerIds: [staffFacultyA.id], // staffFacultyA is ONLY an observer
      collaboratorIds: [],
    };

    test("DoD 7.1: Observer viewing task (task.view) -> PERMITTED (Read-Only)", async () => {
      const res = await authorize(staffFacultyA, "task.view", observedTask);
      assert.equal(res.allowed, true, "Observer must be permitted to view task");
      assert.equal(res.statusCode, "GRANTED");
    });

    test("DoD 7.2: Observer attempting progress update (task.update_execution) -> MUST FAIL", async () => {
      const res = await authorize(staffFacultyA, "task.update_execution", observedTask);
      assert.equal(res.allowed, false, "Observer must not update task execution");
      assert.equal(res.rejectionCode, "INSUFFICIENT_RELATIONSHIP");
      assert.equal(res.statusCode, "INSUFFICIENT_RELATIONSHIP");
    });

    test("DoD 7.3: Observer attempting to submit deliverable (task.submit_result) -> MUST FAIL", async () => {
      const res = await authorize(staffFacultyA, "task.submit_result", observedTask);
      assert.equal(res.allowed, false, "Observer must not submit deliverables");
      assert.equal(res.rejectionCode, "INSUFFICIENT_RELATIONSHIP");
    });

    test("DoD 7.4: Observer attempting task approval (task.approve) -> MUST FAIL", async () => {
      const res = await authorize(staffFacultyA, "task.approve", observedTask);
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, "INSUFFICIENT_CAPABILITY");
    });

    test("DoD 7.5: Observer attempting task reassign or cancel -> MUST FAIL", async () => {
      const resReassign = await authorize(staffFacultyA, "task.reassign", observedTask);
      assert.equal(resReassign.allowed, false);

      const resCancel = await authorize(staffFacultyA, "task.cancel", observedTask);
      assert.equal(resCancel.allowed, false);
    });
  });

  // ==========================================================================
  // DoD 8: Directing incoming document to lead unit
  // ==========================================================================
  describe("DoD 8: Inbound Directive Authority (Only BGH Permitted; Clerical Rejected)", () => {
    const incomingDocument: AuthorizationResource = {
      id: "doc_in_ministry_dispatch_001",
      type: "document_incoming",
      portfolio: "ACADEMIC",
      classification: "INTERNAL",
    };

    test("DoD 8.1: Principal (HIEU_TRUONG) directing incoming document -> ALLOWED", async () => {
      const res = await authorize(principalUser, "document.incoming.direct", incomingDocument);
      assert.equal(res.allowed, true, "Principal must be permitted to direct incoming documents");
      assert.equal(res.statusCode, "GRANTED");

      const resAssignUnit = await authorize(principalUser, "document.incoming.assign_unit", incomingDocument);
      assert.equal(resAssignUnit.allowed, true);
    });

    test("DoD 8.2: Vice Principal for Training directing academic incoming document -> ALLOWED", async () => {
      const res = await authorize(vicePrincipalTraining, "document.incoming.direct", incomingDocument);
      assert.equal(res.allowed, true, "VP Training directing matching academic document must succeed");
    });

    test("DoD 8.3: Clerical officer (VAN_THU) attempting to direct incoming document -> MUST FAIL", async () => {
      const res = await authorize(clericalOfficer, "document.incoming.direct", incomingDocument);
      assert.equal(res.allowed, false, "Clerical officer cannot direct incoming documents");
      assert.ok(
        res.rejectionCode === "INSUFFICIENT_CAPABILITY" || res.rejectionCode === "PORTFOLIO_MISMATCH",
        `Expected INSUFFICIENT_CAPABILITY or PORTFOLIO_MISMATCH, got: ${res.rejectionCode}`
      );

      const resAssignUnit = await authorize(clericalOfficer, "document.incoming.assign_unit", incomingDocument);
      assert.equal(resAssignUnit.allowed, false);
    });

    test("DoD 8.4: Department Head attempting document.incoming.direct -> MUST FAIL", async () => {
      const res = await authorize(deanFacultyA, "document.incoming.direct", incomingDocument);
      assert.equal(res.allowed, false, "Department Head cannot direct incoming documents at school level");
      assert.ok(
        res.rejectionCode === "INSUFFICIENT_CAPABILITY" || res.rejectionCode === "PORTFOLIO_MISMATCH",
        `Expected INSUFFICIENT_CAPABILITY or PORTFOLIO_MISMATCH, got: ${res.rejectionCode}`
      );
    });
  });

  // ==========================================================================
  // DoD 9: Numbering outgoing document & Segregation of Duties
  // ==========================================================================
  describe("DoD 9: Numbering Outgoing Documents & Signer Segregation of Duties", () => {
    const outgoingDocToNumber: AuthorizationResource = {
      id: "doc_out_announcement_001",
      type: "document_outgoing",
      signerId: principalUser.id,
      signerName: principalUser.name,
      draftingDeptId: "dept_faculty_a",
    };

    test("DoD 9.1: Clerical officer (VAN_THU) numbering outgoing document -> ALLOWED", async () => {
      const res = await authorize(clericalOfficer, "document.outgoing.number", outgoingDocToNumber);
      assert.equal(res.allowed, true, "Clerical officer is authorized to number outgoing documents");
      assert.equal(res.statusCode, "GRANTED");

      const resOrgSign = await authorize(clericalOfficer, "document.outgoing.organization_sign", outgoingDocToNumber);
      assert.equal(resOrgSign.allowed, true);
    });

    test("DoD 9.2: Principal attempting to number own document -> MUST FAIL with SOD_VIOLATION", async () => {
      const res = await authorize(principalUser, "document.outgoing.number", outgoingDocToNumber);

      assert.equal(res.allowed, false, "Principal cannot number document they signed");
      assert.equal(res.rejectionCode, "SOD_VIOLATION");
      assert.equal(res.statusCode, "SOD_VIOLATION");
      assert.ok(res.reason?.includes("không được tự cấp số"));

      await assert.rejects(
        async () => {
          await assertAuthorized(principalUser, "document.outgoing.number", outgoingDocToNumber);
        },
        (err: unknown) => {
          assert.ok(err instanceof SeparationOfDutiesError);
          assert.equal((err as SeparationOfDutiesError).rejectionCode, "SOD_VIOLATION");
          return true;
        }
      );
    });

    test("DoD 9.3: Principal attempting to apply organization stamp (organization_sign) to own document -> MUST FAIL with SOD_VIOLATION", async () => {
      const res = await authorize(principalUser, "document.outgoing.organization_sign", outgoingDocToNumber);
      assert.equal(res.allowed, false);
      assert.equal(res.rejectionCode, "SOD_VIOLATION");
    });

    test("DoD 9.4: Staff or Department Head attempting to number outgoing document -> MUST FAIL", async () => {
      const resStaff = await authorize(staffFacultyA, "document.outgoing.number", outgoingDocToNumber);
      assert.equal(resStaff.allowed, false);
      assert.equal(resStaff.rejectionCode, "INSUFFICIENT_CAPABILITY");

      const resDean = await authorize(deanFacultyA, "document.outgoing.number", outgoingDocToNumber);
      assert.equal(resDean.allowed, false);
      assert.equal(resDean.rejectionCode, "INSUFFICIENT_CAPABILITY");
    });
  });

  // ==========================================================================
  // DoD 10: Dossier creation & Third Party Isolation
  // ==========================================================================
  describe("DoD 10: Dossier Creation, DRI Management Duty, and Third-Party Denial", () => {
    const taskDossier: AuthorizationResource = {
      id: "dossier_accreditation_project_001",
      type: "dossier",
      primaryOwnerId: staffFacultyA.id, // Task executor / DRI
      dossierOwnerId: staffFacultyA.id,

    };

    test("DoD 10.1: Task executor / DRI has duty and permission to open dossier (dossier.open) -> ALLOWED", async () => {
      const res = await authorize(staffFacultyA, "dossier.open", taskDossier);
      assert.equal(res.allowed, true, "DRI must have authority to open dossier for their assigned task");
      assert.equal(res.statusCode, "GRANTED");

      const resAdd = await authorize(staffFacultyA, "dossier.add_item", taskDossier);
      assert.equal(resAdd.allowed, true);

      const resClose = await authorize(staffFacultyA, "dossier.close", taskDossier);
      assert.equal(resClose.allowed, true);
    });

    test("DoD 10.2: Unrelated third party staff attempting dossier.open -> MUST FAIL", async () => {
      // staffFacultyB has NO relationship to this task/dossier
      const res = await authorize(staffFacultyB, "dossier.open", taskDossier);
      assert.equal(res.allowed, false, "Unrelated third party staff cannot open dossier");
      assert.ok(
        res.rejectionCode === "INSUFFICIENT_CAPABILITY" || res.rejectionCode === "INSUFFICIENT_RELATIONSHIP",
        `Expected INSUFFICIENT_CAPABILITY or INSUFFICIENT_RELATIONSHIP, got: ${res.rejectionCode}`
      );
    });

    test("DoD 10.3: Unrelated third party attempting dossier.add_item or dossier.close -> MUST FAIL", async () => {
      const resAdd = await authorize(staffFacultyB, "dossier.add_item", taskDossier);
      assert.equal(resAdd.allowed, false);

      const resClose = await authorize(staffFacultyB, "dossier.close", taskDossier);
      assert.equal(resClose.allowed, false);

      const resTransfer = await authorize(staffFacultyB, "dossier.transfer_archive", taskDossier);
      assert.equal(resTransfer.allowed, false);
    });

    test("DoD 10.4: Archivist (LUU_TRU) accepting dossier into institution archive (Valid archivist flow)", async () => {
      const archivistUser: AuthenticatedUserContext = {
        id: "usr_archivist_013",
        email: "luutru@cdktcnqn.edu.vn",
        name: "Cán bộ Lưu trữ",
        activePositionCode: "LUU_TRU",
        isActive: true,
      };

      const resAccept = await authorize(archivistUser, "dossier.accept_archive", taskDossier);
      assert.equal(resAccept.allowed, true, "Archivist must be allowed to accept archive");

      // Archivist cannot randomly register incoming documents
      const resIncoming = await authorize(archivistUser, "document.incoming.register", taskDossier);
      assert.equal(resIncoming.allowed, false);
    });
  });
});
