"use client";

import * as React from "react";
import { GraduationCap, Landmark, RotateCw, School, Target, User, UserCheck, UserCog, UserX, Users } from "lucide-react";
import { foldVietnamese } from "@qcet/shared/lib/search/vietnamese-search";
import { MENTION_ALL_NAME } from "@qcet/shared/domain/tasks/comment-mentions";
import { audienceScopeGroups, type AudienceScopeId } from "@qcet/shared/domain/meetings/audience-scopes";
import { cn } from "@/lib/utils";
import { PROPERTY_PILL_CLASS } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/ui/user-avatar";
import { MenuActionItem, MenuContent, MenuOptionItem, MenuRoot, MenuSeparator, MenuSubmenu, MenuTrigger } from "@/components/ui/menu";
import { useDepartmentList } from "@/hooks/use-department-list";

export interface MeetingPerson {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string | null;
  departmentName?: string;
  /** Mã chức vụ ở mọi đơn vị người đó có mặt: để chọn nhanh theo phạm vi (Ban Giám hiệu, trưởng đơn vị…) */
  positionCodes?: string[];
}

interface MeetingUnit {
  id: string;
  /** Tên đầy đủ: tiêu đề menu con */
  name: string;
  /** Tên gọn (`shortName`) trên hàng đơn vị */
  label: string;
  people: MeetingPerson[];
}

export interface MeetingDirectory {
  units: MeetingUnit[];
  /** Mỗi người một lần, xếp theo tên (kết quả tìm) */
  people: MeetingPerson[];
  loading: boolean;
  /** Tải danh bạ lỗi (không phải danh bạ trống): menu hiện "Thử lại" */
  failed: boolean;
  reload: () => void;
}

/** Số avatar xếp chồng trên chip trước khi chỉ còn số đếm. */
const STACK_MAX = 3;

/**
 * Danh bạ cả trường để mời họp, theo đơn vị (thứ tự `displayOrder` của cơ cấu, bỏ đơn vị chưa có cán bộ). Người kiêm nhiệm
 * có trong mọi đơn vị của mình nhưng là một người; tên đơn vị kèm theo người là đơn vị đầu tiên.
 */
export function useMeetingPeople(enabled: boolean): MeetingDirectory {
  const { departments, isLoading, error, reload } = useDepartmentList({ includePersonnel: true, enabled });
  return React.useMemo(() => {
    const byId = new Map<string, MeetingPerson>();
    const units: MeetingUnit[] = [];
    const ordered = [...departments].sort(
      (a, b) => (a.displayOrder ?? Number.MAX_SAFE_INTEGER) - (b.displayOrder ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name, "vi")
    );
    for (const department of ordered) {
      const label = department.shortName || department.name;
      const people = (department.personnel ?? []).map((person) => {
        const known = byId.get(person.id);
        if (known) {
          // Người kiêm nhiệm: gom mã chức vụ của mọi đơn vị (giảng viên ở khoa này, trưởng phòng ở nơi kia)
          if (person.positionCode && !known.positionCodes?.includes(person.positionCode)) known.positionCodes = [...(known.positionCodes ?? []), person.positionCode];
          return known;
        }
        const entry: MeetingPerson = {
          id: person.id,
          name: person.name,
          email: person.email,
          avatarUrl: person.avatarUrl,
          departmentName: label,
          positionCodes: person.positionCode ? [person.positionCode] : [],
        };
        byId.set(person.id, entry);
        return entry;
      });
      if (people.length > 0) units.push({ id: department.id, name: department.name, label, people });
    }
    const people = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "vi"));
    return { units, people, loading: isLoading, failed: error, reload };
  }, [departments, isLoading, error, reload]);
}

/** Ô tìm trong menu: chữ gõ vào ô, không để menu bắt làm phím nhảy mục; mũi tên, Enter, Esc, Tab vẫn điều hướng menu. */
const MENU_NAV_KEYS = ["ArrowDown", "ArrowUp", "Escape", "Enter", "Tab"];

