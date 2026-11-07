import { useRef, useState, type ComponentType, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Callout, Checkbox, TextField } from "@radix-ui/themes";
import {
  BackpackIcon,
  BarChartIcon,
  CubeIcon,
  DashboardIcon,
  GearIcon,
  IdCardIcon,
  LayersIcon,
  LockClosedIcon,
  Pencil1Icon,
  PersonIcon,
  PlusCircledIcon,
  ReaderIcon,
  TrashIcon,
} from "@radix-ui/react-icons";
import { toast } from "sonner";

import { PageGuide } from "@/features/app/layout/page-guide";
import { OnlineGuard } from "@/shared/access/online-guard";
import { Button } from "@/shared/ui/button/button";
import { permissionOptions, personnelApi, personnelKeys, type StoreRole } from "./api";

type PermissionId = (typeof permissionOptions)[number][0];
type Icon = ComponentType<{ width?: string | number; height?: string | number; "aria-hidden"?: boolean | "true" | "false" }>;

type PermissionGroup = {
  title: string;
  icon: Icon;
  permissions: PermissionId[];
};

const permissionLabels = new Map<PermissionId, string>(permissionOptions);

const permissionGroups: PermissionGroup[] = [
  {
    title: "مدیریت محصولات",
    icon: CubeIcon,
    permissions: [
      "products.view",
      "products.create",
      "products.edit",
      "products.quantity.change",
      "products.sale_price.view",
      "products.sale_price.change",
      "products.purchase_price.view",
      "products.purchase_price.change",
    ],
  },
  {
    title: "گزارش‌ها و تحلیل",
    icon: BarChartIcon,
    permissions: ["finance.view", "products.delete"],
  },
  {
    title: "مدیریت داده‌ها",
    icon: LayersIcon,
    permissions: ["categories.manage", "labels.manage"],
  },
  {
    title: "عملیات و بارکد",
    icon: ReaderIcon,
    permissions: ["products.bulk", "barcodes.lookup", "barcodes.manage", "labels.print"],
  },
  {
    title: "سایر دسترسی‌ها",
    icon: GearIcon,
    permissions: ["dashboard.view", "tools.import", "tools.export", "tools.catalog", "tools.backup", "tools.restore"],
  },
];

const permissionIcons: Partial<Record<PermissionId, Icon>> = {
  "products.view": CubeIcon,
  "products.create": PlusCircledIcon,
  "products.edit": Pencil1Icon,
  "finance.view": BarChartIcon,
  "categories.manage": LayersIcon,
  "products.bulk": PersonIcon,
  "barcodes.lookup": ReaderIcon,
  "barcodes.manage": ReaderIcon,
  "labels.print": IdCardIcon,
  "dashboard.view": DashboardIcon,
  "tools.import": IdCardIcon,
  "tools.export": BackpackIcon,
  "tools.catalog": IdCardIcon,
  "tools.backup": BackpackIcon,
  "tools.restore": BackpackIcon,
  "products.delete": TrashIcon,
};

export function RolesPage() {
  return (
    <Box dir="rtl" className="roles-page mx-auto w-full max-w-5xl">
      <PageGuide
        section="تنظیمات"
        sectionTo="/setting"
        title="نقش‌های مجموعه"
        description="مجوزهای اعضای مجموعه را در نقش‌های مستقل تعریف کنید. مشاهده و ثبت تغییرات این بخش فقط با اتصال اینترنت انجام می‌شود."
        icon={LockClosedIcon}
        helpTopic="team"
      />
      <OnlineGuard><RolesContent /></OnlineGuard>
    </Box>
  );
}

