import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Box, IconButton, Select, Text, TextField } from "@radix-ui/themes";
import {
  AvatarIcon,
  ClipboardCopyIcon,
  Cross2Icon,
  InfoCircledIcon,
  LockClosedIcon,
  PersonIcon,
  PlusIcon,
  ReloadIcon,
} from "@radix-ui/react-icons";
import { toast } from "sonner";

import { copyPlainText } from "@/features/app/inventory/services/clipboard.service";
import { PageGuide } from "@/features/app/layout/page-guide";
import { OnlineGuard } from "@/shared/access/online-guard";
import { formatJalaliDateTime } from "@/shared/lib/date/jalali";
import { Button } from "@/shared/ui/button/button";
import { Form } from "@/shared/ui/form/form";
import {
  personnelApi,
  personnelKeys,
  type Capacity,
  type Personnel,
  type PersonnelCreated,
  type StoreRole,
} from "./api";
import { teamActivationService } from "./services/team-activation.service";

type PersonnelForm = {
  first_name: string;
  last_name: string;
  username: string;
  role_id: string;
};

const emptyPersonnelForm: PersonnelForm = {
  first_name: "",
  last_name: "",
  username: "",
  role_id: "",
};

export function PersonnelPage() {
  return (
    <Box dir="rtl" className="personnel-page mx-auto w-full max-w-5xl">
      <PageGuide
        section="تنظیمات"
        sectionTo="/setting"
        title="پرسنل مجموعه"
        description="افزودن اعضا و تغییر نقش و وضعیت دسترسی آن‌ها فقط با اتصال اینترنت انجام می‌شود."
        icon={PersonIcon}
        helpTopic="team"
      />
      <OnlineGuard><PersonnelContent /></OnlineGuard>
    </Box>
  );
}