/**
 * Thân menu chọn người: ô tìm, rồi các đơn vị (rê chuột mở menu con nhân sự, như bộ lọc nhiều cấp của trang Nhiệm vụ;
 * người dùng yêu cầu "2 sub menu là đơn vị - nhân sự" 20/10/2026). Đang gõ tìm thì hiện thẳng người khớp ở cả trường.
 * Đơn vị có người đang chọn thì chữ đậm và ghi số bên phải. Có `onPickAll` (chọn nhiều) thì đầu mỗi menu con có dòng "all"
 * chọn cả đơn vị, cùng tên với "@all" của bình luận (người dùng yêu cầu "thêm @all cho từng đơn vị" 21/10/2026), và dưới ô
 * tìm có hàng "Phạm vi" mở menu con Toàn trường, Ban Giám hiệu, Trưởng đơn vị… (người dùng yêu cầu "thêm một li là phạm
 * vi: toàn trường, trưởng đơn vị" 22/10/2026; trước đó "Toàn trường" là một hàng riêng).
 */
/**
 * Khung menu chọn người: cao tối đa bằng chỗ trống cạnh nút (`--available-height` của Base UI), chỉ danh sách đơn vị co lại.
 * Trước đây danh sách tự trừ 48px cho ô tìm nên khi có thêm hàng "Phạm vi" menu cao hơn chỗ trống; chip nằm thấp (hàng chip
 * dưới phần thân hộp Tạo cuộc họp) thì menu lật lên và ô tìm ra ngoài màn hình (22/10/2026).
 */
const PEOPLE_MENU_CLASS = "w-64 md:flex md:max-h-[var(--available-height)] md:flex-col";

function PeopleMenuBody({
  directory,
  query,
  onQueryChange,
  isSelected,
  isLocked,
  hiddenIds,
  onPick,
  closeOnPick,
  searchLabel,
  topRows,
  onPickAll,
}: {
  directory: MeetingDirectory;
  query: string;
  onQueryChange: (query: string) => void;
  isSelected: (id: string) => boolean;
  isLocked?: (id: string) => boolean;
  hiddenIds?: ReadonlySet<string>;
  onPick: (person: MeetingPerson) => void;
  closeOnPick: boolean;
  searchLabel: string;
  /** Hàng thao tác ngay dưới ô tìm ("Bỏ chọn") */
  topRows?: React.ReactNode;
  /** Bấm dòng "all" của một đơn vị: chọn hết người của đơn vị, đã chọn hết thì bỏ chọn */
  onPickAll?: (people: MeetingPerson[]) => void;
}) {
  const Item = closeOnPick ? MenuActionItem : MenuOptionItem;
  const visible = (person: MeetingPerson) => !hiddenIds?.has(person.id);
  const folded = foldVietnamese(query.trim());
  const units = directory.units
    .map((unit) => ({ ...unit, people: unit.people.filter(visible) }))
    .filter((unit) => unit.people.length > 0);
  const matches = folded
    ? directory.people.filter((p) => visible(p) && [p.name, p.email, p.departmentName].some((t) => foldVietnamese(t ?? "").includes(folded)))
    : [];

  const personRow = (person: MeetingPerson, showUnit: boolean) => {
    const locked = isLocked?.(person.id) ?? false;
    return (
      <Item
        key={person.id}
        selected={isSelected(person.id)}
        disabled={locked}
        title={[person.name, person.departmentName, locked ? "đã dự họp" : ""].filter(Boolean).join(" · ")}
        leading={<UserAvatar name={person.name} avatarUrl={person.avatarUrl} size="sm" />}
        hint={showUnit ? <span className="block max-w-24 truncate">{person.departmentName}</span> : undefined}
        onClick={() => onPick(person)}
      >
        {person.name}
      </Item>
    );
  };
  const note = (text: string) => <div className="px-2 py-1.5 text-xs text-muted-foreground">{text}</div>;
  // Dòng chọn cả một nhóm: đã chọn hết thì đậm như đang chọn; toàn người đã dự họp thì mờ
  const groupRow = (people: MeetingPerson[], label: string, title: string, icon: React.ReactNode) => (
    <MenuOptionItem
      selected={people.length > 0 && people.every((p) => isSelected(p.id))}
      disabled={Boolean(isLocked) && people.every((p) => isLocked?.(p.id))}
      title={title}
      leading={
        <span aria-hidden className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </span>
      }
      hint={`${people.length} người`}
      onClick={() => onPickAll?.(people)}
    >
      {label}
    </MenuOptionItem>
  );
  const everyone = directory.people.filter(visible);
  const scopeGroups = audienceScopeGroups(everyone);
  const SCOPE_ICONS: Record<AudienceScopeId, React.ReactNode> = {
    all: <School className="size-3" />,
    executive: <Landmark className="size-3" />,
    "unit-head": <UserCog className="size-3" />,
    "unit-deputy": <UserCheck className="size-3" />,
    lecturer: <GraduationCap className="size-3" />,
  };

  return (
    <>
      <Input
        variant="menu"
        autoFocus
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (!MENU_NAV_KEYS.includes(event.key)) event.stopPropagation();
        }}
        placeholder="Tìm người…"
        aria-label={searchLabel}
        className="mb-1 border-b border-border/60"
      />
      {topRows}
      {onPickAll && !folded && everyone.length > 0 ? (
        <>
          <MenuSubmenu label="Phạm vi" icon={<Target />} title="Phạm vi" popupClassName="w-64" side="right">
            {scopeGroups.map((group) => (
              <React.Fragment key={group.id}>
                {groupRow(group.people, group.label, `Chọn ${group.people.length} người: ${group.label.toLowerCase()}`, SCOPE_ICONS[group.id])}
              </React.Fragment>
            ))}
          </MenuSubmenu>
          <MenuSeparator />
        </>
      ) : null}
      {/* Đủ chỗ cho cả 15 đơn vị khi màn cao; màn thấp thì chỉ danh sách co lại vừa chỗ còn lại (khung menu cao tối đa bằng
          chỗ trống, `PEOPLE_MENU_CLASS`). Danh sách đơn vị cao ít nhất ~7 hàng: dưới nút không đủ chỗ thì menu lật lên trên
          thay vì co còn vài hàng */}
      <div
        className={cn(
          "max-h-[420px] min-h-0 overflow-y-auto overscroll-contain max-md:max-h-none",
          !folded && units.length >= 7 && "min-h-48 max-md:min-h-0"
        )}
      >
        {folded
          ? matches.length > 0
            ? matches.map((person) => personRow(person, true))
            : note("Không tìm thấy người phù hợp")
          : units.length > 0
            ? units.map((unit) => {
                const count = unit.people.filter((p) => isSelected(p.id)).length;
                return (
                  <MenuSubmenu key={unit.id} label={unit.label} title={unit.name} hint={count || undefined} active={count > 0} popupClassName="w-64" side="right">
                    {onPickAll ? (
                      <>
                        {groupRow(unit.people, MENTION_ALL_NAME, `Chọn cả ${unit.people.length} người của ${unit.name}`, <Users className="size-3" />)}
                        <MenuSeparator />
                      </>
                    ) : null}
                    {unit.people.map((person) => personRow(person, false))}
                  </MenuSubmenu>
                );
              })
            : directory.failed
              ? (
                <>
                  {note("Chưa tải được danh sách cán bộ.")}
                  <MenuOptionItem leading={<RotateCw />} onClick={directory.reload}>
                    Thử lại
                  </MenuOptionItem>
                </>
              )
              : note(directory.loading ? "Đang tải danh sách…" : "Chưa có danh sách cán bộ")}
      </div>
    </>
  );
}

