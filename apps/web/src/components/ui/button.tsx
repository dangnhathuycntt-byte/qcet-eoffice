import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { focusRingClass } from "@/components/ui/focus-ring";
import { Spinner } from "@/components/ui/spinner";

const buttonVariants = cva(
  `group/button inline-flex shrink-0 items-center justify-center rounded-md border-0 bg-clip-padding text-sm font-medium whitespace-nowrap transition-colors duration-[var(--motion-duration-micro)] motion-reduce:transition-none outline-none select-none ${focusRingClass} disabled:pointer-events-none disabled:opacity-50 aria-invalid:bg-danger-soft aria-invalid:text-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 cursor-pointer`,
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary-hover focus-visible:bg-primary-hover",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-accent focus-visible:bg-selected aria-expanded:bg-selected",
        outline:
          "bg-secondary text-foreground hover:bg-accent focus-visible:bg-selected aria-expanded:bg-selected",
        ghost:
          "text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:bg-selected aria-expanded:bg-selected aria-expanded:text-foreground",
        destructive:
          "bg-danger-soft text-destructive hover:bg-destructive/15 focus-visible:outline-destructive",
        premium:
          "bg-primary text-primary-foreground hover:bg-primary-hover focus-visible:bg-primary-hover",
        link: "text-primary underline-offset-4 hover:underline",
        // Nút trên nền tối của trình xem ảnh (`bg-scrim-strong`): chữ trắng mờ, rê/tiêu điểm nền trắng 10–15%, viền tiêu điểm trắng
        overlay:
          "text-white/80 hover:bg-white/10 hover:text-white focus-visible:bg-white/15 focus-visible:text-white focus-visible:outline-white",
        // Nút phụ nền trắng như Linear (Documentation, Add filter): vòng 0,5px thay viền và bóng rất nhẹ (đo trên linear.app 14/10/2026).
        toolbar:
          "bg-background text-foreground shadow-[0_0_0_0.5px_rgb(0_0_0/0.09),0_3px_6px_-2px_rgb(0_0_0/0.02),0_1px_1px_0_rgb(0_0_0/0.04)] hover:bg-accent",
      },
      size: {
        default:
          "h-9 sm:h-8.5 gap-1.5 px-3.5 py-1.5 text-sm font-medium rounded-md has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-8 sm:h-7 gap-1 px-2.5 text-xs font-medium rounded-sm has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        // Kích thước nút của Linear (đo 14/10/2026): cao 28px, chữ 12px đậm 500, lề 10px, có icon đầu thì lề trái 8px, icon 14px cách chữ 6px
        sm: "h-8 sm:h-7 gap-1.5 rounded-lg px-2.5 text-xs font-medium has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        // Nút bo tròn hẳn như Linear ở header, thanh công cụ và trang trống (Create new project, New project): cùng số đo với `sm`
        pill: "h-8 sm:h-7 gap-1.5 rounded-full px-2.5 text-xs font-medium has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        // Pill nhỏ trong header hộp thoại (Create with Agent, Hide của Linear đo 16/10/2026): cao 24px, lề 8px, có icon đầu thì lề trái 6px
        "pill-xs": "h-8 sm:h-6 gap-1 rounded-full px-2 text-xs font-medium has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 px-6 text-base font-medium rounded-md has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-9 sm:size-8.5 rounded-md",
        "icon-xs": "size-8 sm:size-7 rounded-sm [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-8 sm:size-7 rounded-sm",
        // Nút icon trên header trang (mở menu, liên kết, panel thuộc tính): 32px, icon 14px, chuẩn theo trang Nhiệm vụ
        "icon-md": "size-8 rounded-md [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-11 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Đang xử lý: hiện Spinner, khóa nút, giữ nguyên nhãn. Với `asChild` chỉ gắn aria-busy. */
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, loading = false, type = "button", children, ...props }, ref) => {
    const busyAria = loading ? { "aria-busy": true } : {};
    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<any>;
      return React.cloneElement(child, {
        ref,
        "data-slot": "button",
        className: cn(buttonVariants({ variant, size, className }), child.props.className),
        ...busyAria,
        ...props,
      });
    }

    const spinnerSize = size === "xs" || size === "sm" || size === "pill" || size === "pill-xs" || size === "icon-xs" || size === "icon-sm" ? "xs" : "sm";
    return (
      <button
        ref={ref}
        type={type}
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
        disabled={props.disabled || loading}
        aria-busy={loading || undefined}
      >
        {loading && <Spinner size={spinnerSize} />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

// Chip thuộc tính mở menu/lịch (trigger Select, Combobox, Popover) như hàng thuộc tính hộp New project của Linear
// (đo 16/10/2026): pill 24px nền trắng viền 0,5px, chữ 12px đậm 500 (Linear Inter 450; Be Vietnam Pro nét mảnh hơn nên 400 trông nhạt,
// 500 mới ra cùng độ đậm, so ảnh Retina 17/10/2026), icon đầu cách lề 6px; đang mở = nền selected, lỗi = aria-invalid
const PROPERTY_PILL_CLASS = cn(buttonVariants({ variant: "toolbar", size: "pill-xs" }), "pl-1.5 data-[popup-open]:bg-selected");

export { Button, buttonVariants, PROPERTY_PILL_CLASS };
