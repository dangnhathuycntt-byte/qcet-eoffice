/**
 * Test TypeSafe Department Resolution với Kế hoạch công tác tháng 9/2026
 * Chạy: TYPESAFE_API_KEY=... node scripts/test-typesafe-department.mjs
 */
import { choice, noul, TypeSafeClient } from "@typesafe-ai/sdk";

const client = new TypeSafeClient();

// 11 đơn vị trong QCET
const DEPARTMENTS = {
  BGH: "Ban Giám hiệu — chỉ đạo, phê duyệt, điều hành chung toàn trường",
  P_HCQT: "Phòng Hành chính - Quản trị — cơ sở vật chất, tài sản, an ninh, vệ sinh, khuôn viên, lễ tân",
  P_DTQLKH: "Phòng Đào tạo & QLKH — chương trình đào tạo, thời khóa biểu, giảng dạy, nghiên cứu khoa học, sáng kiến",
  P_KTDBCL: "Phòng Khảo thí & ĐBCL — thi, kiểm tra, đánh giá, đảm bảo chất lượng, kiểm định",
  P_KHTC: "Phòng Kế hoạch - Tài chính — ngân sách, học phí, thanh toán, mua sắm, đầu tư",
  P_CTHSSV: "Phòng Công tác HSSV — tuyển sinh, quản lý HSSV, kỷ luật, hỗ trợ sinh viên, ký túc xá",
  K_CNTT: "Khoa Công nghệ thông tin — đào tạo CNTT, ATTT, chuy��n đổi số",
  K_KTCN: "Khoa Kỹ thuật - Công nghệ — cơ khí, điện, ô tô, nông nghiệp",
  K_KTQT: "Khoa Kinh tế - Quản trị — đào tạo kinh tế, kế toán, quản trị",
  TT_STT: "TT Truyền thông & Số hóa — website, truyền thông, CNTT hạ tầng, phần mềm, mạng",
  TT_NNTH: "TT Ngoại ngữ - TH & Thư viện — ngoại ngữ, tin học, thư viện",
  UNKNOWN: "Không xác định — nhiệm vụ chung hoặc không rõ đơn vị",
};

// Trích 15 nhiệm vụ đại diện từ PDF
const TASKS = [
  { id: "I.1", content: "Thực hiện các nhiệm vụ thường xuyên về tổ chức cán bộ: giải quyết chế độ, chính sách, phụ cấp, bảo hiểm xã hội; cập nhật hồ sơ viên chức, người lao động và hồ sơ tiền lương theo quy định." },
  { id: "I.3", content: "Tổ chức đánh giá kết quả thực hiện công việc quý III/2026 đối với cán bộ lãnh đạo, quản lý theo quy định." },
  { id: "I.14", content: "Triển khai tự đánh giá mức độ đáp ứng chuẩn cơ sở giáo dục nghề nghiệp theo Thông tư số 38; hướng dẫn các đơn vị thu thập, lưu trữ, số hóa minh chứng đợt 2 và thực hiện đúng tiến độ kế hoạch." },
  { id: "II.1", content: "Triển khai kế hoạch đào tạo học kỳ I năm học 2026-2027; ổn định thời khóa biểu, sĩ số, nền nếp dạy và học đối với các lớp khóa 18, 19 và 20." },
  { id: "II.4", content: "Tổ chức Lễ khai giảng năm học 2026-2027 ngày 05/9/2026 bảo đảm trang trọng, an toàn, tiết kiệm." },
  { id: "III.1", content: "Tổ chức thu các khoản phí đối với học sinh, sinh viên khóa 20 nhập học theo quy định; phối hợp xử lý kịp thời các trường hợp phát sinh." },
  { id: "III.2", content: "Đôn đốc thu học phí học kỳ I năm học 2026-2027, thu hồi nợ học phí cũ; đối chiếu danh sách nợ theo lớp, khoa và báo cáo Ban Giám hiệu hằng tuần." },
  { id: "IV.1", content: "Chuẩn bị đầy đủ cơ sở vật chất, trang thiết bị, cảnh quan và các điều kiện phục vụ Lễ khai giảng năm học 2026-2027." },
  { id: "IV.8", content: "Triển khai quản lý tài sản, thiết bị dạy học bằng mã QR; rà soát, lập hồ sơ thanh lý thiết bị, dụng cụ hư hỏng, không còn nhu cầu sử dụng." },
  { id: "V.1", content: "Triển khai tuyển sinh và nhập học đợt 3 năm 2026 bám sát chỉ tiêu từng ngành, nghề; đẩy mạnh tư vấn trực tuyến, khai thác dữ liệu phụ huynh, học sinh và tăng cường tuyển sinh trung cấp, cao đẳng, cao đẳng liên thông, trung học nghề." },
  { id: "VI.1", content: "Quản lý, vận hành cổng thông tin điện tử và các kênh truyền thông xã hội của Trường; đăng tải kịp thời kế hoạch, thông báo, tin, bài và cập nhật thông tin của các đơn vị." },
  { id: "VI.3", content: "Đẩy mạnh chuyển đổi số và cải cách thủ tục hành chính; triển khai ứng dụng trí tuệ nhân tạo trong quản lý, giảng dạy và truyền thông; lựa chọn nội dung thí điểm và đánh giá kết quả." },
  { id: "VI.5", content: "Bảo trì, sửa chữa, khắc phục sự cố hệ thống mạng; tăng cường an toàn, an ninh mạng và bảo vệ dữ liệu của Trường." },
  { id: "VI.6", content: "Tổ chức phục vụ bạn đọc; bố trí không gian thư viện phù hợp và tiếp tục biên mục, cập nhật, quản lý vốn sách trên phần mềm thư viện." },
  { id: "VIII.1", content: "Công đoàn Trường hoàn thành kế hoạch quý III; triển khai phong trào trồng cây, tạo cảnh quan; tham gia hội thi văn nghệ cấp phường Quy Nhơn Bắc và thực hiện nhiệm vụ cấp trên giao." },
];

