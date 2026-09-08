export interface TourStepConfig {
  id: string;
  title: string;
  description: string;
  targetSelector: string;
  fallbackSelector?: string;
  zone?: string;
}

export interface ChecklistTaskConfig {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  actionType: "NAVIGATE" | "REQUEST_PUSH" | "OPEN_SEARCH" | "MODAL";
  targetAction?: string;
}

export function calculateOnboardingProgress(completedSteps: string[] = ["step-profile"]) {
  const totalCount = 4;
  const uniqueSteps = new Set(completedSteps);
  // Guarantee step-profile is completed (Endowed progress 25%)
  uniqueSteps.add("step-profile");
  const completedCount = Math.min(uniqueSteps.size, totalCount);
  const percentage = Math.round((completedCount / totalCount) * 100);

  return {
    completedCount,
    totalCount,
    percentage,
    isCompleted: percentage === 100,
  };
}

export function getRoleTourSteps(role: string, dbRole?: string): TourStepConfig[] {
  const effectiveRole = dbRole || role;

  if (effectiveRole === "BAN_GIAM_HIEU" || effectiveRole === "ADMIN") {
    return [
      {
        id: "bgh-scope",
        title: "Phạm Vi Chỉ Đạo",
        description: "Chuyển đổi linh hoạt giữa góc nhìn Toàn trường và Đơn vị trực thuộc phụ trách.",
        targetSelector: "#tour-scope-switcher",
        zone: "portal",
      },
      {
        id: "bgh-radar",
        title: "Radar & Điểm Nghẽn Đơn Vị",
        description: "Nhận diện tức thời các phòng ban có khối lượng quá hạn cao để ban hành Nghị quyết can thiệp.",
        targetSelector: "#tour-radar-card",
        fallbackSelector: "#tour-cockpit-metrics",
        zone: "portal",
      },
      {
        id: "bgh-search",
        title: "Tìm Kiếm Toàn Năng",
        description: "Bấm phím tắt Cmd+K để tra cứu thần tốc bất kỳ văn bản, tờ trình hay nhân sự.",
        targetSelector: "#tour-topbar-search",
      },
    ];
  }

  if (effectiveRole === "TRUONG_PHONG" || effectiveRole === "MANAGER") {
    return [
      {
        id: "manager-scope",
        title: "Phạm Vi Đơn Vị",
        description: "Theo dõi toàn bộ khối lượng công việc, tiến độ nhiệm vụ trực thuộc Khoa/Phòng.",
        targetSelector: "#tour-scope-switcher",
        zone: "portal",
      },
      {
        id: "manager-assign",
        title: "Giao Việc & Phê Duyệt",
        description: "Phân công công việc theo quy trình DACUM và duyệt các minh chứng sản phẩm được nộp.",
        targetSelector: "#tour-create-task-btn",
        fallbackSelector: "#tour-manager-workspace",
        zone: "portal",
      },
      {
        id: "manager-search",
        title: "Tra Cứu Tiến Độ (Cmd+K)",
        description: "Lọc nhanh tiến độ nhiệm vụ và thống kê số liệu định kỳ của đơn vị.",
        targetSelector: "#tour-topbar-search",
      },
    ];
  }

  if (effectiveRole === "VAN_THU") {
    return [
      {
        id: "vt-docs",
        title: "Sổ Văn Bản Đến / Đi",
        description: "Đăng ký và quản lý văn bản chính thức theo đúng quy chuẩn Nghị định 30/2020/NĐ-CP.",
        targetSelector: "#tour-nav-documents",
        fallbackSelector: "#tour-scope-switcher",
        zone: "documents",
      },
      {
        id: "vt-numbering",
        title: "Cấp Số Văn Bản Tự Động",
        description: "Hệ sinh thái số hóa tự động sinh mã số và lưu trữ hồ sơ theo niên khóa.",
        targetSelector: "#tour-nav-documents",
      },
      {
        id: "vt-search",
        title: "Tìm Kiếm Hồ Sơ (Cmd+K)",
        description: "Tra cứu nhanh số hiệu, trích yếu văn bản chỉ trong vài giây.",
        targetSelector: "#tour-topbar-search",
      },
    ];
  }

  // Mặc định: Chuyên viên / Giảng viên (STAFF / CHUYEN_VIEN)
  return [
    {
      id: "staff-workspace",
      title: "Bàn Làm Việc Cá Nhân",
      description: "Tập trung toàn bộ nhiệm vụ và chỉ đạo được giao đích danh cho Thầy/Cô.",
      targetSelector: "#tour-tasks-landing",
      fallbackSelector: "#tour-scope-switcher",
      zone: "tasks",
    },
    {
      id: "staff-deliverable",
      title: "Đề Xuất Nhiệm Vụ & Nộp Báo Cáo",
      description: "Chủ động tạo tờ trình đề xuất việc mới, hoặc đính kèm file minh chứng khi hoàn thành nhiệm vụ.",
      targetSelector: "#tour-empty-state-cta",
      fallbackSelector: "#tour-create-task-btn",
      zone: "tasks",
    },
    {
      id: "staff-search",
      title: "Phím Tắt Toàn Năng (Cmd+K)",
      description: "Mở hộp tìm kiếm nhanh mọi lúc, mọi nơi trên toàn hệ thống.",
      targetSelector: "#tour-topbar-search",
    },
  ];
}

