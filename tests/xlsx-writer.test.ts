import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildXlsx, columnName } from '../src/lib/export/xlsx-writer';

describe('ghi tệp .xlsx không cần thư viện ngoài (V-06)', () => {
  test('tên cột kiểu Excel', () => {
    assert.deepEqual([0, 1, 25, 26, 27, 701, 702].map(columnName), ['A', 'B', 'Z', 'AA', 'AB', 'ZZ', 'AAA']);
  });

  test('gói zip hợp lệ, có đủ phần OOXML', () => {
    const buf = buildXlsx('Báo cáo', [['Tên', 'Số'], ['Phòng A', 3]]);
    assert.equal(buf.readUInt32LE(0), 0x04034b50);
    assert.equal(buf.readUInt32LE(buf.length - 22), 0x06054b50);
    for (const name of ['[Content_Types].xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml', 'xl/styles.xml']) {
      assert.ok(buf.includes(Buffer.from(name)), name);
    }
  });

  test('openpyxl đọc lại đúng chữ tiếng Việt, số, ký tự đặc biệt và ô trống', (t) => {
    try {
      execFileSync('python3', ['-c', 'import openpyxl'], { stdio: 'ignore' });
    } catch {
      t.skip('không có openpyxl trong môi trường');
      return;
    }
    const rows = [['Nhóm', 'Tên', 'Giờ'], ['Theo đơn vị', 'Phòng "Đào tạo" & <Khảo thí>', 12.5], ['Tổng', '', 0]];
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'xlsx-')), 'out.xlsx');
    fs.writeFileSync(file, buildXlsx('Thời gian: duyệt/báo cáo', rows));
    const out = execFileSync('python3', ['-I', '-c', `
import openpyxl, json, sys
wb = openpyxl.load_workbook(sys.argv[1])
ws = wb.active
print(json.dumps({"title": ws.title, "bold": ws["A1"].font.b, "rows": [[c.value for c in r] for r in ws.iter_rows()]}, ensure_ascii=False))
`, file], { encoding: 'utf8' });
    const parsed = JSON.parse(out);
    assert.equal(parsed.title, 'Thời gian  duyệt báo cáo');
    assert.equal(parsed.bold, true);
    assert.deepEqual(parsed.rows, [['Nhóm', 'Tên', 'Giờ'], ['Theo đơn vị', 'Phòng "Đào tạo" & <Khảo thí>', 12.5], ['Tổng', null, 0]]);
  });
});
