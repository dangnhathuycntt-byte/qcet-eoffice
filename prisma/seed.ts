import {
  PrismaClient,
  UserRole,
  TaskScope,
  TaskStatus,
  TaskPriority,
  AssigneeRole,
  DocumentType,
  DocumentUrgency,
  DocumentSecurityLevel,
  DocumentStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding QCET E-Office Database...');

    // 1. Tạo và đồng bộ 15 đơn vị chuẩn của QCET cùng các mã tương thích
  const departments = [
    // 15 Đơn vị chuẩn hóa QCET theo cdktcnqn.edu.vn
    { id: "BGH", name: "Ban Giám hiệu", shortName: "BGH", color: "#1E3A8A" },
    { id: "P_QLDT", name: "Phòng Quản lý Đào tạo", shortName: "P.QLĐT", color: "#2563EB" },
    { id: "P_TC", name: "Phòng Tài chính", shortName: "P.TC", color: "#9333EA" },
    { id: "P_TCDBCL", name: "Phòng Tổ chức - Đảm bảo chất lượng", shortName: "P.TC-ĐBCL", color: "#059669" },
    { id: "P_HCQT", name: "Phòng Hành chính - Quản trị", shortName: "P.HC-QT", color: "#DC2626" },
    { id: "P_TSHTQT", name: "Phòng Tuyển sinh - Hợp tác quốc tế", shortName: "P.TS-HTQT", color: "#EA580C" },
    { id: "TT_STT", name: "Trung tâm Số - Truyền thông", shortName: "TT.S-TT", color: "#0284C7" },
    { id: "K_CNTT", name: "Khoa Điện tử - Tin học", shortName: "K.CNTT", color: "#0284C7" },
    { id: "K_CK", name: "Khoa Cơ khí", shortName: "K.CK", color: "#0D9488" },
    { id: "K_DIEN", name: "Khoa Điện", shortName: "K.Đ", color: "#16A34A" },
    { id: "K_CNOTO", name: "Khoa Công nghệ Ô tô", shortName: "K.ÔTÔ", color: "#CA8A04" },
    { id: "K_DULICH", name: "Khoa Du lịch - Dịch vụ", shortName: "K.DL", color: "#E11D48" },
    { id: "K_KTQT", name: "Khoa Kinh tế - Tổng hợp", shortName: "K.KTTH", color: "#7C3AED" },
    { id: "K_KTNN", name: "Khoa Kỹ thuật Nông nghiệp", shortName: "K.KTNN", color: "#15803D" },
    { id: "K_VHNT", name: "Khoa Văn hóa Nghệ thuật", shortName: "K.VHNT", color: "#B45309" },
    { id: "K_DAICUONG", name: "Khoa Văn hóa THPT & Khoa học cơ bản", shortName: "K.ĐC", color: "#4B5563" },
    { id: "TT_NNTH", name: "Trung tâm Ngoại ngữ - Tin học", shortName: "TT.NNTH", color: "#4F46E5" },

    // Duy trì tương thích với dữ liệu tiền nhiệm và foreign key cũ
    { id: "ban-giam-hieu", name: "Ban Giám hiệu (Cũ)", shortName: "BGH", color: "#1E3A8A" },
    { id: "phong-dao-tao", name: "Phòng Đào tạo (Cũ)", shortName: "P.ĐT", color: "#2563EB" },
    { id: "khoa-cntt", name: "Khoa Công nghệ Thông tin (Cũ)", shortName: "K.CNTT", color: "#0284C7" },
    { id: "khoa-co-khi", name: "Khoa Cơ khí (Cũ)", shortName: "K.CK", color: "#0D9488" },
    { id: "khoa-dien", name: "Khoa Điện - Điện tử (Cũ)", shortName: "K.ĐĐT", color: "#16A34A" },
    { id: "khoa-oto", name: "Khoa Kỹ thuật Ô tô (Cũ)", shortName: "K.ÔTÔ", color: "#CA8A04" },
    { id: "phong-cthssv", name: "Phòng Công tác Học sinh Sinh viên (Cũ)", shortName: "P.CTHSSV", color: "#EA580C" },
    { id: "phong-qctb", name: "Phòng Quản trị - Thiết bị (Cũ)", shortName: "P.QTTB", color: "#DC2626" },
    { id: "phong-tckt", name: "Phòng Tài chính - Kế toán (Cũ)", shortName: "P.TCKT", color: "#9333EA" },
    { id: "tt-laixe", name: "Trung tâm Đào tạo Lái xe (Cũ)", shortName: "TT.LX", color: "#4F46E5" },
    { id: "tt-tuyensinh", name: "Trung tâm Tuyển sinh & Truyền thông (Cũ)", shortName: "TT.TS", color: "#059669" },
    { id: "CNTT", name: "Phòng Quản trị Mạng và CNTT", shortName: "QTM-CNTT", color: "#0284C7" },
    { id: "TCHC", name: "Phòng Tổ chức Hành chính", shortName: "TCHC", color: "#059669" },
    { id: "KHTC", name: "Phòng Kế hoạch Tài chính", shortName: "KHTC", color: "#9333EA" },
    { id: "DT_QLKH", name: "Phòng Đào tạo & Quản lý Khoa học", shortName: "ĐT-QLKH", color: "#2563EB" },
  ];

  for (const dept of departments) {
    await prisma.department.upsert({
      where: { id: dept.id },
      update: { name: dept.name, shortName: dept.shortName, color: dept.color },
      create: dept,
    });
  }

    // 2. Tạo Tài khoản Người dùng với thông tin thực tế của QCET (@cdktcnqn.edu.vn)
  const defaultPasswordHash = await bcrypt.hash("Qcet@123456", 10);
  const qcet2026PasswordHash = await bcrypt.hash("Qcet@2026", 10);

  const users = [
    // Ban Giám hiệu
    { email: "tuongpv@cdktcnqn.edu.vn", name: "ThS. Phạm Văn Tường (Hiệu trưởng)", role: UserRole.BAN_GIAM_HIEU, departmentId: "BGH", title: "Hiệu trưởng", phone: "0256.3846.478", passwordHash: defaultPasswordHash },
    { email: "kiemtt@cdktcnqn.edu.vn", name: "ThS. Trần Trọng Kiệm (Phó Hiệu trưởng Đào tạo & NCKH)", role: UserRole.BAN_GIAM_HIEU, departmentId: "BGH", title: "Phó Hiệu trưởng", phone: "0256.3846.479", passwordHash: defaultPasswordHash },
    { email: "nguyenlx@cdktcnqn.edu.vn", name: "ThS. Lê Xuân Nguyên (Phó Hiệu trưởng HC & CSVC)", role: UserRole.BAN_GIAM_HIEU, departmentId: "BGH", title: "Phó Hiệu trưởng", phone: "0256.3846.480", passwordHash: defaultPasswordHash },
    { email: "bgh@cdktcnqn.edu.vn", name: "ThS. Phạm Văn Tường", role: UserRole.BAN_GIAM_HIEU, departmentId: "BGH", title: "Hiệu trưởng", phone: "0256.3846.478", passwordHash: qcet2026PasswordHash },
    { email: "admin@cdktcnqn.edu.vn", name: "Quản trị hệ thống QCET", role: UserRole.ADMIN, departmentId: "BGH", title: "Quản trị viên", phone: "0900.000.001", passwordHash: defaultPasswordHash },
    { email: "vanthu@cdktcnqn.edu.vn", name: "CN. Trương Thị Hồng Nhung (Văn thư trường)", role: UserRole.VAN_THU, departmentId: "P_HCQT", title: "Văn thư trường", phone: "0256.3846.481", passwordHash: defaultPasswordHash },

    // 6 Phòng / Trung tâm chức năng
    { email: "levanthi@cdktcnqn.edu.vn", name: "ThS. Lê Văn Thí (Trưởng phòng QLĐT)", role: UserRole.TRUONG_PHONG, departmentId: "P_QLDT", title: "Trưởng phòng Quản lý Đào tạo", phone: "0913.789.012", passwordHash: defaultPasswordHash },
    { email: "daotao@cdktcnqn.edu.vn", name: "Phòng Quản lý Đào tạo", role: UserRole.TRUONG_PHONG, departmentId: "P_QLDT", title: "Phòng Quản lý Đào tạo", phone: "0256.3846.477", passwordHash: qcet2026PasswordHash },
    { email: "lephuongthuyoanh@cdktcnqn.edu.vn", name: "ThS. Lê Phương Thúy Oanh (Trưởng phòng TC)", role: UserRole.TRUONG_PHONG, departmentId: "P_TC", title: "Trưởng phòng Tài chính", phone: "0913.234.567", passwordHash: defaultPasswordHash },
    { email: "taichinh@cdktcnqn.edu.vn", name: "Phòng Tài chính", role: UserRole.TRUONG_PHONG, departmentId: "P_TC", title: "Phòng Tài chính", phone: "0256.3846.483", passwordHash: qcet2026PasswordHash },
    { email: "phongnt@cdktcnqn.edu.vn", name: "ThS. Nguyễn Tiến Phong (Trưởng phòng TC-ĐBCL)", role: UserRole.TRUONG_PHONG, departmentId: "P_TCDBCL", title: "Trưởng phòng TC-ĐBCL", phone: "0914.123.456", passwordHash: defaultPasswordHash },
    { email: "tochuc@cdktcnqn.edu.vn", name: "Phòng Tổ chức - ĐBCL", role: UserRole.TRUONG_PHONG, departmentId: "P_TCDBCL", title: "Phòng Tổ chức - ĐBCL", phone: "0256.3846.480", passwordHash: qcet2026PasswordHash },
    { email: "vynq@cdktcnqn.edu.vn", name: "ThS. Nguyễn Quốc Vỹ (Trưởng phòng TS-HTQT)", role: UserRole.TRUONG_PHONG, departmentId: "P_TSHTQT", title: "Trưởng phòng Tuyển sinh - Hợp tác quốc tế", phone: "0918.345.678", passwordHash: defaultPasswordHash },
    { email: "tuyensinh@cdktcnqn.edu.vn", name: "Phòng Tuyển sinh - Hợp tác quốc tế", role: UserRole.TRUONG_PHONG, departmentId: "P_TSHTQT", title: "Phòng Tuyển sinh - HTQT", phone: "0256.3846.482", passwordHash: qcet2026PasswordHash },
    { email: "hanhchinh@cdktcnqn.edu.vn", name: "ThS. Phan Văn Thanh (Trưởng phòng HC-QT)", role: UserRole.TRUONG_PHONG, departmentId: "P_HCQT", title: "Trưởng phòng Hành chính - Quản trị", phone: "0912.333.444", passwordHash: defaultPasswordHash },
    { email: "vinhnn@cdktcnqn.edu.vn", name: "KS. Nguyễn Ngọc Vinh (Phó Giám đốc phụ trách TT Số - Truyền thông)", role: UserRole.TRUONG_PHONG, departmentId: "TT_STT", title: "Phó Giám đốc TT Số - Truyền thông", phone: "0905.111.222", passwordHash: defaultPasswordHash },
    { email: "quantrimang@cdktcnqn.edu.vn", name: "Trung tâm Số - Truyền thông", role: UserRole.ADMIN, departmentId: "TT_STT", title: "Trung tâm Số - Truyền thông", phone: "0256.3846.484", passwordHash: qcet2026PasswordHash },
    { email: "xuanmdt@cdktcnqn.edu.vn", name: "ThS. Mai Đinh Thị Xuân (Phó Giám đốc TT Số - Truyền thông)", role: UserRole.CHUYEN_VIEN, departmentId: "TT_STT", title: "Phó Giám đốc TT Số - Truyền thông", phone: "0914.555.666", passwordHash: defaultPasswordHash },

    // 9 Khoa chuyên môn & Trung tâm Ngoại ngữ - Tin học
    { email: "k.cntt@cdktcnqn.edu.vn", name: "TS. Nguyễn Ngọc Vinh (Trưởng khoa Điện tử - Tin học)", role: UserRole.TRUONG_PHONG, departmentId: "K_CNTT", title: "Trưởng khoa Điện tử - Tin học", phone: "0905.111.222", passwordHash: defaultPasswordHash },
    { email: "hungth@cdktcnqn.edu.vn", name: "ThS. Trần Hùng (Phó Trưởng khoa Điện tử - Tin học)", role: UserRole.CHUYEN_VIEN, departmentId: "K_CNTT", title: "Phó Trưởng khoa (ATTT)", phone: "0914.222.333", passwordHash: qcet2026PasswordHash },
    { email: "khoipd@cdktcnqn.edu.vn", name: "ThS. Phan Đình Khôi (Giảng viên CNTT)", role: UserRole.CHUYEN_VIEN, departmentId: "K_CNTT", title: "Giảng viên CNTT", phone: "0988.555.777", passwordHash: defaultPasswordHash },
    { email: "cuongdq@cdktcnqn.edu.vn", name: "TS. Đinh Quốc Cường (Trưởng khoa Cơ khí)", role: UserRole.TRUONG_PHONG, departmentId: "K_CK", title: "Trưởng khoa Cơ khí", phone: "0913.999.111", passwordHash: defaultPasswordHash },
    { email: "thangnv@cdktcnqn.edu.vn", name: "ThS. Nguyễn Văn Thắng (Trưởng khoa Điện)", role: UserRole.TRUONG_PHONG, departmentId: "K_DIEN", title: "Trưởng khoa Điện", phone: "0914.444.888", passwordHash: defaultPasswordHash },
    { email: "hungvm@cdktcnqn.edu.vn", name: "ThS. Vũ Mạnh Hùng (Trưởng khoa Công nghệ Ô tô)", role: UserRole.TRUONG_PHONG, departmentId: "K_CNOTO", title: "Trưởng khoa Công nghệ Ô tô", phone: "0913.777.999", passwordHash: defaultPasswordHash },
    { email: "thaoptt@cdktcnqn.edu.vn", name: "ThS. Phan Thị Thanh Thảo (Trưởng khoa Du lịch - Dịch vụ)", role: UserRole.TRUONG_PHONG, departmentId: "K_DULICH", title: "Trưởng khoa Du lịch - Dịch vụ", phone: "0913.888.222", passwordHash: defaultPasswordHash },
    { email: "tuyetla@cdktcnqn.edu.vn", name: "ThS. Lê Thị Ánh Tuyết (Trưởng khoa Kinh tế - Tổng hợp)", role: UserRole.TRUONG_PHONG, departmentId: "K_KTQT", title: "Trưởng khoa Kinh tế - Tổng hợp", phone: "0914.999.555", passwordHash: defaultPasswordHash },
    { email: "dungnh@cdktcnqn.edu.vn", name: "ThS. Nguyễn Hữu Dũng (Trưởng khoa Kỹ thuật Nông nghiệp)", role: UserRole.TRUONG_PHONG, departmentId: "K_KTNN", title: "Trưởng khoa Kỹ thuật Nông nghiệp", phone: "0913.123.999", passwordHash: defaultPasswordHash },
    { email: "hanhdtm@cdktcnqn.edu.vn", name: "ThS. Đặng Thị Mỹ Hạnh (Trưởng khoa Văn hóa Nghệ thuật)", role: UserRole.TRUONG_PHONG, departmentId: "K_VHNT", title: "Trưởng khoa Văn hóa Nghệ thuật", phone: "0914.666.333", passwordHash: defaultPasswordHash },
    { email: "minhttt@cdktcnqn.edu.vn", name: "ThS. Trịnh Thị Thu Minh (Trưởng khoa Văn hóa THPT & KHCB)", role: UserRole.TRUONG_PHONG, departmentId: "K_DAICUONG", title: "Trưởng khoa Văn hóa THPT & KHCB", phone: "0913.555.777", passwordHash: defaultPasswordHash },
    { email: "thangcd@cdktcnqn.edu.vn", name: "ThS. Chu Đình Thắng (Giám đốc TT Ngoại ngữ - Tin học)", role: UserRole.TRUONG_PHONG, departmentId: "TT_NNTH", title: "Giám đốc TT Ngoại ngữ - Tin học", phone: "0903.999.888", passwordHash: defaultPasswordHash },
  ];

  const userMap: Record<string, string> = {};
  for (const u of users) {
    const created = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        role: u.role,
        departmentId: u.departmentId,
        title: u.title,
        phone: u.phone,
        passwordHash: u.passwordHash,
      },
      create: u,
    });
    userMap[u.email] = created.id;
  }

  // 3. Tạo 40 Nhiệm vụ mẫu trải đều qua 12 tháng học vụ và 11 đơn vị
    const adminId = userMap["admin@cdktcnqn.edu.vn"];
  const bghOwnerId = userMap["tuongpv@cdktcnqn.edu.vn"] || userMap["bgh@cdktcnqn.edu.vn"];
  const pdtOwnerId = userMap["levanthi@cdktcnqn.edu.vn"] || userMap["daotao@cdktcnqn.edu.vn"];
  const cnttOwnerId = userMap["k.cntt@cdktcnqn.edu.vn"] || userMap["vinhnn@cdktcnqn.edu.vn"];
  const gvId = userMap["khoipd@cdktcnqn.edu.vn"] || userMap["hungth@cdktcnqn.edu.vn"];
  const ckOwnerId = userMap["cuongdq@cdktcnqn.edu.vn"];
  const dienOwnerId = userMap["thangnv@cdktcnqn.edu.vn"];
  const otoOwnerId = userMap["hungvm@cdktcnqn.edu.vn"];
  const cthssvOwnerId = userMap["vynq@cdktcnqn.edu.vn"] || userMap["tuyensinh@cdktcnqn.edu.vn"];
  const qctbOwnerId = userMap["hanhchinh@cdktcnqn.edu.vn"];
  const tcktOwnerId = userMap["lephuongthuyoanh@cdktcnqn.edu.vn"] || userMap["taichinh@cdktcnqn.edu.vn"];
  const lxOwnerId = userMap["vinhnn@cdktcnqn.edu.vn"];
  const tsOwnerId = userMap["vynq@cdktcnqn.edu.vn"];
  const cvId = userMap["hungth@cdktcnqn.edu.vn"] || userMap["vinhnn@cdktcnqn.edu.vn"];
  const phoHieuTruongId = userMap["kiemtt@cdktcnqn.edu.vn"] || userMap["nguyenlx@cdktcnqn.edu.vn"];

  interface SampleTaskItem {
    code: string;
    title: string;
    description: string;
    scope: TaskScope;
    status: TaskStatus;
    priority: TaskPriority;
    progressPercent: number;
    academicMonth: number;
    academicYear: string;
    dueDate: Date;
    departmentId: string;
    createdById: string;
    assigneeId?: string;
    collaboratorIds?: string[];
  }

  const sampleTasks: SampleTaskItem[] = [
    // --- THÁNG 9/2026 ---
    {
      code: 'NV-2026-09-001',
      title: 'Hoàn thiện hồ sơ đánh giá và cấp chứng chỉ chuẩn kỹ năng nghề CNTT năm học 2026',
      description: 'Tổng hợp danh sách sinh viên đủ điều kiện, lập hội đồng thẩm định kết quả thi sát hạch.',
      scope: TaskScope.SCHOOL,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      progressPercent: 70,
      academicMonth: 9,
      academicYear: '2026-2027',
      dueDate: new Date('2026-09-24T17:00:00Z'),
      departmentId: 'khoa-cntt',
      createdById: adminId,
      assigneeId: cnttOwnerId,
      collaboratorIds: [gvId, cvId],
    },
    {
      code: 'NV-2026-09-002',
      title: 'Kiểm tra công tác chuẩn bị cơ sở vật chất và thời khóa biểu học kỳ 1 năm học 2026-2027',
      description: 'Rà soát xưởng thực hành và phòng máy trước ngày 15/09.',
      scope: TaskScope.SCHOOL,
      status: TaskStatus.WAITING_APPROVAL,
      priority: TaskPriority.URGENT,
      progressPercent: 90,
      academicMonth: 9,
      academicYear: '2026-2027',
      dueDate: new Date('2026-09-18T17:00:00Z'),
      departmentId: 'phong-dao-tao',
      createdById: adminId,
      assigneeId: pdtOwnerId,
      collaboratorIds: [qctbOwnerId, cnttOwnerId],
    },
    {
      code: 'NV-2026-09-003',
      title: 'Biên soạn đề cương chi tiết môn Lập trình Web Nâng cao theo chuẩn DACUM',
      description: 'Cập nhật công nghệ Next.js 15 và Tailwind CSS v4 vào chương trình giảng dạy.',
      scope: TaskScope.DEPARTMENT,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.NORMAL,
      progressPercent: 40,
      academicMonth: 9,
      academicYear: '2026-2027',
      dueDate: new Date('2026-09-22T17:00:00Z'),
      departmentId: 'khoa-cntt',
      createdById: cnttOwnerId,
      assigneeId: gvId,
      collaboratorIds: [cnttOwnerId, pdtOwnerId],
    },
    {
      code: 'NV-2026-09-004',
      title: 'Tổ chức Lễ Khai giảng và Tuần sinh hoạt công dân đầu khóa cho tân sinh viên K26',
      description: 'Đón tiếp tân sinh viên, cấp phát thẻ sinh viên tích hợp ngân hàng và tài liệu học tập.',
      scope: TaskScope.SCHOOL,
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.HIGH,
      progressPercent: 100,
      academicMonth: 9,
      academicYear: '2026-2027',
      dueDate: new Date('2026-09-15T17:00:00Z'),
      departmentId: 'phong-cthssv',
      createdById: adminId,
      assigneeId: cthssvOwnerId,
      collaboratorIds: [pdtOwnerId, tsOwnerId, qctbOwnerId],
    },

    // --- THÁNG 10/2026 ---
    {
      code: 'NV-2026-10-005',
      title: 'Kiểm tra định kỳ an toàn lao động và bảo dưỡng máy CNC xưởng Cơ khí chế tạo',
      description: 'Kiểm định hệ thống điện ba pha và tiếp địa các buồng gia công CNC xưởng thực hành Cơ khí.',
      scope: TaskScope.DEPARTMENT,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      progressPercent: 60,
      academicMonth: 10,
      academicYear: '2026-2027',
      dueDate: new Date('2026-10-15T17:00:00Z'),
      departmentId: 'khoa-co-khi',
      createdById: pdtOwnerId,
      assigneeId: ckOwnerId,
      collaboratorIds: [qctbOwnerId],
    },
    {
      code: 'NV-2026-10-006',
      title: 'Rà soát đối chiếu hồ sơ tuyển sinh đợt bổ sung và cập nhật dữ liệu Bộ LĐTBXH',
      description: 'Kiểm tra thông tin căn cước công dân và học bạ của thí sinh trúng tuyển đợt 2.',
      scope: TaskScope.SCHOOL,
      status: TaskStatus.NOT_STARTED,
      priority: TaskPriority.NORMAL,
      progressPercent: 0,
      academicMonth: 10,
      academicYear: '2026-2027',
      dueDate: new Date('2026-10-25T17:00:00Z'),
      departmentId: 'tt-tuyensinh',
      createdById: adminId,
      assigneeId: tsOwnerId,
      collaboratorIds: [pdtOwnerId],
    },
    {
      code: 'NV-2026-10-007',
      title: 'Quyết toán kinh phí mua sắm vật tư thực hành học kỳ 1 các khoa kỹ thuật',
      description: 'Kiểm tra hóa đơn chứng từ phôi thép, linh kiện điện tử, dầu mỡ bôi trơn máy móc.',
      scope: TaskScope.DEPARTMENT,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.NORMAL,
      progressPercent: 50,
      academicMonth: 10,
      academicYear: '2026-2027',
      dueDate: new Date('2026-10-30T17:00:00Z'),
      departmentId: 'phong-tckt',
      createdById: adminId,
      assigneeId: tcktOwnerId,
      collaboratorIds: [ckOwnerId, dienOwnerId, otoOwnerId],
    },
    {
      code: 'NV-2026-10-008',
      title: 'Nâng cấp hệ thống mạng Campus Wi-Fi và tường lửa bảo mật trung tâm dữ liệu',
      description: 'Triển khai thêm 15 Access Point băng tần kép tại khu giảng đường và cấu hình VLAN mới.',
      scope: TaskScope.DEPARTMENT,
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.HIGH,
      progressPercent: 100,
      academicMonth: 10,
      academicYear: '2026-2027',
      dueDate: new Date('2026-10-20T17:00:00Z'),
      departmentId: 'khoa-cntt',
      createdById: cnttOwnerId,
      assigneeId: gvId,
    },

    // --- THÁNG 11/2026 ---
    {
      code: 'NV-2026-11-009',
      title: 'Tổ chức Hội thi Giáo viên dạy giỏi cấp trường chào mừng ngày Nhà giáo Việt Nam 20/11',
      description: 'Thành lập ban giám khảo, sắp xếp lịch thao giảng và tổng hợp điểm thi đua.',
      scope: TaskScope.SCHOOL,
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.HIGH,
      progressPercent: 100,
      academicMonth: 11,
      academicYear: '2026-2027',
      dueDate: new Date('2026-11-19T17:00:00Z'),
      departmentId: 'phong-dao-tao',
      createdById: adminId,
      assigneeId: pdtOwnerId,
      collaboratorIds: [cnttOwnerId, ckOwnerId, dienOwnerId],
    },
    {
      code: 'NV-2026-11-010',
      title: 'Triển khai mô hình đào tạo xe điện và trạm sạc thông minh tại xưởng thực hành Ô tô',
      description: 'Lắp ráp mô hình cắt bổ xe Hybrid và hệ thống pin Lithium phục vụ học phần Xe thế hệ mới.',
      scope: TaskScope.DEPARTMENT,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      progressPercent: 45,
      academicMonth: 11,
      academicYear: '2026-2027',
      dueDate: new Date('2026-11-28T17:00:00Z'),
      departmentId: 'khoa-oto',
      createdById: pdtOwnerId,
      assigneeId: otoOwnerId,
    },
    {
      code: 'NV-2026-11-011',
      title: 'Lập dự toán bảo trì thiết bị thí nghiệm hệ thống điện công nghiệp và tự động hóa',
      description: 'Khảo sát hiện trạng các panel thực hành PLC Siemens S7-1200 và biến tần Schneider.',
      scope: TaskScope.DEPARTMENT,
      status: TaskStatus.WAITING_APPROVAL,
      priority: TaskPriority.NORMAL,
      progressPercent: 80,
      academicMonth: 11,
      academicYear: '2026-2027',
      dueDate: new Date('2026-11-25T17:00:00Z'),
      departmentId: 'khoa-dien',
      createdById: pdtOwnerId,
      assigneeId: dienOwnerId,
    },
    {
      code: 'NV-2026-11-012',
      title: 'Tổ chức giải thể thao truyền thống học sinh sinh viên QCET năm học 2026-2027',
      description: 'Điều lệ giải bóng đá, bóng chuyền và kéo co chào mừng ngày truyền thống nhà trường.',
      scope: TaskScope.SCHOOL,
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.LOW,
      progressPercent: 100,
      academicMonth: 11,
      academicYear: '2026-2027',
      dueDate: new Date('2026-11-18T17:00:00Z'),
      departmentId: 'phong-cthssv',
      createdById: adminId,
      assigneeId: cthssvOwnerId,
    },

    // --- THÁNG 12/2026 ---
    {
      code: 'NV-2026-12-013',
      title: 'Tổ chức kỳ thi tốt nghiệp và sát hạch cấp giấy phép lái xe ô tô hạng B2, C khóa 48',
      description: 'Kiểm tra thiết bị DAT giám sát hành trình và chuẩn bị 20 xe sát hạch gắn camera buồng lái.',
      scope: TaskScope.SCHOOL,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.URGENT,
      progressPercent: 85,
      academicMonth: 12,
      academicYear: '2026-2027',
      dueDate: new Date('2026-12-20T17:00:00Z'),
      departmentId: 'tt-laixe',
      createdById: adminId,
      assigneeId: lxOwnerId,
    },
    {
      code: 'NV-2026-12-014',
      title: 'Tổ chức coi thi và chấm thi học kỳ 1 năm học 2026-2027 toàn trường',
      description: 'In sao đề thi bảo mật, bố trí giám thị coi thi và thu nhận bài thi về phòng khảo thí.',
      scope: TaskScope.SCHOOL,
      status: TaskStatus.WAITING_APPROVAL,
      priority: TaskPriority.HIGH,
      progressPercent: 95,
      academicMonth: 12,
      academicYear: '2026-2027',
      dueDate: new Date('2026-12-28T17:00:00Z'),
      departmentId: 'phong-dao-tao',
      createdById: adminId,
      assigneeId: pdtOwnerId,
      collaboratorIds: [cnttOwnerId, cthssvOwnerId],
    },
    {
      code: 'NV-2026-12-015',
      title: 'Kiểm kê tài sản, trang thiết bị máy móc cuối năm 2026 tại các đơn vị',
      description: 'Lập biên bản đánh giá hao mòn và đề xuất thanh lý máy móc hư hỏng không thể phục hồi.',
      scope: TaskScope.SCHOOL,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.NORMAL,
      progressPercent: 65,
      academicMonth: 12,
      academicYear: '2026-2027',
      dueDate: new Date('2026-12-30T17:00:00Z'),
      departmentId: 'phong-qctb',
      createdById: adminId,
      assigneeId: qctbOwnerId,
      collaboratorIds: [tcktOwnerId, ckOwnerId, cnttOwnerId],
    },
    {
      code: 'NV-2026-12-016',
      title: 'Báo cáo tổng kết công tác chuyển đổi số và vận hành hệ thống E-Office năm 2026',
      description: 'Thống kê tỷ lệ xử lý văn bản điện tử và ký số đạt trên 90% theo chỉ tiêu BGH giao.',
      scope: TaskScope.SCHOOL,
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.HIGH,
      progressPercent: 100,
      academicMonth: 12,
      academicYear: '2026-2027',
      dueDate: new Date('2026-12-31T17:00:00Z'),
      departmentId: 'ban-giam-hieu',
      createdById: adminId,
      assigneeId: bghOwnerId,
    },

    // --- THÁNG 1/2027 ---
    {
      code: 'NV-2027-01-017',
      title: 'Xây dựng kế hoạch đào tạo và phân công giảng dạy học kỳ 2 năm học 2026-2027',
      description: 'Cân đối giờ giảng định mức cán bộ giáo viên và ban hành thời khóa biểu chính thức.',
      scope: TaskScope.SCHOOL,
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.URGENT,
      progressPercent: 100,
      academicMonth: 1,
      academicYear: '2026-2027',
      dueDate: new Date('2027-01-15T17:00:00Z'),
      departmentId: 'phong-dao-tao',
      createdById: adminId,
      assigneeId: pdtOwnerId,
    },
    {
      code: 'NV-2027-01-018',
      title: 'Chăm lo quà Tết và hỗ trợ vé xe cho sinh viên khó khăn về quê đón Tết Nguyên Đán',
      description: 'Trao 120 suất học bổng và vé xe miễn phí cho đoàn viên thanh niên có hoàn cảnh đặc biệt.',
      scope: TaskScope.SCHOOL,
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.HIGH,
      progressPercent: 100,
      academicMonth: 1,
      academicYear: '2026-2027',
      dueDate: new Date('2027-01-20T17:00:00Z'),
      departmentId: 'phong-cthssv',
      createdById: adminId,
      assigneeId: cthssvOwnerId,
    },
    {
      code: 'NV-2027-01-019',
      title: 'Kiểm tra niêm phong phòng học, xưởng thực hành và trực phòng chống cháy nổ dịp Tết',
      description: 'Phân công ca trực bảo vệ 24/7 và ngắt cầu dao tổng toàn bộ các xưởng gia công cơ khí, ô tô.',
      scope: TaskScope.SCHOOL,
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.HIGH,
      progressPercent: 100,
      academicMonth: 1,
      academicYear: '2026-2027',
      dueDate: new Date('2027-01-26T17:00:00Z'),
      departmentId: 'phong-qctb',
      createdById: adminId,
      assigneeId: qctbOwnerId,
      collaboratorIds: [otoOwnerId, ckOwnerId, dienOwnerId],
    },

    // --- THÁNG 2/2027 ---
    {
      code: 'NV-2027-02-020',
      title: 'Khởi động chiến dịch tư vấn hướng nghiệp và tuyển sinh năm 2027 tại các trường THPT',
      description: 'Phát hành cẩm nang tuyển sinh điện tử và cử đoàn công tác đến 45 trường THPT khu vực.',
      scope: TaskScope.SCHOOL,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      progressPercent: 50,
      academicMonth: 2,
      academicYear: '2026-2027',
      dueDate: new Date('2027-02-28T17:00:00Z'),
      departmentId: 'tt-tuyensinh',
      createdById: adminId,
      assigneeId: tsOwnerId,
    },
    {
      code: 'NV-2027-02-021',
      title: 'Ổn định sĩ số, nề nếp học tập và kiểm tra giảng dạy các lớp sau kỳ nghỉ Tết',
      description: 'Điểm danh đầu tuần và báo cáo tỷ lệ sinh viên quay lại giảng đường đạt trên 98%.',
      scope: TaskScope.SCHOOL,
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.NORMAL,
      progressPercent: 100,
      academicMonth: 2,
      academicYear: '2026-2027',
      dueDate: new Date('2027-02-12T17:00:00Z'),
      departmentId: 'phong-dao-tao',
      createdById: adminId,
      assigneeId: pdtOwnerId,
    },
    {
      code: 'NV-2027-02-022',
      title: 'Nghiên cứu phát triển module AI trợ lý học tập tích hợp cổng sinh viên QCET',
      description: 'Thử nghiệm chatbot giải đáp quy chế đào tạo và tra cứu điểm tích lũy học phần.',
      scope: TaskScope.INDIVIDUAL,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.NORMAL,
      progressPercent: 30,
      academicMonth: 2,
      academicYear: '2026-2027',
      dueDate: new Date('2027-02-25T17:00:00Z'),
      departmentId: 'khoa-cntt',
      createdById: cnttOwnerId,
      assigneeId: gvId,
    },

    // --- THÁNG 3/2027 ---
    {
      code: 'NV-2027-03-023',
      title: 'Tổ chức Hội thi tay nghề giỏi sinh viên cấp trường các nghề Hàn, Tiện CNC, Cơ điện tử',
      description: 'Tuyển chọn 12 thí sinh xuất sắc tham dự Hội thi tay nghề cấp Thành phố năm 2027.',
      scope: TaskScope.SCHOOL,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      progressPercent: 75,
      academicMonth: 3,
      academicYear: '2026-2027',
      dueDate: new Date('2027-03-22T17:00:00Z'),
      departmentId: 'khoa-co-khi',
      createdById: pdtOwnerId,
      assigneeId: ckOwnerId,
      collaboratorIds: [dienOwnerId, pdtOwnerId],
    },
    {
      code: 'NV-2027-03-024',
      title: 'Ký kết thỏa thuận hợp tác đào tạo kép và tuyển dụng với Hiệp hội Doanh nghiệp Cơ khí',
      description: 'Mở rộng 15 doanh nghiệp tiếp nhận thực tập có hưởng lương cho sinh viên khoa Cơ khí và Ô tô.',
      scope: TaskScope.SCHOOL,
      status: TaskStatus.WAITING_APPROVAL,
      priority: TaskPriority.HIGH,
      progressPercent: 90,
      academicMonth: 3,
      academicYear: '2026-2027',
      dueDate: new Date('2027-03-26T17:00:00Z'),
      departmentId: 'ban-giam-hieu',
      createdById: adminId,
      assigneeId: bghOwnerId,
    },
    {
      code: 'NV-2027-03-025',
      title: 'Chuẩn bị hồ sơ mở mới mã ngành Kỹ thuật Robot và Tự động hóa công nghiệp',
      description: 'Khảo sát nhu cầu nhân lực bán dẫn và tự động hóa tại các khu chế xuất, khu công nghệ cao.',
      scope: TaskScope.DEPARTMENT,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      progressPercent: 55,
      academicMonth: 3,
      academicYear: '2026-2027',
      dueDate: new Date('2027-03-30T17:00:00Z'),
      departmentId: 'khoa-dien',
      createdById: pdtOwnerId,
      assigneeId: dienOwnerId,
    },
    {
      code: 'NV-2027-03-026',
      title: 'Phát động chuỗi hoạt động Tháng Thanh niên và Ngày hội hiến máu tình nguyện 26/3',
      description: 'Tiếp nhận hơn 300 đơn vị máu an toàn và ra quân dọn dẹp vệ sinh môi trường học đường.',
      scope: TaskScope.SCHOOL,
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.NORMAL,
      progressPercent: 100,
      academicMonth: 3,
      academicYear: '2026-2027',
      dueDate: new Date('2027-03-26T17:00:00Z'),
      departmentId: 'phong-cthssv',
      createdById: adminId,
      assigneeId: cthssvOwnerId,
    },

    // --- THÁNG 4/2027 ---
    {
      code: 'NV-2027-04-027',
      title: 'Tổ chức Ngày hội việc làm QCET Job Fair 2027 với hơn 50 doanh nghiệp tham gia',
      description: 'Kết nối phỏng vấn trực tiếp tại sân trường cho hơn 800 sinh viên tốt nghiệp năm 2027.',
      scope: TaskScope.SCHOOL,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.URGENT,
      progressPercent: 80,
      academicMonth: 4,
      academicYear: '2026-2027',
      dueDate: new Date('2027-04-20T17:00:00Z'),
      departmentId: 'phong-cthssv',
      createdById: adminId,
      assigneeId: cthssvOwnerId,
      collaboratorIds: [tsOwnerId, ckOwnerId, cnttOwnerId, otoOwnerId],
    },
    {
      code: 'NV-2027-04-028',
      title: 'Kiểm tra tiến độ thực tập doanh nghiệp của sinh viên năm cuối khóa 24',
      description: 'Đoàn công tác đi thực tế tại các nhà máy ô tô và xí nghiệp may mặc, kiểm tra sổ nhật ký thực tập.',
      scope: TaskScope.DEPARTMENT,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.NORMAL,
      progressPercent: 60,
      academicMonth: 4,
      academicYear: '2026-2027',
      dueDate: new Date('2027-04-25T17:00:00Z'),
      departmentId: 'phong-dao-tao',
      createdById: adminId,
      assigneeId: pdtOwnerId,
      collaboratorIds: [cthssvOwnerId, ckOwnerId, otoOwnerId],
    },
    {
      code: 'NV-2027-04-029',
      title: 'Bảo dưỡng định kỳ dàn xe tập lái và sân bãi sa hình sát hạch lái xe',
      description: 'Thay dầu, kiểm tra hệ thống phanh phụ và cảm biến chấm điểm tự động trên toàn bộ sân sát hạch.',
      scope: TaskScope.DEPARTMENT,
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.NORMAL,
      progressPercent: 100,
      academicMonth: 4,
      academicYear: '2026-2027',
      dueDate: new Date('2027-04-15T17:00:00Z'),
      departmentId: 'tt-laixe',
      createdById: adminId,
      assigneeId: lxOwnerId,
    },

    // --- THÁNG 5/2027 ---
    {
      code: 'NV-2027-05-030',
      title: 'Phê duyệt danh sách đề tài và hội đồng bảo vệ khóa luận tốt nghiệp ngành CNTT',
      description: 'Thẩm định 45 đề tài ứng dụng AI, IoT và Hệ thống thông tin doanh nghiệp.',
      scope: TaskScope.DEPARTMENT,
      status: TaskStatus.WAITING_APPROVAL,
      priority: TaskPriority.HIGH,
      progressPercent: 85,
      academicMonth: 5,
      academicYear: '2026-2027',
      dueDate: new Date('2027-05-20T17:00:00Z'),
      departmentId: 'khoa-cntt',
      createdById: cnttOwnerId,
      assigneeId: gvId,
    },
    {
      code: 'NV-2027-05-031',
      title: 'Hoàn tất nghiệm thu đề tài NCKH cấp cơ sở của cán bộ giảng viên năm 2027',
      description: 'Hội đồng khoa học nghiệm thu 8 sáng kiến cải tiến kỹ thuật phục vụ xưởng thực hành.',
      scope: TaskScope.SCHOOL,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.NORMAL,
      progressPercent: 40,
      academicMonth: 5,
      academicYear: '2026-2027',
      dueDate: new Date('2027-05-28T17:00:00Z'),
      departmentId: 'ban-giam-hieu',
      createdById: adminId,
      assigneeId: bghOwnerId,
    },
    {
      code: 'NV-2027-05-032',
      title: 'Đăng cai tổ chức vòng loại Hội thi Lái xe sinh thái và Tiết kiệm nhiên liệu',
      description: 'Phối hợp với Honda Việt Nam tổ chức cuộc thi chạy xe tự chế tiết kiệm xăng cho sinh viên cơ khí ô tô.',
      scope: TaskScope.SCHOOL,
      status: TaskStatus.NOT_STARTED,
      priority: TaskPriority.NORMAL,
      progressPercent: 0,
      academicMonth: 5,
      academicYear: '2026-2027',
      dueDate: new Date('2027-05-25T17:00:00Z'),
      departmentId: 'khoa-oto',
      createdById: pdtOwnerId,
      assigneeId: otoOwnerId,
      collaboratorIds: [lxOwnerId, ckOwnerId],
    },

    // --- THÁNG 6/2027 ---
    {
      code: 'NV-2027-06-033',
      title: 'Tổ chức chấm bảo vệ đồ án tốt nghiệp và xét công nhận tốt nghiệp đợt 1 năm 2027',
      description: 'Tổng hợp bảng điểm toàn khóa, rà soát điều kiện chuẩn đầu ra ngoại ngữ và tin học quốc tế.',
      scope: TaskScope.SCHOOL,
      status: TaskStatus.NOT_STARTED,
      priority: TaskPriority.HIGH,
      progressPercent: 0,
      academicMonth: 6,
      academicYear: '2026-2027',
      dueDate: new Date('2027-06-25T17:00:00Z'),
      departmentId: 'phong-dao-tao',
      createdById: adminId,
      assigneeId: pdtOwnerId,
    },
    {
      code: 'NV-2027-06-034',
      title: 'Thu nhận hồ sơ xét tuyển học bạ THPT đợt 1 và giải đáp thắc mắc trực tuyến',
      description: 'Vận hành tổng đài hotline và hệ thống đăng ký nguyện vọng trực tuyến 24/7.',
      scope: TaskScope.SCHOOL,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.URGENT,
      progressPercent: 35,
      academicMonth: 6,
      academicYear: '2026-2027',
      dueDate: new Date('2027-06-30T17:00:00Z'),
      departmentId: 'tt-tuyensinh',
      createdById: adminId,
      assigneeId: tsOwnerId,
    },
    {
      code: 'NV-2027-06-035',
      title: 'Nâng cấp phần mềm quản lý tài chính và xuất hóa đơn điện tử học phí',
      description: 'Tích hợp cổng thanh toán trực tuyến Napas, VNPay vào phần mềm thu học phí tự động.',
      scope: TaskScope.DEPARTMENT,
      status: TaskStatus.NOT_STARTED,
      priority: TaskPriority.NORMAL,
      progressPercent: 0,
      academicMonth: 6,
      academicYear: '2026-2027',
      dueDate: new Date('2027-06-20T17:00:00Z'),
      departmentId: 'phong-tckt',
      createdById: adminId,
      assigneeId: tcktOwnerId,
    },

    // --- THÁNG 7/2027 ---
    {
      code: 'NV-2027-07-036',
      title: 'Tổ chức Lễ Bế giảng và Trao bằng Tốt nghiệp Cao đẳng, Trung cấp năm 2027',
      description: 'In ấn văn bằng chứng chỉ có phôi bảo an, chuẩn bị lễ phục tốt nghiệp và khánh tiết hội trường.',
      scope: TaskScope.SCHOOL,
      status: TaskStatus.NOT_STARTED,
      priority: TaskPriority.HIGH,
      progressPercent: 0,
      academicMonth: 7,
      academicYear: '2026-2027',
      dueDate: new Date('2027-07-15T17:00:00Z'),
      departmentId: 'phong-cthssv',
      createdById: adminId,
      assigneeId: cthssvOwnerId,
      collaboratorIds: [pdtOwnerId, tcktOwnerId, qctbOwnerId],
    },
    {
      code: 'NV-2027-07-037',
      title: 'Ngày hội Open Day - Trải nghiệm một ngày làm sinh viên kỹ thuật QCET',
      description: 'Mời hơn 1.000 học sinh lớp 12 tham quan xưởng xe hơi, phòng thực hành mạng và robot thông minh.',
      scope: TaskScope.SCHOOL,
      status: TaskStatus.NOT_STARTED,
      priority: TaskPriority.NORMAL,
      progressPercent: 0,
      academicMonth: 7,
      academicYear: '2026-2027',
      dueDate: new Date('2027-07-22T17:00:00Z'),
      departmentId: 'tt-tuyensinh',
      createdById: adminId,
      assigneeId: tsOwnerId,
    },
    {
      code: 'NV-2027-07-038',
      title: 'Nâng cấp trang thiết bị phòng thực hành đo lường và cảm biến thông minh',
      description: 'Lắp đặt 10 bàn thực hành vi điều khiển ARM và kit thí nghiệm IoT phục vụ năm học mới.',
      scope: TaskScope.DEPARTMENT,
      status: TaskStatus.NOT_STARTED,
      priority: TaskPriority.LOW,
      progressPercent: 0,
      academicMonth: 7,
      academicYear: '2026-2027',
      dueDate: new Date('2027-07-28T17:00:00Z'),
      departmentId: 'khoa-dien',
      createdById: pdtOwnerId,
      assigneeId: dienOwnerId,
    },

    // --- THÁNG 8/2027 ---
    {
      code: 'NV-2027-08-039',
      title: 'Tổ chức khóa tập huấn phương pháp giảng dạy tích hợp số và kỹ năng sư phạm nghề',
      description: 'Bồi dưỡng chuyên môn kỹ năng giảng dạy số trên nền tảng Canvas LMS cho 150 giảng viên.',
      scope: TaskScope.SCHOOL,
      status: TaskStatus.NOT_STARTED,
      priority: TaskPriority.HIGH,
      progressPercent: 0,
      academicMonth: 8,
      academicYear: '2026-2027',
      dueDate: new Date('2027-08-18T17:00:00Z'),
      departmentId: 'phong-dao-tao',
      createdById: adminId,
      assigneeId: pdtOwnerId,
    },
    {
      code: 'NV-2027-08-040',
      title: 'Sửa chữa lớn hệ thống phòng học lý thuyết và xưởng ô tô chuẩn bị năm học mới 2027-2028',
      description: 'Sơn sửa khối nhà học B, thay bóng đèn LED tiết kiệm điện và làm mới mặt sàn xưởng cơ khí động lực.',
      scope: TaskScope.SCHOOL,
      status: TaskStatus.OVERDUE,
      priority: TaskPriority.URGENT,
      progressPercent: 20,
      academicMonth: 8,
      academicYear: '2026-2027',
      dueDate: new Date('2027-08-10T17:00:00Z'),
      departmentId: 'phong-qctb',
      createdById: adminId,
      assigneeId: qctbOwnerId,
    },
  ];

  for (const t of sampleTasks) {
    const { assigneeId, collaboratorIds, ...taskData } = t;
    const task = await prisma.task.upsert({
      where: { code: t.code },
      update: taskData,
      create: taskData,
    });

    if (assigneeId) {
      await prisma.taskAssignee.upsert({
        where: {
          taskId_userId_roleInTask: {
            taskId: task.id,
            userId: assigneeId,
            roleInTask: AssigneeRole.PRIMARY_OWNER,
          },
        },
        update: {},
        create: {
          taskId: task.id,
          userId: assigneeId,
          roleInTask: AssigneeRole.PRIMARY_OWNER,
        },
      });
    }

    if (collaboratorIds && collaboratorIds.length > 0) {
      for (const collabId of collaboratorIds) {
        await prisma.taskAssignee.upsert({
          where: {
            taskId_userId_roleInTask: {
              taskId: task.id,
              userId: collabId,
              roleInTask: AssigneeRole.COLLABORATOR,
            },
          },
          update: {},
          create: {
            taskId: task.id,
            userId: collabId,
            roleInTask: AssigneeRole.COLLABORATOR,
          },
        });
      }
    }
  }

  // 4. Khởi tạo Bộ đếm số tự động NĐ 30/2020 (DocumentNumberSequence)
  const sequences = [
    { type: DocumentType.VAN_BAN_DEN, year: 2026, lastNumber: 7 },
    { type: DocumentType.VAN_BAN_DI, year: 2026, lastNumber: 5 },
    { type: DocumentType.TO_TRINH_NOI_BO, year: 2026, lastNumber: 4 },
  ];

  for (const seq of sequences) {
    await prisma.documentNumberSequence.upsert({
      where: {
        type_year: {
          type: seq.type,
          year: seq.year,
        },
      },
      update: {
        lastNumber: seq.lastNumber,
      },
      create: {
        type: seq.type,
        year: seq.year,
        lastNumber: seq.lastNumber,
      },
    });
  }

  // 5. Nạp danh mục 16 Văn bản chuẩn Nghị định 30/2020/NĐ-CP
  const taskByCode = await prisma.task.findMany({ select: { id: true, code: true } });
  const taskCodeMap = Object.fromEntries(taskByCode.map((t) => [t.code, t.id]));
  const vanThuId = userMap["vanthu@cdktcnqn.edu.vn"] || adminId;

  interface SampleDocumentItem {
    type: DocumentType;
    registrationNumber: number;
    documentYear: number;
    registeredDate: Date;
    originalNumber: string;
    issuedDate: Date;
    issuingAuthority: string;
    category: string;
    summary: string;
    urgency: DocumentUrgency;
    securityLevel: DocumentSecurityLevel;
    status: DocumentStatus;
    signerName?: string;
    signerTitle?: string;
    draftingDeptId?: string;
    recipientList?: string;
    distributedCopies?: number;
    dueDate?: Date;
    leadDepartmentId?: string;
    leadUserId?: string;
    notes?: string;
    linkedTaskCode?: string;
    directives?: Array<{
      leaderId: string;
      instruction: string;
      deadline?: Date;
      assignedDeptId: string;
      collaboratorIds?: string;
      isTaskGenerated?: boolean;
    }>;
    attachments?: Array<{
      fileName: string;
      fileUrl: string;
      fileSize: number;
      mimeType: string;
      sha256Hash?: string;
      isOriginal?: boolean;
    }>;
  }

  const sampleDocuments: SampleDocumentItem[] = [
    // --- VĂN BẢN ĐẾN (VAN_BAN_DEN) ---
    {
      type: DocumentType.VAN_BAN_DEN,
      registrationNumber: 1,
      documentYear: 2026,
      registeredDate: new Date('2026-09-03T09:00:00Z'),
      originalNumber: '128/TCGDNN-VP',
      issuedDate: new Date('2026-09-02T08:00:00Z'),
      issuingAuthority: 'Tổng cục Giáo dục Nghề nghiệp',
      category: 'Hướng dẫn',
      summary: 'V/v Hướng dẫn giao chỉ tiêu tuyển sinh cao đẳng, trung cấp năm học 2026-2027 và đổi mới cấu trúc chuẩn đầu ra theo phương pháp DACUM',
      urgency: DocumentUrgency.KHAN,
      securityLevel: DocumentSecurityLevel.THUONG,
      status: DocumentStatus.DANG_XU_LY,
      dueDate: new Date('2026-09-20T17:00:00Z'),
      leadDepartmentId: 'phong-dao-tao',
      leadUserId: pdtOwnerId,
      linkedTaskCode: 'NV-2026-09-001',
      directives: [
        {
          leaderId: bghOwnerId,
          instruction: 'Giao Phòng Đào tạo chủ trì, phối hợp Khoa CNTT rà soát chuẩn đầu ra DACUM và phân bổ chỉ tiêu cho các khoa chuyên môn.',
          deadline: new Date('2026-09-18T17:00:00Z'),
          assignedDeptId: 'phong-dao-tao',
          collaboratorIds: 'khoa-cntt,tt-tuyensinh',
          isTaskGenerated: true,
        },
      ],
      attachments: [
        {
          fileName: '128_TCGDNN_HuongDan_TuyenSinh_DACUM.pdf',
          fileUrl: '/documents/2026/128_TCGDNN_HuongDan_TuyenSinh_DACUM.pdf',
          fileSize: 2516582,
          mimeType: 'application/pdf',
          isOriginal: true,
        },
      ],
    },
    {
      type: DocumentType.VAN_BAN_DEN,
      registrationNumber: 2,
      documentYear: 2026,
      registeredDate: new Date('2026-09-05T08:30:00Z'),
      originalNumber: '2456/UBND-VX',
      issuedDate: new Date('2026-09-04T08:00:00Z'),
      issuingAuthority: 'UBND Tỉnh Bình Định',
      category: 'Kế hoạch',
      summary: 'Kế hoạch triển khai đề án Chuyển đổi số toàn diện các cơ sở giáo dục nghề nghiệp tỉnh Bình Định giai đoạn 2025–2030',
      urgency: DocumentUrgency.THUONG_KHAN,
      securityLevel: DocumentSecurityLevel.THUONG,
      status: DocumentStatus.DANG_XU_LY,
      dueDate: new Date('2026-09-25T17:00:00Z'),
      leadDepartmentId: 'khoa-cntt',
      leadUserId: cnttOwnerId,
      linkedTaskCode: 'NV-2026-10-008',
      directives: [
        {
          leaderId: bghOwnerId,
          instruction: 'Khoa CNTT chủ trì lập đề cương chi tiết hệ sinh thái số QCET E-Office kết nối trục liên thông của Tỉnh.',
          deadline: new Date('2026-09-22T17:00:00Z'),
          assignedDeptId: 'khoa-cntt',
          collaboratorIds: 'phong-dao-tao,phong-qctb',
          isTaskGenerated: true,
        },
      ],
      attachments: [
        {
          fileName: '2456_UBND_DeAn_ChuyenDoiSo_GDNN.pdf',
          fileUrl: '/documents/2026/2456_UBND_DeAn_ChuyenDoiSo_GDNN.pdf',
          fileSize: 3984588,
          mimeType: 'application/pdf',
          isOriginal: true,
        },
      ],
    },
    {
      type: DocumentType.VAN_BAN_DEN,
      registrationNumber: 3,
      documentYear: 2026,
      registeredDate: new Date('2026-09-06T08:00:00Z'),
      originalNumber: '42/SLĐTBXH-DN',
      issuedDate: new Date('2026-09-05T10:00:00Z'),
      issuingAuthority: 'Sở Lao động - Thương binh & Xã hội',
      category: 'Kế hoạch',
      summary: 'Kế hoạch thanh kiểm tra công tác an toàn lao động, vệ sinh công nghiệp và tiêu chuẩn kiểm định chất lượng xưởng thực hành năm học 2026–2027',
      urgency: DocumentUrgency.THUONG,
      securityLevel: DocumentSecurityLevel.THUONG,
      status: DocumentStatus.DANG_XU_LY,
      dueDate: new Date('2026-10-10T17:00:00Z'),
      leadDepartmentId: 'phong-qctb',
      leadUserId: qctbOwnerId,
      directives: [
        {
          leaderId: phoHieuTruongId,
          instruction: 'Phòng Quản trị - Thiết bị phối hợp các khoa kỹ thuật tổng kiểm tra hệ thống tiếp địa và phương tiện PCCC xưởng thực hành.',
          deadline: new Date('2026-09-30T17:00:00Z'),
          assignedDeptId: 'phong-qctb',
          collaboratorIds: 'khoa-co-khi,khoa-dien,khoa-oto',
          isTaskGenerated: false,
        },
      ],
      attachments: [
        {
          fileName: '42_SLDTBXH_KeHoach_KiemDinh_Xuong.pdf',
          fileUrl: '/documents/2026/42_SLDTBXH_KeHoach_KiemDinh_Xuong.pdf',
          fileSize: 1677721,
          mimeType: 'application/pdf',
          isOriginal: true,
        },
      ],
    },
    {
      type: DocumentType.VAN_BAN_DEN,
      registrationNumber: 4,
      documentYear: 2026,
      registeredDate: new Date('2026-09-07T08:00:00Z'),
      originalNumber: '89/BGDĐT-GDĐH',
      issuedDate: new Date('2026-09-06T14:00:00Z'),
      issuingAuthority: 'Bộ Giáo dục và Đào tạo',
      category: 'Thông tri',
      summary: 'Thông tri hướng dẫn công nhận tín chỉ kỹ năng thực hành nghề tương đương và liên thông đào tạo khối ngành kỹ thuật công nghệ',
      urgency: DocumentUrgency.THUONG,
      securityLevel: DocumentSecurityLevel.THUONG,
      status: DocumentStatus.CHO_PHAN_CONG,
      dueDate: new Date('2026-09-30T17:00:00Z'),
      leadDepartmentId: 'phong-dao-tao',
      leadUserId: pdtOwnerId,
      attachments: [
        {
          fileName: '89_BGDDT_CongNhan_TinChi_LienThong.pdf',
          fileUrl: '/documents/2026/89_BGDDT_CongNhan_TinChi_LienThong.pdf',
          fileSize: 1992294,
          mimeType: 'application/pdf',
          isOriginal: true,
        },
      ],
    },
    {
      type: DocumentType.VAN_BAN_DEN,
      registrationNumber: 5,
      documentYear: 2026,
      registeredDate: new Date('2026-08-28T08:00:00Z'),
      originalNumber: '19/UBND-NC',
      issuedDate: new Date('2026-08-28T07:30:00Z'),
      issuingAuthority: 'UBND Tỉnh Bình Định',
      category: 'Công điện',
      summary: 'Công điện HỎA TỐC: Chủ động ứng phó áp thấp nhiệt đới và rà soát an toàn hệ thống điện xưởng cơ khí, nhà điều hành trường học',
      urgency: DocumentUrgency.HOA_TOC,
      securityLevel: DocumentSecurityLevel.THUONG,
      status: DocumentStatus.DA_HOAN_THANH,
      dueDate: new Date('2026-08-30T17:00:00Z'),
      leadDepartmentId: 'phong-qctb',
      leadUserId: qctbOwnerId,
      directives: [
        {
          leaderId: bghOwnerId,
          instruction: 'Trưởng ban PCTT trực 24/24, chằng chống cây xanh và di dời máy móc nhạy cảm lên vị trí cao.',
          deadline: new Date('2026-08-29T12:00:00Z'),
          assignedDeptId: 'phong-qctb',
          collaboratorIds: 'khoa-oto,khoa-co-khi',
          isTaskGenerated: true,
        },
      ],
      attachments: [
        {
          fileName: '19_UBND_HoaToc_PhongChongBaoLut.pdf',
          fileUrl: '/documents/2026/19_UBND_HoaToc_PhongChongBaoLut.pdf',
          fileSize: 870400,
          mimeType: 'application/pdf',
          isOriginal: true,
        },
      ],
    },
    {
      type: DocumentType.VAN_BAN_DEN,
      registrationNumber: 6,
      documentYear: 2026,
      registeredDate: new Date('2026-09-02T10:00:00Z'),
      originalNumber: '315/UBND-VX',
      issuedDate: new Date('2026-09-01T09:00:00Z'),
      issuingAuthority: 'UBND Tỉnh Bình Định',
      category: 'Chỉ thị',
      summary: 'Chỉ thị về nhiệm vụ trọng tâm năm học 2026–2027 đối với các trường cao đẳng, trung cấp nghề trên địa bàn tỉnh',
      urgency: DocumentUrgency.THUONG,
      securityLevel: DocumentSecurityLevel.THUONG,
      status: DocumentStatus.DANG_XU_LY,
      dueDate: new Date('2026-09-30T17:00:00Z'),
      leadDepartmentId: 'ban-giam-hieu',
      leadUserId: bghOwnerId,
      directives: [
        {
          leaderId: bghOwnerId,
          instruction: 'Các đơn vị quán triệt chỉ thị trong hội nghị cán bộ viên chức đầu năm học.',
          deadline: new Date('2026-09-15T17:00:00Z'),
          assignedDeptId: 'ban-giam-hieu',
          collaboratorIds: 'phong-dao-tao,phong-cthssv',
          isTaskGenerated: false,
        },
      ],
      attachments: [
        {
          fileName: '315_UBND_ChiThi_NhiemVu_NamHoc.pdf',
          fileUrl: '/documents/2026/315_UBND_ChiThi_NhiemVu_NamHoc.pdf',
          fileSize: 1245000,
          mimeType: 'application/pdf',
          isOriginal: true,
        },
      ],
    },
    {
      type: DocumentType.VAN_BAN_DEN,
      registrationNumber: 7,
      documentYear: 2026,
      registeredDate: new Date('2026-09-04T09:00:00Z'),
      originalNumber: '78/TCGDNN-KHTC',
      issuedDate: new Date('2026-09-03T11:00:00Z'),
      issuingAuthority: 'Tổng cục Giáo dục Nghề nghiệp',
      category: 'Thông báo',
      summary: 'Thông báo phân bổ kinh phí dự án tăng cường cơ sở vật chất kỹ thuật và đào tạo nghề chất lượng cao năm 2026',
      urgency: DocumentUrgency.KHAN,
      securityLevel: DocumentSecurityLevel.MAT,
      status: DocumentStatus.DANG_XU_LY,
      dueDate: new Date('2026-09-25T17:00:00Z'),
      leadDepartmentId: 'phong-tckt',
      leadUserId: tcktOwnerId,
      directives: [
        {
          leaderId: bghOwnerId,
          instruction: 'Phòng TCKT phối hợp Phòng QTTB lập danh mục thiết bị ưu tiên giải ngân đợt 1.',
          deadline: new Date('2026-09-20T17:00:00Z'),
          assignedDeptId: 'phong-tckt',
          collaboratorIds: 'phong-qctb',
          isTaskGenerated: false,
        },
      ],
      attachments: [
        {
          fileName: '78_TCGDNN_PhanBo_KinhPhi_2026.pdf',
          fileUrl: '/documents/2026/78_TCGDNN_PhanBo_KinhPhi_2026.pdf',
          fileSize: 2150000,
          mimeType: 'application/pdf',
          isOriginal: true,
        },
      ],
    },

    // --- VĂN BẢN ĐI (VAN_BAN_DI) ---
    {
      type: DocumentType.VAN_BAN_DI,
      registrationNumber: 1,
      documentYear: 2026,
      registeredDate: new Date('2026-09-03T15:00:00Z'),
      originalNumber: '145/CĐKTCN-ĐT',
      issuedDate: new Date('2026-09-03T14:30:00Z'),
      issuingAuthority: 'Trường CĐ Kỹ thuật Công nghệ Quy Nhơn',
      category: 'Báo cáo',
      summary: 'Báo cáo sơ kết giai đoạn 1 đề án đào tạo thí điểm kỹ thuật viên Cơ điện tử và Ô tô điện theo tiêu chuẩn CHLB Đức',
      urgency: DocumentUrgency.THUONG,
      securityLevel: DocumentSecurityLevel.THUONG,
      status: DocumentStatus.DA_HOAN_THANH,
      signerName: 'TS. Nguyễn Văn Hiệu',
      signerTitle: 'Hiệu trưởng',
      draftingDeptId: 'phong-dao-tao',
      recipientList: 'Tổng cục GDNN, Tổ chức Hợp tác Phát triển Đức (GIZ), Ban Giám hiệu',
      distributedCopies: 5,
      attachments: [
        {
          fileName: '145_CDKTCN_BaoCao_DaoTao_TieuChuanDuc.pdf',
          fileUrl: '/documents/2026/145_CDKTCN_BaoCao_DaoTao_TieuChuanDuc.pdf',
          fileSize: 4404019,
          mimeType: 'application/pdf',
          isOriginal: true,
        },
      ],
    },
    {
      type: DocumentType.VAN_BAN_DI,
      registrationNumber: 2,
      documentYear: 2026,
      registeredDate: new Date('2026-09-05T09:30:00Z'),
      originalNumber: '210/CĐKTCN-TCKT',
      issuedDate: new Date('2026-09-05T09:15:00Z'),
      issuingAuthority: 'Trường CĐ Kỹ thuật Công nghệ Quy Nhơn',
      category: 'Tờ trình',
      summary: 'Tờ trình đề xuất phân bổ dự toán kinh phí mua sắm vật tư thực hành kỳ 1 và bảo dưỡng máy móc CNC xưởng Cơ khí',
      urgency: DocumentUrgency.KHAN,
      securityLevel: DocumentSecurityLevel.THUONG,
      status: DocumentStatus.DANG_XU_LY,
      signerName: 'ThS. Đỗ Tài Chính',
      signerTitle: 'Trưởng phòng TCKT',
      draftingDeptId: 'phong-tckt',
      recipientList: 'Ban Giám hiệu, Khoa Cơ khí, Phòng Quản trị Thiết bị',
      distributedCopies: 3,
      attachments: [
        {
          fileName: '210_CDKTCN_DuToan_VatTu_ThucHanh.pdf',
          fileUrl: '/documents/2026/210_CDKTCN_DuToan_VatTu_ThucHanh.pdf',
          fileSize: 2202009,
          mimeType: 'application/pdf',
          isOriginal: true,
        },
      ],
    },
    {
      type: DocumentType.VAN_BAN_DI,
      registrationNumber: 3,
      documentYear: 2026,
      registeredDate: new Date('2026-08-30T16:30:00Z'),
      originalNumber: '56/CĐKTCN-VP',
      issuedDate: new Date('2026-08-30T16:00:00Z'),
      issuingAuthority: 'Trường CĐ Kỹ thuật Công nghệ Quy Nhơn',
      category: 'Thông báo',
      summary: 'Thông báo kế hoạch điều hành tuần lễ khai giảng năm học 2026–2027 và đón tân sinh viên nhập học đợt 2',
      urgency: DocumentUrgency.THUONG,
      securityLevel: DocumentSecurityLevel.THUONG,
      status: DocumentStatus.DA_HOAN_THANH,
      signerName: 'TS. Nguyễn Văn Hiệu',
      signerTitle: 'Hiệu trưởng',
      draftingDeptId: 'ban-giam-hieu',
      recipientList: 'Toàn thể CB-GV-NV và Học sinh - Sinh viên toàn trường',
      distributedCopies: 12,
      attachments: [
        {
          fileName: '56_CDKTCN_KeHoach_KhaiGiang_2026.pdf',
          fileUrl: '/documents/2026/56_CDKTCN_KeHoach_KhaiGiang_2026.pdf',
          fileSize: 1258291,
          mimeType: 'application/pdf',
          isOriginal: true,
        },
      ],
    },
    {
      type: DocumentType.VAN_BAN_DI,
      registrationNumber: 4,
      documentYear: 2026,
      registeredDate: new Date('2026-09-06T10:30:00Z'),
      originalNumber: '320/CĐKTCN-TS',
      issuedDate: new Date('2026-09-06T10:00:00Z'),
      issuingAuthority: 'Trường CĐ Kỹ thuật Công nghệ Quy Nhơn',
      category: 'Thông báo',
      summary: 'Thông báo điểm chuẩn và chỉ tiêu xét tuyển bổ sung nguyện vọng 2 hệ Cao đẳng chính quy năm 2026',
      urgency: DocumentUrgency.THUONG,
      securityLevel: DocumentSecurityLevel.THUONG,
      status: DocumentStatus.DA_HOAN_THANH,
      signerName: 'TS. Nguyễn Văn Hiệu',
      signerTitle: 'Chủ tịch Hội đồng Tuyển sinh',
      draftingDeptId: 'tt-tuyensinh',
      recipientList: 'Website trường, Báo Bình Định, Các trường THPT đối tác',
      distributedCopies: 10,
      attachments: [
        {
          fileName: '320_CDKTCN_ThongBao_TuyenSinh_BoSung.pdf',
          fileUrl: '/documents/2026/320_CDKTCN_ThongBao_TuyenSinh_BoSung.pdf',
          fileSize: 985000,
          mimeType: 'application/pdf',
          isOriginal: true,
        },
      ],
    },
    {
      type: DocumentType.VAN_BAN_DI,
      registrationNumber: 5,
      documentYear: 2026,
      registeredDate: new Date('2026-09-07T09:00:00Z'),
      originalNumber: '188/CĐKTCN-ĐT',
      issuedDate: new Date('2026-09-07T08:30:00Z'),
      issuingAuthority: 'Trường CĐ Kỹ thuật Công nghệ Quy Nhơn',
      category: 'Quyết định',
      summary: 'Quyết định thành lập Hội đồng rà soát chương trình đào tạo và cập nhật chuẩn đầu ra kỹ năng số năm 2026',
      urgency: DocumentUrgency.KHAN,
      securityLevel: DocumentSecurityLevel.THUONG,
      status: DocumentStatus.DA_HOAN_THANH,
      signerName: 'TS. Nguyễn Văn Hiệu',
      signerTitle: 'Hiệu trưởng',
      draftingDeptId: 'phong-dao-tao',
      recipientList: 'Thành viên Hội đồng, Các Khoa chuyên môn, Phòng TCHC',
      distributedCopies: 8,
      attachments: [
        {
          fileName: '188_CDKTCN_QuyetDinh_HoiDong_ChuanDauRa.pdf',
          fileUrl: '/documents/2026/188_CDKTCN_QuyetDinh_HoiDong_ChuanDauRa.pdf',
          fileSize: 1850000,
          mimeType: 'application/pdf',
          isOriginal: true,
        },
      ],
    },

    // --- TỜ TRÌNH NỘI BỘ (TO_TRINH_NOI_BO) ---
    {
      type: DocumentType.TO_TRINH_NOI_BO,
      registrationNumber: 1,
      documentYear: 2026,
      registeredDate: new Date('2026-09-06T11:30:00Z'),
      originalNumber: '15/TTr-CNTT',
      issuedDate: new Date('2026-09-06T11:00:00Z'),
      issuingAuthority: 'Khoa Công nghệ Thông tin',
      category: 'Tờ trình',
      summary: 'Tờ trình xin phê duyệt kinh phí và cấu hình máy chủ phục vụ Hội thi Kỹ năng nghề quốc gia phân môn Điện toán đám mây',
      urgency: DocumentUrgency.KHAN,
      securityLevel: DocumentSecurityLevel.THUONG,
      status: DocumentStatus.CHO_PHE_DUYET,
      draftingDeptId: 'khoa-cntt',
      signerName: 'ThS. Hoàng Công Nghệ',
      signerTitle: 'Trưởng khoa CNTT',
      leadDepartmentId: 'ban-giam-hieu',
      leadUserId: bghOwnerId,
      directives: [
        {
          leaderId: bghOwnerId,
          instruction: 'Đồng ý chủ trương. Giao Phòng TCKT thẩm định dự toán và báo cáo Hiệu trưởng trước ngày 12/09.',
          deadline: new Date('2026-09-12T17:00:00Z'),
          assignedDeptId: 'phong-tckt',
          collaboratorIds: 'khoa-cntt,phong-qctb',
          isTaskGenerated: false,
        },
      ],
      attachments: [
        {
          fileName: '15_TTr_CNTT_KinhPhi_Server_HoiThi.pdf',
          fileUrl: '/documents/2026/15_TTr_CNTT_KinhPhi_Server_HoiThi.pdf',
          fileSize: 1468006,
          mimeType: 'application/pdf',
          isOriginal: true,
        },
      ],
    },
    {
      type: DocumentType.TO_TRINH_NOI_BO,
      registrationNumber: 2,
      documentYear: 2026,
      registeredDate: new Date('2026-09-05T15:30:00Z'),
      originalNumber: '28/TTr-ĐT',
      issuedDate: new Date('2026-09-05T15:00:00Z'),
      issuingAuthority: 'Phòng Đào tạo',
      category: 'Tờ trình',
      summary: 'Tờ trình ban hành Quy chế khảo thí trực tuyến và quy trình thẩm định minh chứng giảng dạy số hóa theo khung DACUM',
      urgency: DocumentUrgency.THUONG,
      securityLevel: DocumentSecurityLevel.THUONG,
      status: DocumentStatus.DA_HOAN_THANH,
      draftingDeptId: 'phong-dao-tao',
      signerName: 'ThS. Lê Đào Tạo',
      signerTitle: 'Trưởng phòng Đào tạo',
      leadDepartmentId: 'ban-giam-hieu',
      leadUserId: bghOwnerId,
      directives: [
        {
          leaderId: bghOwnerId,
          instruction: 'Phê duyệt ban hành. Giao Phòng Đào tạo tổ chức phổ biến toàn thể giảng viên áp dụng từ học kỳ 1.',
          deadline: new Date('2026-09-10T17:00:00Z'),
          assignedDeptId: 'phong-dao-tao',
          collaboratorIds: 'khoa-cntt,khoa-co-khi,khoa-dien',
          isTaskGenerated: true,
        },
      ],
      attachments: [
        {
          fileName: '28_TTr_DT_QuyChe_KhaoThi_DACUM.pdf',
          fileUrl: '/documents/2026/28_TTr_DT_QuyChe_KhaoThi_DACUM.pdf',
          fileSize: 2936012,
          mimeType: 'application/pdf',
          isOriginal: true,
        },
      ],
    },
    {
      type: DocumentType.TO_TRINH_NOI_BO,
      registrationNumber: 3,
      documentYear: 2026,
      registeredDate: new Date('2026-09-05T08:00:00Z'),
      originalNumber: '09/TTr-CK',
      issuedDate: new Date('2026-09-04T16:00:00Z'),
      issuingAuthority: 'Khoa Cơ khí',
      category: 'Tờ trình',
      summary: 'Tờ trình đề xuất thay thế linh kiện bộ trục chính máy phay CNC và bổ sung dầu làm mát xưởng thực hành Cơ khí chế tạo',
      urgency: DocumentUrgency.KHAN,
      securityLevel: DocumentSecurityLevel.THUONG,
      status: DocumentStatus.CHO_PHE_DUYET,
      draftingDeptId: 'khoa-co-khi',
      signerName: 'ThS. Đinh Văn Cơ Khí',
      signerTitle: 'Trưởng khoa Cơ khí',
      leadDepartmentId: 'ban-giam-hieu',
      leadUserId: bghOwnerId,
      attachments: [
        {
          fileName: '09_TTr_CK_ThayThe_TrucChinh_CNC.pdf',
          fileUrl: '/documents/2026/09_TTr_CK_ThayThe_TrucChinh_CNC.pdf',
          fileSize: 1120000,
          mimeType: 'application/pdf',
          isOriginal: true,
        },
      ],
    },
    {
      type: DocumentType.TO_TRINH_NOI_BO,
      registrationNumber: 4,
      documentYear: 2026,
      registeredDate: new Date('2026-09-07T08:30:00Z'),
      originalNumber: '14/TTr-ÔTÔ',
      issuedDate: new Date('2026-09-06T14:00:00Z'),
      issuingAuthority: 'Khoa Kỹ thuật Ô tô',
      category: 'Tờ trình',
      summary: 'Tờ trình tiếp nhận tài trợ mô hình động cơ xăng hybrid thế hệ mới từ Công ty Cổ phần Ô tô Trường Hải (THACO)',
      urgency: DocumentUrgency.THUONG,
      securityLevel: DocumentSecurityLevel.THUONG,
      status: DocumentStatus.CHO_PHE_DUYET,
      draftingDeptId: 'khoa-oto',
      signerName: 'ThS. Vũ Kỹ Thuật Ôtô',
      signerTitle: 'Trưởng khoa Ôtô',
      leadDepartmentId: 'ban-giam-hieu',
      leadUserId: bghOwnerId,
      attachments: [
        {
          fileName: '14_TTr_OTO_TiepNhan_TaiTro_THACO.pdf',
          fileUrl: '/documents/2026/14_TTr_OTO_TiepNhan_TaiTro_THACO.pdf',
          fileSize: 1780000,
          mimeType: 'application/pdf',
          isOriginal: true,
        },
      ],
    },
  ];

  for (const docItem of sampleDocuments) {
    const { directives, attachments, linkedTaskCode, ...baseData } = docItem;
    const linkedTaskId = linkedTaskCode ? taskCodeMap[linkedTaskCode] || null : null;

    const documentData = {
      ...baseData,
      registeredById: vanThuId,
      linkedTaskId,
    };

    const doc = await prisma.document.upsert({
      where: {
        type_documentYear_registrationNumber: {
          type: docItem.type,
          documentYear: docItem.documentYear,
          registrationNumber: docItem.registrationNumber,
        },
      },
      update: documentData,
      create: documentData,
    });

    // Đồng bộ tệp đính kèm chuẩn số hóa NĐ 30/2020
    if (attachments && attachments.length > 0) {
      await prisma.documentAttachment.deleteMany({
        where: { documentId: doc.id },
      });
      for (const att of attachments) {
        await prisma.documentAttachment.create({
          data: {
            documentId: doc.id,
            fileName: att.fileName,
            fileUrl: att.fileUrl,
            fileSize: att.fileSize,
            mimeType: att.mimeType,
            sha256Hash: att.sha256Hash || null,
            isOriginal: att.isOriginal ?? true,
          },
        });
      }
    }

    // Đồng bộ bút phê & chỉ đạo điều hành BGH NĐ 30/2020
    if (directives && directives.length > 0) {
      await prisma.documentDirective.deleteMany({
        where: { documentId: doc.id },
      });
      for (const dir of directives) {
        await prisma.documentDirective.create({
          data: {
            documentId: doc.id,
            leaderId: dir.leaderId,
            instruction: dir.instruction,
            deadline: dir.deadline || null,
            assignedDeptId: dir.assignedDeptId,
            collaboratorIds: dir.collaboratorIds || null,
            isTaskGenerated: dir.isTaskGenerated ?? false,
          },
        });
      }
    }
  }

  console.log(`Seeding completed successfully with ${departments.length} departments, ${users.length} users, ${sampleTasks.length} tasks, and ${sampleDocuments.length} documents.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
