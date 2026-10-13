-- CreateTable
CREATE TABLE "task_comment_reactions" (
    "comment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "emoji" VARCHAR(16) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_comment_reactions_pkey" PRIMARY KEY ("comment_id","user_id","emoji")
);

-- CreateIndex
CREATE INDEX "task_comment_reactions_user_id_idx" ON "task_comment_reactions"("user_id");

-- AddForeignKey
ALTER TABLE "task_comment_reactions" ADD CONSTRAINT "task_comment_reactions_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "task_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comment_reactions" ADD CONSTRAINT "task_comment_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