function PersonnelContent() {
  const client = useQueryClient();
  const capacity = useQuery({ queryKey: personnelKeys.capacity, queryFn: personnelApi.capacity });
  const mode = useQuery({ queryKey: personnelKeys.mode, queryFn: personnelApi.operatingMode });
  const managementEnabled = capacity.data?.enabled === true;
  const teamActive = mode.data?.operating_mode === "team";
  const roles = useQuery({ queryKey: personnelKeys.roles, queryFn: personnelApi.roles, enabled: managementEnabled && teamActive });
  const people = useQuery({ queryKey: personnelKeys.all, queryFn: personnelApi.personnel, enabled: managementEnabled && teamActive });
  const [credentials, setCredentials] = useState<PersonnelCreated | null>(null);
  const [person, setPerson] = useState<PersonnelForm>(emptyPersonnelForm);

  const refresh = () => Promise.all([
    client.invalidateQueries({ queryKey: personnelKeys.all }),
    client.invalidateQueries({ queryKey: personnelKeys.capacity }),
    client.invalidateQueries({ queryKey: personnelKeys.roles }),
  ]);

  const createPerson = useMutation({
    mutationFn: personnelApi.create,
    onSuccess: (value) => {
      setCredentials(value);
      setPerson(emptyPersonnelForm);
      toast.success("حساب پرسنل ساخته شد");
      void refresh();
    },
    onError: () => toast.error("ساخت حساب انجام نشد؛ دوباره تلاش کنید"),
  });
  const updateStatus = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => personnelApi.update(id, { active }),
    onSuccess: () => void refresh(),
    onError: () => toast.error("تغییر وضعیت عضو انجام نشد"),
  });
  const updateRole = useMutation({
    mutationFn: ({ id, roleId }: { id: number; roleId: number }) => personnelApi.update(id, { role_id: roleId }),
    onSuccess: () => {
      toast.success("نقش عضو تغییر کرد");
      void refresh();
    },
    onError: () => toast.error("تغییر نقش عضو انجام نشد"),
  });
  const resetCredentials = useMutation({
    mutationFn: personnelApi.resetCredentials,
    onSuccess: (value) => {
      setCredentials(value);
      toast.success("رمز موقت تازه صادر شد");
      void refresh();
    },
    onError: () => toast.error("صدور رمز موقت انجام نشد"),
  });
  const activateTeam = useMutation({
    mutationFn: () => teamActivationService.activate(mode.data!.policy_version),
    onSuccess: () => {
      toast.success("حالت تیمی فروشگاه فعال شد");
      void client.invalidateQueries({ queryKey: personnelKeys.mode });
      void refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "فعال‌سازی حالت تیمی انجام نشد"),
  });

  const hasCapacity = capacity.data?.enabled === true && (capacity.data.available === null || capacity.data.available > 0);
  const hasRoles = (roles.data?.length ?? 0) > 0;

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!person.first_name || !person.last_name || !person.role_id || !hasCapacity) return;
    createPerson.mutate({
      ...person,
      username: person.username || undefined,
      role_id: Number(person.role_id),
    });
  };

  return (
    <div className="personnel-workspace">
      <CapacitySummary capacity={capacity.data} hasCapacity={hasCapacity} />

      {mode.data && !teamActive ? (
        <section className="personnel-plan-notice" aria-labelledby="team-mode-title">
          <InfoCircledIcon width="22" height="22" aria-hidden="true" />
          <div>
            <h2 id="team-mode-title">فعال‌سازی صریح حالت تیمی</h2>
            <p>پیش از فعال‌سازی، همه عملیات محلی و بازیابی باید تعیین‌تکلیف شوند. پس از فعال‌سازی، تغییرات مشترک فقط با پذیرش سرور نمایش داده می‌شوند و دستگاه‌های دیگر نیز باید به‌روز شوند.</p>
            <Button
              type="button"
              loading={activateTeam.isPending}
              disabled={!mode.data.team_eligible || activateTeam.isPending}
              onClick={() => activateTeam.mutate()}
            >
              فعال‌سازی حالت تیمی
            </Button>
          </div>
        </section>
      ) : null}

      {capacity.data && !capacity.data.enabled ? (
        <section className="personnel-plan-notice" aria-labelledby="personnel-plan-title">
          <InfoCircledIcon width="22" height="22" aria-hidden="true" />
          <div>
            <h2 id="personnel-plan-title">مدیریت پرسنل در پلن فعلی فعال نیست</h2>
            <p>این قابلیت برای پلن‌های تیمی یا چنددستگاهی در نظر گرفته شده است و اطلاعات قبلی مجموعه حفظ می‌شود.</p>
          </div>
        </section>
      ) : null}

      {credentials ? <CredentialsPanel credentials={credentials} onClose={() => setCredentials(null)} /> : null}

      {managementEnabled && teamActive ? (
        <div className="personnel-main-grid">
          <AddPersonnelCard
            form={person}
            roles={roles.data ?? []}
            hasCapacity={hasCapacity}
            hasRoles={hasRoles}
            isLoadingRoles={roles.isLoading}
            isPending={createPerson.isPending}
            onChange={setPerson}
            onSubmit={handleCreate}
          />
          <PersonnelList
            people={people.data ?? []}
            roles={roles.data ?? []}
            isLoading={people.isLoading}
            hasError={people.isError || roles.isError}
            statusPendingId={updateStatus.isPending ? updateStatus.variables?.id : undefined}
            rolePendingId={updateRole.isPending ? updateRole.variables?.id : undefined}
            resetPendingId={resetCredentials.isPending ? resetCredentials.variables : undefined}
            onStatusChange={(id, active) => updateStatus.mutate({ id, active })}
            onRoleChange={(id, roleId) => updateRole.mutate({ id, roleId })}
            onResetCredentials={(id) => resetCredentials.mutate(id)}
          />
        </div>
      ) : null}
    </div>
  );
}

function CapacitySummary({ capacity, hasCapacity }: { capacity?: Capacity; hasCapacity: boolean }) {
  let label = "در حال بررسی ظرفیت";
  if (capacity?.limit === null) label = `${capacity.used.toLocaleString("fa-IR")} عضو فعال · نامحدود`;
  else if (capacity) label = `${capacity.used.toLocaleString("fa-IR")} عضو فعال · ${Math.max(0, capacity.available ?? 0).toLocaleString("fa-IR")} جایگاه باقی‌مانده`;

  return (
    <div className="personnel-capacity-row">
      <Badge className="personnel-capacity-badge" size="2" color={hasCapacity ? "green" : "orange"}>
        <span className="personnel-status-dot" aria-hidden="true" />
        {label}
      </Badge>
    </div>
  );
}