async function classifyTask(task) {
  const response = await client.systemOne({
    state: {
      task: task.content,
      context: "Kế hoạch công tác tháng 9/2026 của Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET). Mỗi nhiệm vụ cần giao cho đơn vị chủ trì phù hợp nhất.",
    },
    questions: {
      department: choice(
        "Đơn vị nào trong trường chủ trì thực hiện nhiệm vụ `task` này?",
        DEPARTMENTS
      ),
      isUrgent: noul(
        "Nhiệm vụ `task` có thời hạn cụ thể hoặc tính chất khẩn cấp cần ưu tiên không?"
      ),
    },
  });

  return {
    id: task.id,
    content: task.content.slice(0, 80) + "...",
    department: response.answers.department.choice,
    confidence: response.answers.department.confidence,
    probabilities: response.answers.department.probabilities,
    isUrgent: response.answers.isUrgent.probability,
  };
}

console.log("🔍 TypeSafe Department Resolution — Test với KH tháng 9/2026 QCET");
console.log("=" .repeat(90));
console.log();

const results = [];
for (const task of TASKS) {
  try {
    const result = await classifyTask(task);
    results.push(result);

    const conf = (result.confidence * 100).toFixed(0);
    const urgent = result.isUrgent > 0.5 ? "⚡" : "  ";
    const confBar = conf >= 70 ? "🟢" : conf >= 40 ? "🟡" : "🔴";
    console.log(
      `${urgent} ${result.id.padEnd(6)} → ${result.department.padEnd(10)} ${confBar} ${conf}%  │ ${result.content}`
    );
  } catch (err) {
    console.error(`❌ ${task.id}: ${err.message}`);
  }
}

console.log();
console.log("=" .repeat(90));
console.log("📊 Tổng hợp:");

const byDept = {};
for (const r of results) {
  byDept[r.department] = (byDept[r.department] || 0) + 1;
}
for (const [dept, count] of Object.entries(byDept).sort((a, b) => b[1] - a[1])) {
  const label = DEPARTMENTS[dept]?.split("—")[0]?.trim() || dept;
  console.log(`  ${label.padEnd(35)} ${count} nhiệm vụ`);
}

const avgConf = results.reduce((s, r) => s + r.confidence, 0) / results.length;
console.log(`\n  Confidence trung bình: ${(avgConf * 100).toFixed(1)}%`);
const urgentCount = results.filter(r => r.isUrgent > 0.5).length;
console.log(`  Nhiệm vụ khẩn cấp/có deadline: ${urgentCount}/${results.length}`);