/**
 * Chọn nhiều người dự họp. Mặc định là chip "Thành phần" của hộp tạo cuộc họp; trang chi tiết truyền `trigger` (nút "Thêm")
 * và `lockedIds` (người đã dự họp: hiện như đang chọn, không bỏ được vì chưa có API bỏ người). Menu giữ mở khi chọn.
 */
export function ParticipantsPicker({
  directory,
  value,
  onChange,
  hiddenIds,
  lockedIds,
  trigger,
  onOpenChange,
  align = "start",
}: {
  directory: MeetingDirectory;
  value: MeetingPerson[];
  onChange: (next: MeetingPerson[]) => void;
  /** Không có trong menu (người tạo, chủ tọa đã chọn) */
  hiddenIds?: ReadonlySet<string>;
  lockedIds?: ReadonlySet<string>;
  /** Nút mở menu thay cho chip mặc định (phần tử dùng làm `render` của `MenuTrigger`) */
  trigger?: React.ReactElement;
  onOpenChange?: (open: boolean) => void;
  /** Canh menu theo mép nút: `end` khi nút nằm ở mép phải (đầu thẻ Thành phần) */
  align?: "start" | "end";
}) {
  const [query, setQuery] = React.useState("");
  const selectedIds = React.useMemo(() => new Set(value.map((p) => p.id)), [value]);
  const shown = value.slice(0, STACK_MAX);

  const toggle = (person: MeetingPerson) => {
    if (lockedIds?.has(person.id)) return;
    onChange(selectedIds.has(person.id) ? value.filter((p) => p.id !== person.id) : [...value, person]);
  };
  // Cả đơn vị: thêm người chưa chọn; đã chọn hết thì bỏ những người bỏ được (người đã dự họp giữ nguyên)
  const toggleAll = (people: MeetingPerson[]) => {
    const free = people.filter((p) => !lockedIds?.has(p.id));
    if (free.length === 0) return;
    const freeIds = new Set(free.map((p) => p.id));
    onChange(
      free.every((p) => selectedIds.has(p.id))
        ? value.filter((p) => !freeIds.has(p.id))
        : [...value, ...free.filter((p) => !selectedIds.has(p.id))]
    );
  };

  return (
    <MenuRoot
      onOpenChange={(open) => {
        if (!open) setQuery("");
        onOpenChange?.(open);
      }}
    >
      {trigger ? (
        <MenuTrigger render={trigger} />
      ) : (
        <MenuTrigger
          aria-label={value.length > 0 ? `Thành phần: ${value.map((p) => p.name).join(", ")}` : "Thành phần"}
          className={cn(PROPERTY_PILL_CLASS, value.length === 0 && "text-muted-foreground")}
        >
          {value.length > 0 ? (
            <span className="flex -space-x-1">
              {shown.map((person) => (
                <UserAvatar key={person.id} name={person.name} avatarUrl={person.avatarUrl} size="xs" className="ring-1 ring-background" />
              ))}
            </span>
          ) : (
            <Users className="size-3.5 text-muted-foreground" />
          )}
          <span className="truncate">{value.length > 0 ? `${value.length} người` : "Thành phần"}</span>
        </MenuTrigger>
      )}
      <MenuContent align={align} mobileSheet sheetTitle="Thành phần" positionerClassName="z-[60]" className={PEOPLE_MENU_CLASS} aria-label="Chọn người dự họp">
        <PeopleMenuBody
          directory={directory}
          query={query}
          onQueryChange={setQuery}
          isSelected={(id) => selectedIds.has(id)}
          isLocked={lockedIds ? (id) => lockedIds.has(id) : undefined}
          hiddenIds={hiddenIds}
          onPick={toggle}
          onPickAll={toggleAll}
          closeOnPick={false}
          searchLabel="Tìm người dự họp"
        />
      </MenuContent>
    </MenuRoot>
  );
}

