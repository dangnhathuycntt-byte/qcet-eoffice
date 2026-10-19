/**
 * CANONICAL INSTITUTION PROFILE & IDENTITY CONFIGURATION
 * Single Source of Truth for QCET (Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn)
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
  officialName: "Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn",
  shortName: "QCET",
  subordinateTo: "ỦY BAN NHÂN DÂN TỈNH BÌNH ĐỊNH",
  institutionCode: "QCET",
  issuingAuthority: "Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn",
  address: "172 An Dương Vương, Phường Nguyễn Văn Cừ, TP. Quy Nhơn, Tỉnh Bình Định",
  email: "quantrimang@cdktcnqn.edu.vn",
  website: "https://cdktcnqn.edu.vn",
  logoUrl: "/logo-qcet.png",
  abbreviatedName: "Trường CĐ Kỹ thuật Công nghệ Quy Nhơn",
  englishName: "Quy Nhon College of Engineering and Technology",
  domain: "cdktcnqn.edu.vn",
});

/**
 * Formats the official digital signing capacity for organizational seals.
 * E.g. "VĂN PHÒNG / Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn "
 */
export function getOfficialSigningCapacity(department = "VĂN PHÒNG"): string {
  return `${department.toUpperCase()} / ${INSTITUTION_CONFIG.officialName.toUpperCase()}`;
}
