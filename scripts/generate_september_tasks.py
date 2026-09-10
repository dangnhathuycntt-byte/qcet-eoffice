import re
import os

with open("/tmp/kehoach_thang9_2026.txt") as f:
    text = f.read()

lines = text.splitlines()
sections = []
current_sec = None
current_items = []
current_num = None
current_content = []
sec_roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"]
i = 0
while i < len(lines):
    line = lines[i].strip()
    if line in sec_roman:
        if current_sec:
            if current_num:
                current_items.append((current_num, " ".join(current_content)))
            sections.append((current_sec, current_items))
        current_sec = (line, lines[i+1].strip() if i+1 < len(lines) else "")
        current_items = []
        current_num = None
        current_content = []
        i += 2
        continue
    if line.isdigit() and current_sec:
        if current_num:
            current_items.append((current_num, " ".join(current_content)))
        current_num = int(line)
        current_content = []
        i += 1
        continue
    if current_num is not None:
        if line and not line.startswith("PAGE") and not line.startswith("Nơi nhận") and not line.startswith("HIỆU TRƯỞNG") and not line.startswith("Phạm Văn Tường") and not line.startswith("Đề nghị các đơn vị"):
            current_content.append(line)
        elif line.startswith("Đề nghị các đơn vị") or line.startswith("Nơi nhận"):
            if current_num:
                current_items.append((current_num, " ".join(current_content)))
                current_num = None
                current_content = []
    i += 1
if current_sec and current_num:
    current_items.append((current_num, " ".join(current_content)))
if current_sec:
    sections.append((current_sec, current_items))

def escape_str(s):
    return s.replace("\\", "\\\\").replace("'", "\\'").replace('"', '\\"').replace("\n", " ")

def clean_text(s):
    return re.sub(r"\s+", " ", s).strip()

def get_title(content):
    c = clean_text(content)
    if len(c) <= 90:
        return c
    parts = re.split(r"[;:]", c)
    if len(parts[0]) >= 30 and len(parts[0]) <= 90:
        return parts[0].strip()
    if len(parts) > 1 and len(parts[0]) < 30:
        combined = f"{parts[0]}: {parts[1].strip()}"
        if len(combined) <= 100:
            return combined
        return combined[:97] + "..."
    return c[:97] + "..."

task_code_start = 5

output_lines = []
output_lines.append("    // --- 103 NHIỆM VỤ CHÍNH THỨC TỪ KẾ HOẠCH CÔNG TÁC THÁNG 9/2026 (HIỆU TRƯỞNG PHẠM VĂN TƯỜNG) ---")

cur_code = task_code_start