function CredentialsPanel({ credentials, onClose }: { credentials: PersonnelCreated; onClose: () => void }) {
  const copyValue = async (value: string, message: string) => {
    try {
      await copyPlainText(value);
      toast.success(message);
    } catch {
      toast.error("کپی اطلاعات در این مرورگر ممکن نیست");
    }
  };

  return (
    <section className="personnel-credentials" aria-labelledby="credentials-title">
      <div className="personnel-credentials-heading">
        <span className="personnel-credentials-icon" aria-hidden="true"><InfoCircledIcon width="22" height="22" /></span>
        <div>
          <h2 id="credentials-title">اطلاعات ورود فقط همین‌بار نمایش داده می‌شود.</h2>
          <p>این اطلاعات را در جای امن ذخیره کنید.</p>
        </div>
      </div>
      <div className="personnel-credential-list">
        <CredentialRow icon={<PersonIcon />} label="نام کاربری" value={credentials.username} onCopy={() => void copyValue(credentials.username, "نام کاربری کپی شد")} />
        <CredentialRow icon={<LockClosedIcon />} label="رمز موقت" value={credentials.temporary_password} onCopy={() => void copyValue(credentials.temporary_password, "رمز موقت کپی شد")} />
      </div>
      <div className="personnel-credentials-actions">
        <Button
          className="personnel-copy-all"
          color="green"
          leftIcon={<ClipboardCopyIcon />}
          onClick={() => void copyValue(`${credentials.username}\n${credentials.temporary_password}`, "اطلاعات ورود کپی شد")}
        >
          کپی اطلاعات ورود
        </Button>
        <Button variant="soft" color="gray" leftIcon={<Cross2Icon />} onClick={onClose}>بستن</Button>
      </div>
    </section>
  );
}

function CredentialRow({ icon, label, value, onCopy }: { icon: ReactNode; label: string; value: string; onCopy: () => void }) {
  return (
    <div className="personnel-credential-row">
      <span className="personnel-credential-label">{icon}{label}:</span>
      <code dir="ltr">{value}</code>
      <IconButton type="button" variant="soft" aria-label={`کپی ${label}`} onClick={onCopy}><ClipboardCopyIcon /></IconButton>
    </div>
  );
}

