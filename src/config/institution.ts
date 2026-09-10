/**
 * CANONICAL INSTITUTION PROFILE & IDENTITY CONFIGURATION
 * Single Source of Truth for QCET (Trường Cao đẳng Kinh tế và Công nghệ Quảng Ninh)
 * Task 3.18 (F14 Institutional Profile) - Sprint 3
 */

export interface InstitutionProfile {
  /** Full official legal name in Vietnamese administrative records */
  officialName: string;
  /** Short acronym name (e.g. QCET) */
  shortName: string;
  /** Superior managing governmental body / ministry / province */
  subordinateTo: string;
  /** Official vocational code / institutional code */
  institutionCode: string;
  /** Default legal issuing authority for administrative dispatches */
  issuingAuthority: string;
  /** Headquarters physical address */
  address: string;
  /** Official contact phone */
  phone?: string;
  /** Official contact email */
  email?: string;
  /** Official website URL */
  website: string;
  /** Path to canonical institutional crest / emblem */
  logoUrl: string;
  /** Abbreviated name used in compact headers / layouts */
  abbreviatedName: string;
  /** English canonical institution name */
  englishName?: string;
  /** Domain name for institutional email and identity accounts */
  domain: string;
}

function deepFreeze<T extends object>(obj: T): Readonly<T> {
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    const val = (obj as Record<string, unknown>)[prop];
    if (
      val !== null &&
      (typeof val === "object" || typeof val === "function") &&
      !Object.isFrozen(val)
    ) {
      deepFreeze(val as object);
    }
  });
  return obj;
}

export const INSTITUTION_CONFIG: Readonly<InstitutionProfile> = deepFreeze({
  officialName: "Trường Cao đẳng Kinh tế và Công nghệ Quảng Ninh",
  shortName: "QCET",
  subordinateTo: "ỦY BAN NHÂN DÂN TỈNH QUẢNG NINH",
  institutionCode: "QCET",
  issuingAuthority: "Trường Cao đẳng Kinh tế và Công nghệ Quảng Ninh",
  address: "Thành phố Hạ Long, Tỉnh Quảng Ninh",
  phone: "(0203) 3850 373",
  email: "bgh@cdktcnqn.edu.vn",
  website: "https://cdktcnqn.edu.vn",
  logoUrl: "/logo-qcet.png",
  abbreviatedName: "Trường CĐ Kinh tế & Công nghệ Quảng Ninh",
  englishName: "Quang Ninh College of Economic and Technology",
  domain: "cdktcnqn.edu.vn",
});

/**
 * Returns the canonical institutional official name.
 */
export function getInstitutionName(): string {
  return INSTITUTION_CONFIG.officialName;
}

/**
 * Returns the short acronym name (e.g. "QCET").
 */
export function getInstitutionShortName(): string {
  return INSTITUTION_CONFIG.shortName;
}

/**
 * Returns the subordinate managing authority.
 */
export function getInstitutionSubordinateTo(): string {
  return INSTITUTION_CONFIG.subordinateTo;
}

/**
 * Returns the institutional code.
 */
export function getInstitutionCode(): string {
  return INSTITUTION_CONFIG.institutionCode;
}

/**
 * Returns structured header information according to Decree 30/2020/ND-CP administrative document layout.
 */
export function getInstitutionHeader(): {
  subordinateTo: string;
  officialName: string;
  formattedHeader: string;
} {
  const officialNameUpper = INSTITUTION_CONFIG.officialName.toUpperCase();
  return {
    subordinateTo: INSTITUTION_CONFIG.subordinateTo,
    officialName: officialNameUpper,
    formattedHeader: `${INSTITUTION_CONFIG.subordinateTo}\n${officialNameUpper}`,
  };
}

/**
 * Formats the official digital signing capacity for organizational seals.
 * E.g. "VĂN PHÒNG / Trường Cao đẳng Kinh tế và Công nghệ Quy Nhơn "
 */
export function getOfficialSigningCapacity(department = "VĂN PHÒNG"): string {
  return `${department.toUpperCase()} / ${INSTITUTION_CONFIG.officialName.toUpperCase()}`;
}

/**
 * Returns full application title with optional page title prefix.
 */
export function getAppTitle(pageTitle?: string): string {
  const brand = `${INSTITUTION_CONFIG.shortName} E-Office`;
  return pageTitle ? `${pageTitle} - ${brand}` : brand;
}

/**
 * Checks whether a given string matches the institution identity (name, code, acronym, or domain).
 */
export function isCurrentInstitution(nameOrCode?: string | null): boolean {
  if (!nameOrCode) return false;
  const normalized = nameOrCode.trim().toLowerCase();
  return (
    normalized === INSTITUTION_CONFIG.officialName.toLowerCase() ||
    normalized === INSTITUTION_CONFIG.shortName.toLowerCase() ||
    normalized === INSTITUTION_CONFIG.institutionCode.toLowerCase() ||
    normalized === INSTITUTION_CONFIG.abbreviatedName.toLowerCase() ||
    normalized.includes("kinh tế và công nghệ") ||
    normalized.includes("kinh tế & công nghệ") ||
    normalized.includes(INSTITUTION_CONFIG.domain.toLowerCase())
  );
}
