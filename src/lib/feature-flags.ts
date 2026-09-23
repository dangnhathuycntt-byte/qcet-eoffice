/**
 * Feature Flags — WI-8.2b Stage B Cutover (Department → OrganizationalUnit)
 *
 * ORG_UNIT_READ_CUTOVER:  khi bật, các truy vấn danh sách/tra cứu đơn vị sẽ đọc
 *                         từ OrganizationalUnit thay vì Department.
 * ORG_UNIT_WRITE_CUTOVER: khi bật, các thao tác ghi nhiệm vụ sẽ dual-write
 *                         leadUnitId (OrganizationalUnit) song song với departmentId.
 *
 * Cách bật:
 *   FEATURE_FLAG_ORG_UNIT_READ_CUTOVER=true
 *   FEATURE_FLAG_ORG_UNIT_WRITE_CUTOVER=true
 */

export const ORG_UNIT_READ_CUTOVER =
  process.env.FEATURE_FLAG_ORG_UNIT_READ_CUTOVER === 'true';

export const ORG_UNIT_WRITE_CUTOVER =
  process.env.FEATURE_FLAG_ORG_UNIT_WRITE_CUTOVER === 'true';