function RolesContent() {
  const client = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const capacity = useQuery({ queryKey: personnelKeys.capacity, queryFn: personnelApi.capacity });
  const managementEnabled = capacity.data?.enabled === true;
  const roles = useQuery({ queryKey: personnelKeys.roles, queryFn: personnelApi.roles, enabled: managementEnabled });
  const [roleName, setRoleName] = useState("");
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);

  const resetForm = () => {
    setRoleName("");
    setPermissions([]);
    setEditingRoleId(null);
  };

  const saveRole = useMutation({
    mutationFn: (input: { name: string; permissions: string[] }) => editingRoleId
      ? personnelApi.updateRole(editingRoleId, input)
      : personnelApi.createRole(input),
    onSuccess: () => {
      resetForm();
      void client.invalidateQueries({ queryKey: personnelKeys.roles });
      toast.success(editingRoleId ? "تغییرات نقش ذخیره شد" : "نقش تازه ساخته شد");
    },
    onError: () => toast.error("ذخیره نقش انجام نشد؛ دوباره تلاش کنید"),
  });

  const deleteRole = useMutation({
    mutationFn: personnelApi.deleteRole,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: personnelKeys.roles });
      toast.success("نقش حذف شد");
    },
    onError: () => toast.error("نقشِ اختصاص‌داده‌شده را ابتدا از اعضا جدا کنید"),
  });

  const togglePermission = (permission: PermissionId, checked: boolean) => {
    setPermissions((current) => checked
      ? current.includes(permission) ? current : [...current, permission]
      : current.filter((item) => item !== permission));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = roleName.trim();
    if (!name) return;
    saveRole.mutate({ name, permissions });
  };

  const beginEditing = (role: StoreRole) => {
    setEditingRoleId(role.id);
    setRoleName(role.name);
    setPermissions(role.permissions);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <div className="roles-workspace">
      {capacity.data && !managementEnabled ? <PlanNotice /> : null}

      {managementEnabled ? (
        <>
          <RoleEditor
            formRef={formRef}
            roleName={roleName}
            permissions={permissions}
            editing={editingRoleId !== null}
            isPending={saveRole.isPending}
            onNameChange={setRoleName}
            onPermissionChange={togglePermission}
            onCancel={resetForm}
            onSubmit={handleSubmit}
          />
          <RoleList
            roles={roles.data ?? []}
            isLoading={roles.isLoading}
            hasError={roles.isError}
            deletingRoleId={deleteRole.isPending ? deleteRole.variables : undefined}
            onEdit={beginEditing}
            onDelete={(id) => deleteRole.mutate(id)}
          />
        </>
      ) : null}
    </div>
  );
}

function PlanNotice() {
  return (
    <Callout.Root className="roles-plan-notice" color="orange" role="status">
      <Callout.Text>
        مدیریت نقش‌ها برای پلن فعلی فعال نیست. این قابلیت برای پلن‌های تیمی یا چنددستگاهی در نظر گرفته شده است و نقش‌های قبلی مجموعه حفظ می‌شوند.
      </Callout.Text>
    </Callout.Root>
  );
}

function RoleEditor({ formRef, roleName, permissions, editing, isPending, onNameChange, onPermissionChange, onCancel, onSubmit }: {
  formRef: React.RefObject<HTMLFormElement | null>;
  roleName: string;
  permissions: string[];
  editing: boolean;
  isPending: boolean;
  onNameChange: (value: string) => void;
  onPermissionChange: (permission: PermissionId, checked: boolean) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form ref={formRef} className="role-editor" aria-labelledby="role-editor-title" onSubmit={onSubmit}>
      <header className="role-editor-heading">
        <span className="role-heading-icon" aria-hidden="true"><PersonIcon width="23" height="23" /></span>
        <div>
          <h2 id="role-editor-title">{editing ? "ویرایش نقش" : "نقش تازه"}</h2>
          <p>{editing ? "نام و سطح دسترسی این نقش را به‌روزرسانی کنید." : "نقش تازه بدون مجوز شروع می‌شود؛ وابستگی‌های لازم هنگام ذخیره در سرور افزوده می‌شوند."}</p>
        </div>
      </header>

      <div className="role-name-field">
        <label htmlFor="role-name">نام نقش <span aria-hidden="true">*</span></label>
        <TextField.Root
          id="role-name"
          className="role-name-input"
          size="3"
          placeholder="نام نقش را وارد کنید…"
          value={roleName}
          required
          autoComplete="off"
          onChange={(event) => onNameChange(event.target.value)}
        >
          <TextField.Slot side="left"><PersonIcon width="20" height="20" aria-hidden="true" /></TextField.Slot>
        </TextField.Root>
      </div>

      <div className="role-permission-groups">
        {permissionGroups.map((group) => <PermissionGroupCard key={group.title} group={group} selected={permissions} onChange={onPermissionChange} />)}
      </div>

      <div className="role-editor-actions">
        <Button type="submit" className="role-save-button" loading={isPending} disabled={!roleName.trim()} leftIcon={<IdCardIcon width="20" height="20" />}>
          {editing ? "ذخیره تغییرات" : "ذخیره نقش"}
        </Button>
        {editing ? <Button type="button" className="role-cancel-button" variant="soft" onClick={onCancel}>انصراف</Button> : null}
      </div>
    </form>
  );
}

