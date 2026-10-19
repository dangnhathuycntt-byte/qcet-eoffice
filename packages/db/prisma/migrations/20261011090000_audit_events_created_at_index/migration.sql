-- Trang nhật ký kiểm toán mặc định sắp theo created_at giảm dần, không lọc entity/actor: cần index riêng để khỏi quét toàn bảng.
CREATE INDEX IF NOT EXISTS "audit_events_created_at_idx" ON "audit_events"("created_at" DESC);