for sec_idx, (sec_header, itms) in enumerate(sections):
    sec_num, sec_title = sec_header
    output_lines.append(f"\n    // === MỤC {sec_num}: {sec_title.upper()} ({len(itms)} NHIỆM VỤ) ===")

    for num, raw_content in itms:
        code_str = f"NV-2026-09-{str(cur_code).zfill(3)}"
        cur_code += 1

        content = clean_text(raw_content)
        title = get_title(content)

        # Determine department and assignee
        dept_id = "BGH"
        assignee_var = "bghOwnerId"
        collaborators = "[]"

        if sec_num == "I":
            dept_id = "P_TCDBCL"
            assignee_var = "tcdbclOwnerId"
            collaborators = "[hcqtOwnerId, tcOwnerId]"
        elif sec_num == "II":
            dept_id = "P_QLDT"
            assignee_var = "qldtOwnerId"
            collaborators = "[cnttOwnerId, ckOwnerId, dienOwnerId]"
        elif sec_num == "III":
            dept_id = "P_TC"
            assignee_var = "tcOwnerId"
            collaborators = "[hcqtOwnerId, qldtOwnerId]"
        elif sec_num == "IV":
            dept_id = "P_HCQT"
            assignee_var = "hcqtOwnerId"
            collaborators = "[tcOwnerId, tcdbclOwnerId]"
        elif sec_num == "V":
            dept_id = "P_TSHTQT"
            assignee_var = "tshtqtOwnerId"
            collaborators = "[sttOwnerId, qldtOwnerId]"
        elif sec_num == "VI":
            dept_id = "TT_STT"
            assignee_var = "sttOwnerId"
            collaborators = "[cnttOwnerId, tshtqtOwnerId]"
        elif sec_num == "VII":
            if num == 1:
                dept_id, assignee_var, collaborators = "K_CNTT", "cnttOwnerId", "[ckOwnerId, dienOwnerId]"
            elif num == 2:
                dept_id, assignee_var, collaborators = "K_CK", "ckOwnerId", "[qldtOwnerId, otoOwnerId]"
            elif num == 3:
                dept_id, assignee_var, collaborators = "K_DIEN", "dienOwnerId", "[qldtOwnerId]"
            elif num == 4:
                dept_id, assignee_var, collaborators = "P_QLDT", "qldtOwnerId", "[cnttOwnerId, ckOwnerId, dienOwnerId]"
            elif num == 5:
                dept_id, assignee_var, collaborators = "K_CNOTO", "otoOwnerId", "[qldtOwnerId]"
            elif num == 6:
                dept_id, assignee_var, collaborators = "K_CK", "ckOwnerId", "[hcqtOwnerId]"
            elif num == 7:
                dept_id, assignee_var, collaborators = "K_DIEN", "dienOwnerId", "[tcdbclOwnerId]"
            elif num == 8:
                dept_id, assignee_var, collaborators = "P_HCQT", "hcqtOwnerId", "[cnttOwnerId, ckOwnerId, dienOwnerId]"
            elif num == 9:
                dept_id, assignee_var, collaborators = "P_TSHTQT", "tshtqtOwnerId", "[cnttOwnerId, ckOwnerId]"
            elif num == 10:
                dept_id, assignee_var, collaborators = "P_QLDT", "qldtOwnerId", "[cnttOwnerId, dienOwnerId, ckOwnerId]"
            elif num == 11:
                dept_id, assignee_var, collaborators = "K_KTQT", "ktqtOwnerId", "[hcqtOwnerId, tcOwnerId]"
            elif num == 12:
                dept_id, assignee_var, collaborators = "K_DULICH", "dulichOwnerId", "[hcqtOwnerId]"
            elif num == 13:
                dept_id, assignee_var, collaborators = "K_KTNN", "ktnnOwnerId", "[qldtOwnerId, tshtqtOwnerId]"
            elif num == 14:
                dept_id, assignee_var, collaborators = "K_DIEN", "dienOwnerId", "[qldtOwnerId]"
            elif num == 15:
                dept_id, assignee_var, collaborators = "K_VHNT", "vhntOwnerId", "[tshtqtOwnerId, hcqtOwnerId]"
            elif num == 16:
                dept_id, assignee_var, collaborators = "K_DAICUONG", "daicuongOwnerId", "[qldtOwnerId]"
        elif sec_num == "VIII":
            if num == 1:
                dept_id, assignee_var, collaborators = "P_TCDBCL", "tcdbclOwnerId", "[qldtOwnerId]"
            elif num == 2:
                dept_id, assignee_var, collaborators = "BGH", "bghOwnerId", "[hcqtOwnerId, tcOwnerId]"
            elif num == 3:
                dept_id, assignee_var, collaborators = "P_TSHTQT", "tshtqtOwnerId", "[bghOwnerId, sttOwnerId]"
            elif num == 4:
                dept_id, assignee_var, collaborators = "P_TCDBCL", "tcdbclOwnerId", "[sttOwnerId]"
            elif num == 5:
                dept_id, assignee_var, collaborators = "TT_STT", "sttOwnerId", "[hcqtOwnerId]"
            elif num == 6:
                dept_id, assignee_var, collaborators = "TT_STT", "sttOwnerId", "[tshtqtOwnerId]"
            elif num == 7:
                dept_id, assignee_var, collaborators = "BGH", "bghOwnerId", "[tcdbclOwnerId, qldtOwnerId, hcqtOwnerId]"

        # Determine priority, status, progress, due date
        is_urgent = any(w in content.lower() for w in ["khai giảng", "khẩn", "gấp", "ngay", "đột xuất", "pccc", "an toàn"])
        priority_str = "TaskPriority.URGENT" if is_urgent else ("TaskPriority.HIGH" if num <= 5 else "TaskPriority.NORMAL")

        # Check if completed (e.g. Khai giảng 05/09/2026)
        if "05 tháng 9 năm 2026" in content or "05/09/2026" in content or (sec_num == "I" and num == 2) or (sec_num == "VII" and num == 1):
            status_str = "TaskStatus.COMPLETED"
            progress = 100
            due_day = "05"
        elif num % 4 == 0:
            status_str = "TaskStatus.NOT_STARTED"
            progress = 0
            due_day = "30"
        elif num % 3 == 0:
            status_str = "TaskStatus.IN_PROGRESS"
            progress = 40
            due_day = "25"
        elif num % 2 == 0:
            status_str = "TaskStatus.IN_PROGRESS"
            progress = 65
            due_day = "20"
        else:
            status_str = "TaskStatus.IN_PROGRESS"
            progress = 50
            due_day = "24"

        due_date_str = f"new Date('2026-09-{due_day}T17:00:00Z')"

        task_obj = f"""    {{
      code: '{code_str}',
      title: '{escape_str(title)}',
      description: '{escape_str(content)}',
      scope: TaskScope.SCHOOL,
      status: {status_str},
      priority: {priority_str},
      progressPercent: {progress},
      academicMonth: 9,
      academicYear: '2026-2027',
      dueDate: {due_date_str},
      departmentId: '{dept_id}',
      createdById: bghOwnerId,
      assigneeId: {assignee_var},
      collaboratorIds: {collaborators},
    }},"""
        output_lines.append(task_obj)

print("Generated lines:", len(output_lines))
print(f"Total new tasks generated: {cur_code - task_code_start}")
with open("/tmp/generated_tasks.ts", "w") as f:
    f.write("\n".join(output_lines))
