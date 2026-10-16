import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Box, Callout, Card, Checkbox, Flex, Grid, Select, Text, TextField } from "@radix-ui/themes";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button/button";
import { formatJalaliDateTime } from "@/shared/lib/date/jalali";
import { permissionOptions, personnelApi, type PersonnelCreated } from "./api";

const keys = { all: ["store-personnel"] as const, roles: ["store-roles"] as const, capacity: ["personnel-capacity"] as const };

export function PersonnelPage() {
  const client = useQueryClient();
  const roles = useQuery({ queryKey: keys.roles, queryFn: personnelApi.roles });
  const people = useQuery({ queryKey: keys.all, queryFn: personnelApi.personnel });
  const capacity = useQuery({ queryKey: keys.capacity, queryFn: personnelApi.capacity });
  const [credentials, setCredentials] = useState<PersonnelCreated | null>(null);
  const [roleName, setRoleName] = useState("");
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [person, setPerson] = useState({ first_name: "", last_name: "", username: "", role_id: "" });
  const refresh = () => Promise.all([client.invalidateQueries({ queryKey: keys.all }), client.invalidateQueries({ queryKey: keys.capacity }), client.invalidateQueries({ queryKey: keys.roles })]);
  const saveRole = useMutation({ mutationFn: (input: { name: string; permissions: string[] }) => editingRoleId ? personnelApi.updateRole(editingRoleId, input) : personnelApi.createRole(input), onSuccess: () => { setRoleName(""); setPermissions([]); setEditingRoleId(null); void client.invalidateQueries({ queryKey: keys.roles }); toast.success("نقش ذخیره شد"); } });
  const deleteRole = useMutation({ mutationFn: personnelApi.deleteRole, onSuccess: () => void client.invalidateQueries({ queryKey: keys.roles }), onError: () => toast.error("نقشِ اختصاص‌داده‌شده را ابتدا از اعضا جدا کنید") });
  const createPerson = useMutation({ mutationFn: personnelApi.create, onSuccess: (value) => { setCredentials(value); setPerson({ first_name: "", last_name: "", username: "", role_id: "" }); void refresh(); } });
  const update = useMutation({ mutationFn: ({ id, active }: { id: number; active: boolean }) => personnelApi.update(id, { active }), onSuccess: () => void refresh() });
  const resetCredentials = useMutation({ mutationFn: personnelApi.resetCredentials, onSuccess: (value) => { setCredentials(value); void refresh(); } });
  const hasCapacity = capacity.data?.enabled === true && (capacity.data.available === null || capacity.data.available > 0);

  return (
    <Box dir="rtl" className="mx-auto w-full max-w-5xl">
      <Flex justify="between" align="end" gap="4" wrap="wrap" mb="6">
        <Box><h1 className="text-3xl font-bold">پرسنل مجموعه</h1><Text color="gray">دسترسی هر شخص با نقش او کنترل می‌شود و تغییرات فقط آنلاین انجام می‌شوند.</Text></Box>
        <Badge size="2" color={hasCapacity ? "green" : "orange"}>{capacity.data ? (capacity.data.limit === null ? `${capacity.data.used} عضو فعال · نامحدود` : `${capacity.data.used} از ${capacity.data.limit} جایگاه فعال`) : "در حال بررسی ظرفیت"}</Badge>
      </Flex>
      {capacity.data && !capacity.data.enabled ? <Callout.Root color="orange" mb="5"><Callout.Text>مدیریت پرسنل در طرح فعلی فعال نیست. اطلاعات قبلی حفظ می‌شود.</Callout.Text></Callout.Root> : null}
      {credentials ? <Callout.Root color="green" mb="5"><Callout.Text><Text weight="bold">اطلاعات ورود فقط همین یک‌بار نمایش داده می‌شود.</Text><br />نام کاربری: <code>{credentials.username}</code><br />رمز موقت: <code>{credentials.temporary_password}</code><Flex mt="3"><Button variant="soft" onClick={() => { void navigator.clipboard.writeText(`${credentials.username}\n${credentials.temporary_password}`); toast.success("اطلاعات ورود کپی شد"); }}>کپی اطلاعات ورود</Button><Button variant="ghost" onClick={() => setCredentials(null)}>بستن</Button></Flex></Callout.Text></Callout.Root> : null}
      <Grid columns={{ initial: "1", md: "2" }} gap="5">
        <Card><h2 className="mb-4 text-xl font-bold">افزودن پرسنل</h2><Flex direction="column" gap="3"><TextField.Root placeholder="نام" value={person.first_name} onChange={(e) => setPerson({ ...person, first_name: e.target.value })} /><TextField.Root placeholder="نام خانوادگی" value={person.last_name} onChange={(e) => setPerson({ ...person, last_name: e.target.value })} /><TextField.Root placeholder="نام کاربری دلخواه (اختیاری)" value={person.username} onChange={(e) => setPerson({ ...person, username: e.target.value })} /><Select.Root value={person.role_id} onValueChange={(role_id) => setPerson({ ...person, role_id })}><Select.Trigger placeholder="انتخاب نقش" /><Select.Content>{roles.data?.map((role) => <Select.Item key={role.id} value={String(role.id)}>{role.name}</Select.Item>)}</Select.Content></Select.Root><Button intent="positive" loading={createPerson.isPending} disabled={!person.first_name || !person.last_name || !person.role_id || !hasCapacity} onClick={() => createPerson.mutate({ ...person, username: person.username || undefined, role_id: Number(person.role_id) })}>ساخت حساب و رمز موقت</Button></Flex></Card>
        <Card><h2 className="mb-2 text-xl font-bold">{editingRoleId ? "ویرایش نقش" : "نقش تازه"}</h2><Text size="2" color="gray">نقش تازه بدون مجوز شروع می‌شود؛ وابستگی‌های لازم هنگام ذخیره خودکار افزوده می‌شوند.</Text><Flex direction="column" gap="3" mt="4"><TextField.Root placeholder="نام نقش" value={roleName} onChange={(e) => setRoleName(e.target.value)} /><Grid columns="2" gap="2">{permissionOptions.map(([id, label]) => <Text as="label" size="2" key={id} className="flex items-center gap-2"><Checkbox checked={permissions.includes(id)} onCheckedChange={(checked) => setPermissions((current) => checked ? [...current, id] : current.filter((item) => item !== id))} />{label}</Text>)}</Grid><Flex><Button intent="positive" variant="soft" disabled={!roleName.trim()} loading={saveRole.isPending} onClick={() => saveRole.mutate({ name: roleName, permissions })}>ذخیره نقش</Button>{editingRoleId ? <Button variant="ghost" onClick={() => { setEditingRoleId(null); setRoleName(""); setPermissions([]); }}>انصراف</Button> : null}</Flex><Flex direction="column" gap="2">{roles.data?.map((role) => <Flex key={role.id} justify="between" align="center"><Text size="2">{role.name} · {role.assigned_count} عضو</Text><Flex><Button size="1" variant="ghost" onClick={() => { setEditingRoleId(role.id); setRoleName(role.name); setPermissions(role.permissions); }}>ویرایش</Button><Button size="1" color="red" variant="ghost" disabled={role.assigned_count > 0} onClick={() => deleteRole.mutate(role.id)}>حذف</Button></Flex></Flex>)}</Flex></Flex></Card>
      </Grid>
      <h2 className="mb-3 mt-7 text-xl font-bold">اعضای پرسنل</h2>
      <Grid columns={{ initial: "1", md: "2" }} gap="3">{people.data?.map((item) => <Card key={item.membership_id}><Flex justify="between" gap="3"><Box><Text weight="bold">{item.first_name} {item.last_name}</Text><Text as="div" size="2" color="gray">@{item.username}</Text><Select.Root value={String(item.role_id)} onValueChange={(role_id) => personnelApi.update(item.membership_id, { role_id: Number(role_id) }).then(refresh)}><Select.Trigger mt="2" /><Select.Content>{roles.data?.map((role) => <Select.Item key={role.id} value={String(role.id)}>{role.name}</Select.Item>)}</Select.Content></Select.Root>{item.last_activity_at ? <Text as="div" size="1" color="gray">آخرین فعالیت: {formatJalaliDateTime(item.last_activity_at)}</Text> : null}</Box><Flex direction="column" align="end" gap="2"><Badge color={item.active ? "green" : "gray"}>{item.active ? "فعال" : "غیرفعال"}</Badge><Button size="2" variant="soft" loading={update.isPending} onClick={() => update.mutate({ id: item.membership_id, active: !item.active })}>{item.active ? "غیرفعال‌کردن" : "فعال‌کردن"}</Button><Button size="1" variant="ghost" loading={resetCredentials.isPending} onClick={() => resetCredentials.mutate(item.membership_id)}>صدور رمز موقت تازه</Button></Flex></Flex></Card>)}</Grid>
    </Box>
  );
}
