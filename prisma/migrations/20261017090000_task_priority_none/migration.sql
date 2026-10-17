-- AlterEnum: mức "Không ưu tiên" (nhiệm vụ cũ giữ nguyên mức đang có; Postgres không xóa được giá trị enum, rollback = để không dùng)
ALTER TYPE "TaskPriority" ADD VALUE 'NONE';