function AddPersonnelCard({ form, roles, hasCapacity, hasRoles, isLoadingRoles, isPending, onChange, onSubmit }: {
  form: PersonnelForm;
  roles: StoreRole[];
  hasCapacity: boolean;
  hasRoles: boolean;
  isLoadingRoles: boolean;
  isPending: boolean;
  onChange: (value: PersonnelForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="personnel-card personnel-create-card" aria-labelledby="create-personnel-title">
      <SectionHeading id="create-personnel-title" icon={<PlusIcon />} title="افزودن پرسنل" description="برای ایجاد حساب جدید، اطلاعات زیر را وارد کنید." />
      <Form
        className="personnel-create-form"
        isDirty={Object.values(form).some(Boolean)}
        isSubmitting={isPending}
        onSubmit={onSubmit}
      >
        <TextField.Root size="3" className="personnel-field" aria-label="نام" placeholder="نام" autoComplete="given-name" value={form.first_name} onChange={(event) => onChange({ ...form, first_name: event.target.value })}>
          <TextField.Slot side="left"><PersonIcon /></TextField.Slot>
        </TextField.Root>
        <TextField.Root size="3" className="personnel-field" aria-label="نام خانوادگی" placeholder="نام خانوادگی" autoComplete="family-name" value={form.last_name} onChange={(event) => onChange({ ...form, last_name: event.target.value })}>
          <TextField.Slot side="left"><PersonIcon /></TextField.Slot>
        </TextField.Root>
        <TextField.Root size="3" className="personnel-field" aria-label="نام کاربری دلخواه" placeholder="نام کاربری دلخواه (اختیاری)" autoComplete="off" dir="rtl" value={form.username} onChange={(event) => onChange({ ...form, username: event.target.value })}>
          <TextField.Slot side="left"><span className="personnel-at-sign" aria-hidden="true">@</span></TextField.Slot>
        </TextField.Root>
        <Select.Root value={form.role_id} onValueChange={(roleId) => onChange({ ...form, role_id: roleId })}>
          <Select.Trigger className="personnel-select" aria-label="انتخاب نقش" placeholder={isLoadingRoles ? "در حال دریافت نقش‌ها…" : "انتخاب نقش"} />
          <Select.Content>{roles.map((role) => <Select.Item key={role.id} value={String(role.id)}>{role.name}</Select.Item>)}</Select.Content>
        </Select.Root>
        {!hasRoles && !isLoadingRoles ? <Text as="p" size="1" color="orange">برای افزودن پرسنل، ابتدا یک نقش بسازید.</Text> : null}
        <Button type="submit" className="personnel-create-submit" loading={isPending} disabled={!form.first_name || !form.last_name || !form.role_id || !hasCapacity || !hasRoles} leftIcon={<PlusIcon />}>
          ساخت حساب و رمز موقت
        </Button>
      </Form>
    </section>
  );
}

function PersonnelList({ people, roles, isLoading, hasError, statusPendingId, rolePendingId, resetPendingId, onStatusChange, onRoleChange, onResetCredentials }: {
  people: Personnel[];
  roles: StoreRole[];
  isLoading: boolean;
  hasError: boolean;
  statusPendingId?: number;
  rolePendingId?: number;
  resetPendingId?: number;
  onStatusChange: (id: number, active: boolean) => void;
  onRoleChange: (id: number, roleId: number) => void;
  onResetCredentials: (id: number) => void;
}) {
  return (
    <section className="personnel-card personnel-members-card" aria-labelledby="personnel-members-title">
      <SectionHeading id="personnel-members-title" icon={<AvatarIcon />} title="اعضای پرسنل" description="فهرست اعضای تیم و نقش‌های دسترسی آن‌ها" />
      {isLoading ? <div className="personnel-list-state">در حال دریافت اعضا…</div> : null}
      {hasError ? <div className="personnel-list-state is-error">دریافت اطلاعات اعضا انجام نشد.</div> : null}
      {!isLoading && !hasError && people.length === 0 ? <div className="personnel-list-state"><PersonIcon width="24" height="24" aria-hidden="true" />هنوز عضوی به مجموعه اضافه نشده است.</div> : null}
      <div className="personnel-member-list">
        {people.map((item) => (
          <PersonnelMemberCard
            key={item.membership_id}
            item={item}
            roles={roles}
            statusPending={statusPendingId === item.membership_id}
            rolePending={rolePendingId === item.membership_id}
            resetPending={resetPendingId === item.membership_id}
            onStatusChange={onStatusChange}
            onRoleChange={onRoleChange}
            onResetCredentials={onResetCredentials}
          />
        ))}
      </div>
    </section>
  );
}

function PersonnelMemberCard({ item, roles, statusPending, rolePending, resetPending, onStatusChange, onRoleChange, onResetCredentials }: {
  item: Personnel;
  roles: StoreRole[];
  statusPending: boolean;
  rolePending: boolean;
  resetPending: boolean;
  onStatusChange: (id: number, active: boolean) => void;
  onRoleChange: (id: number, roleId: number) => void;
  onResetCredentials: (id: number) => void;
}) {
  return (
    <article className="personnel-member" data-active={item.active}>
      <div className="personnel-member-header">
        <span className="personnel-avatar" aria-hidden="true"><PersonIcon width="22" height="22" /></span>
        <div className="personnel-member-identity">
          <h3>{item.first_name} {item.last_name}</h3>
          <span dir="ltr">@{item.username}</span>
        </div>
        <Badge color={item.active ? "green" : "gray"}><span className="personnel-status-dot" aria-hidden="true" />{item.active ? "فعال" : "غیرفعال"}</Badge>
      </div>
      <div className="personnel-member-controls">
        <Select.Root value={String(item.role_id)} disabled={rolePending} onValueChange={(roleId) => onRoleChange(item.membership_id, Number(roleId))}>
          <Select.Trigger className="personnel-select" aria-label={`نقش ${item.first_name} ${item.last_name}`} />
          <Select.Content>{roles.map((role) => <Select.Item key={role.id} value={String(role.id)}>{role.name}</Select.Item>)}</Select.Content>
        </Select.Root>
        <Button size="2" variant="soft" color={item.active ? "red" : "green"} loading={statusPending} onClick={() => onStatusChange(item.membership_id, !item.active)}>
          {item.active ? "غیرفعال کردن" : "فعال کردن"}
        </Button>
        <Button size="2" variant="soft" loading={resetPending} leftIcon={<ReloadIcon />} onClick={() => onResetCredentials(item.membership_id)}>رمز موقت تازه</Button>
      </div>
      {item.last_activity_at ? <Text as="p" className="personnel-last-activity" size="1" color="gray">آخرین فعالیت: {formatJalaliDateTime(item.last_activity_at)}</Text> : null}
    </article>
  );
}

function SectionHeading({ id, icon, title, description }: { id: string; icon: ReactNode; title: string; description: string }) {
  return (
    <div className="personnel-section-heading">
      <span className="personnel-section-icon" aria-hidden="true">{icon}</span>
      <div><h2 id={id}>{title}</h2><p>{description}</p></div>
    </div>
  );
}
