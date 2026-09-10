import re

# 1. Load generated tasks
with open("/tmp/generated_tasks.ts") as f:
    generated_tasks_code = f.read()

# 2. Read seed.ts
with open("prisma/seed.ts") as f:
    seed_content = f.read()

# 3. Add department leadership variables if not present
vars_to_add = """  const tcdbclOwnerId = userMap["phongnt@cdktcnqn.edu.vn"] || userMap["tochuc@cdktcnqn.edu.vn"];
  const qldtOwnerId = userMap["levanthi@cdktcnqn.edu.vn"] || userMap["daotao@cdktcnqn.edu.vn"];
  const tcOwnerId = userMap["lephuongthuyoanh@cdktcnqn.edu.vn"] || userMap["taichinh@cdktcnqn.edu.vn"];
  const hcqtOwnerId = userMap["hanhchinh@cdktcnqn.edu.vn"];
  const tshtqtOwnerId = userMap["vynq@cdktcnqn.edu.vn"] || userMap["tuyensinh@cdktcnqn.edu.vn"];
  const sttOwnerId = userMap["vinhnn@cdktcnqn.edu.vn"] || userMap["quantrimang@cdktcnqn.edu.vn"];
  const dulichOwnerId = userMap["thaoptt@cdktcnqn.edu.vn"];
  const ktqtOwnerId = userMap["tuyetla@cdktcnqn.edu.vn"];
  const ktnnOwnerId = userMap["dungnh@cdktcnqn.edu.vn"];
  const vhntOwnerId = userMap["hanhdtm@cdktcnqn.edu.vn"];
  const daicuongOwnerId = userMap["minhttt@cdktcnqn.edu.vn"];
  const nnthOwnerId = userMap["thangcd@cdktcnqn.edu.vn"];
"""

target_var_anchor = 'const phoHieuTruongId = userMap["kiemtt@cdktcnqn.edu.vn"] || userMap["nguyenlx@cdktcnqn.edu.vn"];\n'

if 'const tcdbclOwnerId =' not in seed_content:
    seed_content = seed_content.replace(target_var_anchor, target_var_anchor + vars_to_add)

# 4. Insert 103 tasks right before `    // --- THÁNG 10/2026 ---`
month_10_anchor = '    // --- THÁNG 10/2026 ---'
if 'NV-2026-09-005' not in seed_content:
    seed_content = seed_content.replace(month_10_anchor, generated_tasks_code + "\n\n" + month_10_anchor)

# 5. Insert Document 09/KH-CĐKTCNQN in sampleDocuments
doc_code = """    // --- KẾ HOẠCH CÔNG TÁC THÁNG 9/2026 (HIỆU TRƯỞNG PHẠM VĂN TƯỜNG) ---
    {
      type: DocumentType.VAN_BAN_DI,
      registrationNumber: 9,
      documentYear: 2026,
      registeredDate: new Date('2026-09-01T08:00:00Z'),
      originalNumber: '09/KH-CĐKTCNQN',
      issuedDate: new Date('2026-09-01T08:00:00Z'),
      issuingAuthority: 'Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn',
      category: 'Kế hoạch',
      summary: 'Kế hoạch công tác tháng 9 năm 2026 của Ban Giám hiệu Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (Dự thảo triển khai nhiệm vụ năm học mới 2026-2027)',
      urgency: DocumentUrgency.THUONG,
      securityLevel: DocumentSecurityLevel.THUONG,
      status: DocumentStatus.DANG_XU_LY,
      dueDate: new Date('2026-09-30T17:00:00Z'),
      leadDepartmentId: 'BGH',
      leadUserId: bghOwnerId,
      signerName: 'ThS. Phạm Văn Tường',
      signerTitle: 'Hiệu trưởng',
      draftingDeptId: 'P_TCDBCL',
      recipientList: 'Đảng ủy (để báo cáo); Ban Giám hiệu; Các phòng, khoa, trung tâm; Lưu: VT, TC-ĐBCL',
      linkedTaskCode: 'NV-2026-09-006',
      directives: [
        {
          leaderId: bghOwnerId,
          instruction: 'Ban Giám hiệu yêu cầu các đơn vị trực thuộc căn cứ chức năng, nhiệm vụ triển khai đồng bộ 103 nhiệm vụ trọng tâm tháng 9/2026; báo cáo định kỳ trước ngày 24/09/2026.',
          deadline: new Date('2026-09-30T17:00:00Z'),
          assignedDeptId: 'BGH',
          collaboratorIds: 'P_TCDBCL,P_QLDT,P_TC,P_HCQT,P_TSHTQT,TT_STT,K_CNTT,K_CK,K_DIEN,K_CNOTO,K_KTNN,K_KTQT,K_VHNT,K_DAICUONG',
          isTaskGenerated: true,
        },
      ],
      attachments: [
        {
          fileName: 'KeHoach_CongTac_Thang9_2026.doc',
          fileUrl: '/documents/2026/KeHoach_CongTac_Thang9_2026.doc',
          fileSize: 199680,
          mimeType: 'application/msword',
          isOriginal: true,
        },
      ],
    },
"""

doc_anchor = '  const sampleDocuments: SampleDocumentItem[] = [\n'
if '09/KH-CĐKTCNQN' not in seed_content:
    seed_content = seed_content.replace(doc_anchor, doc_anchor + doc_code)

with open("prisma/seed.ts", "w") as f:
    f.write(seed_content)

print("Successfully patched prisma/seed.ts!")