function PermissionGroupCard({ group, selected, onChange }: {
  group: PermissionGroup;
  selected: string[];
  onChange: (permission: PermissionId, checked: boolean) => void;
}) {
  const GroupIcon = group.icon;
  return (
    <fieldset className="role-permission-group">
      <legend className="role-permission-title">
        <span className="role-permission-group-icon" aria-hidden="true"><GroupIcon width="20" height="20" /></span>
        <span>{group.title}</span>
      </legend>
      <div className="role-permission-grid">
        {group.permissions.map((permission) => {
          const PermissionIcon = permissionIcons[permission] ?? LockClosedIcon;
          return (
            <label className="role-permission-option" key={permission} data-selected={selected.includes(permission)}>
              <Checkbox
                size="3"
                checked={selected.includes(permission)}
                onCheckedChange={(checked) => onChange(permission, checked === true)}
              />
              <PermissionIcon width="19" height="19" aria-hidden="true" />
              <span>{permissionLabels.get(permission)}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function RoleList({ roles, isLoading, hasError, deletingRoleId, onEdit, onDelete }: {
  roles: StoreRole[];
  isLoading: boolean;
  hasError: boolean;
  deletingRoleId?: number;
  onEdit: (role: StoreRole) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <section className="roles-list-panel" aria-labelledby="roles-list-title">
      <header className="roles-list-heading">
        <span className="role-heading-icon" aria-hidden="true"><PersonIcon width="23" height="23" /></span>
        <div>
          <h2 id="roles-list-title">نقش‌های تعریف‌شده</h2>
          <p>مدیریت نقش‌ها و سطح دسترسی اعضای مجموعه</p>
        </div>
        {!isLoading && !hasError ? <span className="roles-count">{roles.length.toLocaleString("fa-IR")} نقش</span> : null}
      </header>

      {isLoading ? <div className="roles-list-state">در حال دریافت نقش‌ها…</div> : null}
      {hasError ? <div className="roles-list-state is-error">دریافت نقش‌ها انجام نشد؛ اتصال اینترنت را بررسی کنید.</div> : null}
      {!isLoading && !hasError && roles.length === 0 ? <div className="roles-list-state">هنوز نقشی ساخته نشده است.</div> : null}

      {!isLoading && !hasError && roles.length > 0 ? (
        <div className="roles-list">
          {roles.map((role) => (
            <article className="role-card" key={role.id}>
              <div className="role-card-summary">
                <span className="role-card-icon" aria-hidden="true"><CubeIcon width="22" height="22" /></span>
                <div className="role-card-title">
                  <h3>{role.name}</h3>
                  <p>
                    <span><PersonIcon width="17" height="17" aria-hidden="true" />{role.assigned_count.toLocaleString("fa-IR")} عضو</span>
                    <i aria-hidden="true" />
                    <span><LockClosedIcon width="17" height="17" aria-hidden="true" />{role.permissions.length.toLocaleString("fa-IR")} مجوز</span>
                  </p>
                </div>
              </div>
              <div className="role-card-actions">
                <Button variant="soft" className="role-edit-button" leftIcon={<Pencil1Icon width="18" height="18" />} onClick={() => onEdit(role)}>
                  ویرایش
                </Button>
                <Button
                  color="red"
                  variant="soft"
                  className="role-delete-button"
                  leftIcon={<TrashIcon width="18" height="18" />}
                  loading={deletingRoleId === role.id}
                  disabled={role.assigned_count > 0}
                  aria-label={role.assigned_count > 0 ? `حذف ${role.name}؛ ابتدا اعضای نقش را جابه‌جا کنید` : `حذف ${role.name}`}
                  onClick={() => onDelete(role.id)}
                >
                  حذف
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
