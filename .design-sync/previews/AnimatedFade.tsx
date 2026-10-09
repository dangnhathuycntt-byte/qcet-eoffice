import React from "react";
import { AnimatedList, AnimatedItem, AnimatedNumber, AnimatedCollapse, Button } from "qcet-eoffice";

export function DanhSachSoLe() {
  const [items] = React.useState([
    "Báo cáo giảng dạy học kỳ I — Khoa CNTT",
    "Kế hoạch tuyển sinh năm học 2026–2027",
    "Kiểm kê tài sản phòng thí nghiệm thực hành",
  ]);

  return (
    <div style={{ padding: 20, width: 440 }}>
      <p style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)", marginBottom: 8 }}>
        HIỆU ỨNG XUẤT HIỆN SO LE (STAGGERED LIST)
      </p>
      <AnimatedList style={{ gap: 6 }}>
        {items.map((item, i) => (
          <AnimatedItem
            key={i}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              backgroundColor: "var(--secondary)",
              fontSize: 13,
            }}
          >
            {item}
          </AnimatedItem>
        ))}
      </AnimatedList>
    </div>
  );
}

export function SoDemVaMoGap() {
  const [open, setOpen] = React.useState(true);

  return (
    <div style={{ padding: 20, width: 440 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Tổng nhiệm vụ đang chạy: </span>
          <span style={{ fontSize: 20, fontWeight: 600 }}>
            <AnimatedNumber value={142} />
          </span>
        </div>
        <Button size="xs" variant="secondary" onClick={() => setOpen(!open)}>
          {open ? "Thu gọn ▴" : "Mở rộng ▾"}
        </Button>
      </div>
      <AnimatedCollapse open={open}>
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            backgroundColor: "var(--secondary)",
            fontSize: 13,
            color: "var(--muted-foreground)",
          }}
        >
          Khối nội dung có animation mở gập tự động tính chiều cao mượt mà.
        </div>
      </AnimatedCollapse>
    </div>
  );
}
