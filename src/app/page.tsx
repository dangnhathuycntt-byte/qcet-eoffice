import Link from "next/link";
import {
  CheckSquare,
  Calendar,
  Network,
  Bell,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Building,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  return (
    <div className="space-y-8 py-4">
      {/* Welcome Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 md:p-10 shadow-xs">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">QCET E-Office</Badge>
            <Badge variant="outline">Giai đoạn 1 (MVP)</Badge>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Văn phòng Điều hành & Quản trị Công việc Điện tử
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            Hệ thống quản lý công việc, phân công nhiệm vụ, lịch công tác và kết nối tổ chức
            Trường Cao đẳng Kinh tế - Kỹ thuật Cần Thơ.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link href="/tasks">
              <Button size="lg" className="shadow-sm">
                Xem công việc
                <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link href="/calendar">
              <Button variant="outline" size="lg">
                Lịch công tác
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Navigation Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:border-primary/40 transition-all hover:shadow-md">
          <CardHeader>
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CheckSquare className="size-5" />
            </div>
            <CardTitle className="pt-2">Quản lý Công việc</CardTitle>
            <CardDescription>
              Theo dõi tiến độ theo Kanban, phân công và kiểm soát hạn chót.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/tasks" className="w-full">
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span>Chi tiết</span>
                <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          </CardFooter>
        </Card>

        <Card className="hover:border-primary/40 transition-all hover:shadow-md">
          <CardHeader>
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Calendar className="size-5" />
            </div>
            <CardTitle className="pt-2">Lịch công tác</CardTitle>
            <CardDescription>
              Lịch họp, sự kiện toàn trường và lịch cá nhân trực quan.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/calendar" className="w-full">
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span>Chi tiết</span>
                <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          </CardFooter>
        </Card>

        <Card className="hover:border-primary/40 transition-all hover:shadow-md">
          <CardHeader>
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Network className="size-5" />
            </div>
            <CardTitle className="pt-2">Cơ cấu Tổ chức</CardTitle>
            <CardDescription>
              Sơ đồ phòng ban, đơn vị trực thuộc và phân quyền nhân sự.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/org" className="w-full">
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span>Chi tiết</span>
                <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          </CardFooter>
        </Card>

        <Card className="hover:border-primary/40 transition-all hover:shadow-md">
          <CardHeader>
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Bell className="size-5" />
            </div>
            <CardTitle className="pt-2">Thông báo & Trao đổi</CardTitle>
            <CardDescription>
              Cập nhật tức thì các thông báo, bình luận và nhiệm vụ mới.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/notifications" className="w-full">
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span>Chi tiết</span>
                <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </section>
    </div>
  );
}
