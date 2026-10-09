import React from "react";
import { HorizontalBarChart, StackedBarChart, TrendLine } from "qcet-eoffice";

const barData = [
  { label: "Phòng Quản lý Đào tạo", value: 42, highlight: true },
  { label: "Khoa Công nghệ Thông tin", value: 38 },
  { label: "Phòng Hành chính - Tổng hợp", value: 29 },
  { label: "Khoa Kinh tế & Quản trị", value: 24 },
  { label: "Phòng Công tác Sinh viên", value: 18 },
];

const stackedData = [
  { label: "Đúng hạn (78%)", value: 78, color: "var(--foreground)" },
  { label: "Gần hạn (14%)", value: 14, color: "var(--muted-foreground)" },
  { label: "Quá hạn (8%)", value: 8, color: "var(--border)" },
];

const trendData = [
  { xLabel: "T2", value: 12 },
  { xLabel: "T3", value: 19 },
  { xLabel: "T4", value: 15 },
  { xLabel: "T5", value: 28 },
  { xLabel: "T6", value: 34 },
  { xLabel: "T7", value: 22 },
  { xLabel: "CN", value: 30 },
];

export function BieuDoThanhNgang() {
  return (
    <div style={{ width: 460, padding: 20 }}>
      <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>TIẾN ĐỘ THEO ĐƠN VỊ</p>
      <HorizontalBarChart data={barData} labelWidth="200px" />
    </div>
  );
}

export function TienDoVaXuHuong() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, width: 460, padding: 20 }}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>TỶ LỆ HOÀN THÀNH NHIỆM VỤ</p>
        <StackedBarChart segments={stackedData} showLegend />
      </div>
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>XU HƯỚNG VĂN BẢN ĐẾN TRONG TUẦN</p>
        <TrendLine data={trendData} finalLabel="30 văn bản" />
      </div>
    </div>
  );
}