/** Chip chọn một người làm chủ tọa, cùng menu đơn vị → nhân sự; chọn xong thì đóng. Có `onClear` thì menu có "Bỏ chọn". */
export function ChairPicker({
  directory,
  value,
  onChange,
  onClear,
  emptyLabel = "Chủ tọa",
  open,
  onOpenChange,
}: {
  directory: MeetingDirectory;
  value: MeetingPerson | null;
  onChange: (person: MeetingPerson) => void;
  onClear?: () => void;
  emptyLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [query, setQuery] = React.useState("");

  return (
    <MenuRoot
      open={open}
      onOpenChange={(next) => {
        if (!next) setQuery("");
        onOpenChange?.(next);
      }}
    >
      <MenuTrigger
        aria-label={value ? `Chủ tọa: ${value.name}` : emptyLabel}
        className={cn(PROPERTY_PILL_CLASS, !value && "text-muted-foreground")}
      >
        {value ? <UserAvatar name={value.name} avatarUrl={value.avatarUrl} size="xs" /> : <User className="size-3.5 text-muted-foreground" />}
        <span className="max-w-[140px] truncate">{value?.name ?? emptyLabel}</span>
      </MenuTrigger>
      <MenuContent align="start" mobileSheet sheetTitle="Chủ tọa" positionerClassName="z-[60]" className={PEOPLE_MENU_CLASS} aria-label="Chọn chủ tọa">
        <PeopleMenuBody
          directory={directory}
          query={query}
          onQueryChange={setQuery}
          isSelected={(id) => value?.id === id}
          onPick={onChange}
          closeOnPick
          searchLabel="Tìm chủ tọa"
          topRows={
            value && onClear && !query ? (
              <>
                <MenuActionItem leading={<UserX />} className="text-muted-foreground" onClick={onClear}>
                  Bỏ chọn
                </MenuActionItem>
                <MenuSeparator />
              </>
            ) : null
          }
        />
      </MenuContent>
    </MenuRoot>
  );
}
