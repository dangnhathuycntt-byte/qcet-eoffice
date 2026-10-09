import React from "react";
import { CharacterCountTextarea } from "qcet-eoffice";

export function Default() {
  const [value, setValue] = React.useState(
    "Đã hoàn thành rà soát 12 tiêu chí chất lượng và chuẩn bị báo cáo phục vụ đoàn kiểm định."
  );

  return (
    <div style={{ width: 440, padding: 20 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
        Nội dung kết quả thực hiện
      </label>
      <CharacterCountTextarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        showCount
        maxCharacters={200}
        placeholder="Nhập ghi chú tóm tắt..."
        rows={4}
      />
    </div>
  );
}