export function getRoleChecklist(role: string, dbRole?: string): ChecklistTaskConfig[] {
  const effectiveRole = dbRole || role;

  return [
    {
      id: "step-profile",
      title: "Định danh tài khoản & vai trò",
      description: "Đã hoàn thành xác thực danh tính vào hệ thống QCET E-Office.",
      actionLabel: "Đã nhận vai trò",
      actionType: "MODAL",
    },
    {
      id: "step-push",
      title: "Bật nhận thông báo chỉ đạo khẩn",
      description: "Nhận Web Push tức thì khi có nhiệm vụ mới hoặc chỉ đạo từ cấp trên.",
      actionLabel: "Bật thông báo ngay",
      actionType: "REQUEST_PUSH",
    },
    {
      id: "step-action",
      title:
        effectiveRole === "BAN_GIAM_HIEU" || effectiveRole === "ADMIN"
          ? "Kiểm tra Radar điểm nghẽn đơn vị"
          : effectiveRole === "TRUONG_PHONG" || effectiveRole === "MANAGER"
          ? "Phân công hoặc duyệt việc đầu tiên"
          : effectiveRole === "VAN_THU"
          ? "Kiểm tra Sổ văn bản đến NĐ 30"
          : "Nộp minh chứng hoặc tạo tờ trình",
      description: "Làm quen với thao tác nghiệp vụ cốt lõi theo vai trò của Thầy/Cô.",
      actionLabel: "Thực hiện",
      actionType: "NAVIGATE",
    },
    {
      id: "step-search",
      title: "Trải nghiệm tìm kiếm nhanh Cmd+K",
      description: "Sử dụng phím tắt Cmd+K (hoặc Ctrl+K) để tra cứu thần tốc.",
      actionLabel: "Thử tìm kiếm",
      actionType: "OPEN_SEARCH",
    },
  ];
}

export const ONBOARDING_FEATURES = {
  adminSteps: getRoleTourSteps("ADMIN"),
  managerSteps: getRoleTourSteps("MANAGER"),
  staffSteps: getRoleTourSteps("STAFF"),
  adminChecklist: getRoleChecklist("ADMIN"),
  managerChecklist: getRoleChecklist("MANAGER"),
  staffChecklist: getRoleChecklist("STAFF"),
};

export interface OnboardingState {
  hasSeenWelcome: boolean;
  hasCompletedTour: boolean;
  completedSteps: string[];
  isDismissed: boolean;
  snoozedUntil: string | null;
}

export const LEGACY_ONBOARDING_STORAGE_KEY = "qcet_onboarding_state";

export function getOnboardingStorageKey(userId?: string | null): string {
  return userId ? `qcet_onboarding_state_${userId}` : "qcet_onboarding_state_guest";
}

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  hasSeenWelcome: false,
  hasCompletedTour: false,
  completedSteps: ["step-profile"],
  isDismissed: false,
  snoozedUntil: null,
};

export function resolveOnboardingState(
  user: {
    id?: string;
    onboardedAt?: string | Date | null;
    onboardingData?: Partial<OnboardingState> | null;
  } | null,
  storedState: Partial<OnboardingState> | null
): OnboardingState {
  // 1. Trường hợp người dùng đã hoàn thành onboarding trước đó (ghi nhận qua onboardedAt)
  if (user?.onboardedAt) {
    return {
      hasSeenWelcome: true,
      hasCompletedTour: true,
      completedSteps: user.onboardingData?.completedSteps || [
        "step-profile",
        "step-push",
        "step-action",
        "step-search",
      ],
      isDismissed: true,
      snoozedUntil: null,
    };
  }

  // 2. Tài khoản mới hoặc onboarding đã được xoá/reset từ Database (onboardedAt: null và onboardingData: null)
  // Ưu tiên trạng thái mặc định từ server, không để localStorage cũ ghi đè
  if (user?.id && !user.onboardedAt && !user.onboardingData) {
    return {
      ...DEFAULT_ONBOARDING_STATE,
    };
  }

  // 3. Dữ liệu từ database (source of truth cao nhất khi có onboardingData)
  const serverData = user?.onboardingData;
  const initialSteps =
    serverData?.completedSteps ||
    storedState?.completedSteps ||
    ["step-profile"];

  return {
    hasSeenWelcome:
      serverData?.hasSeenWelcome ?? storedState?.hasSeenWelcome ?? false,
    hasCompletedTour:
      serverData?.hasCompletedTour ?? storedState?.hasCompletedTour ?? false,
    completedSteps: Array.from(new Set([...initialSteps, "step-profile"])),
    isDismissed:
      serverData?.isDismissed ?? storedState?.isDismissed ?? false,
    snoozedUntil:
      serverData?.snoozedUntil ?? storedState?.snoozedUntil ?? null,
  };
}
