import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Callout, Card, Checkbox, Flex, Grid, Text, TextField } from "@radix-ui/themes";
import { LockClosedIcon } from "@radix-ui/react-icons";
import { toast } from "sonner";
import { PageGuide } from "@/features/app/layout/page-guide";
import { OnlineGuard } from "@/shared/access/online-guard";
import { Button } from "@/shared/ui/button/button";
import { permissionOptions, personnelApi, personnelKeys } from "./api";

export function RolesPage() {
  return (
    <Box dir="rtl" className="mx-auto w-full max-w-5xl">
      <PageGuide section="تنظیمات" sectionTo="/setting" title="نقش‌های مجموعه" description="مجوزهای اعضای مجموعه را در نقش‌های مستقل تعریف کنید. مشاهده و ثبت تغییرات این بخش فقط با اتصال اینترنت انجام می‌شود." icon={LockClosedIcon} />
      <OnlineGuard><RolesContent /></OnlineGuard>
    </Box>
  );
}

function RolesContent() {
  const client = useQueryClient();
  const capacity = useQuery({ queryKey: personnelKeys.capacity, queryFn: personnelApi.capacity });
  const managementEnabled = capacity.data?.enabled === true;
  const roles = useQuery({ queryKey: personnelKeys.roles, queryFn: personnelApi.roles, enabled: managementEnabled });
  const [roleName, setRoleName] = useState("");
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const resetForm = () => { setRoleName(""); setPermissions([]); setEditingRoleId(null); };
  const saveRole = useMutation({
    mutationFn: (input: { name: string; permissions: string[] }) => editingRoleId ? personnelApi.updateRole(editingRoleId, input) : personnelApi.createRole(input),
    onSuccess: () => { resetForm(); void client.invalidateQueries({ queryKey: personnelKeys.roles }); toast.success("نقش ذخیره شد"); },
  });
  const deleteRole = useMutation({
    mutationFn: personnelApi.deleteRole,
    onSuccess: () => { void client.invalidateQueries({ queryKey: personnelKeys.roles }); toast.success("نقش حذف شد"); },
    onError: () => toast.error("نقشِ اختصاص‌داده‌شده را ابتدا از اعضا جدا کنید"),
  });

  return (
    <Box>
      {capacity.data && !managementEnabled ? (
        <Callout.Root color="orange" mb="5"><Callout.Text>مدیریت نقش‌ها برای طرح فعلی فعال نیست. این قابلیت همراه با پشتیبانی تیم یا چند دستگاه ارائه می‌شود و نقش‌های قبلی مجموعه حفظ خواهند شد.</Callout.Text></Callout.Root>
      ) : null}
      {managementEnabled ? (
        <Grid columns={{ initial: "1", md: "2" }} gap="5" align="start">
          <Card>
            <h2 className="mb-2 text-xl font-bold">{editingRoleId ? "ویرایش نقش" : "نقش تازه"}</h2>
            <Text size="2" color="gray">نقش تازه بدون مجوز شروع می‌شود؛ وابستگی‌های لازم هنگام ذخیره در سرور افزوده می‌شوند.</Text>
            <Flex direction="column" gap="3" mt="4">
              <TextField.Root placeholder="نام نقش" value={roleName} onChange={(event) => setRoleName(event.target.value)} />
              <Grid columns={{ initial: "1", sm: "2" }} gap="2">
                {permissionOptions.map(([id, label]) => (
                  <Text as="label" size="2" key={id} className="flex items-center gap-2">
                    <Checkbox checked={permissions.includes(id)} onCheckedChange={(checked) => setPermissions((current) => checked ? [...current, id] : current.filter((item) => item !== id))} />
                    {label}
                  </Text>
                ))}
              </Grid>
              <Flex gap="2">
                <Button variant="soft" disabled={!roleName.trim()} loading={saveRole.isPending} onClick={() => saveRole.mutate({ name: roleName, permissions })}>ذخیره نقش</Button>
                {editingRoleId ? <Button variant="ghost" onClick={resetForm}>انصراف</Button> : null}
              </Flex>
            </Flex>
          </Card>
          <Box>
            <h2 className="mb-3 text-xl font-bold">نقش‌های تعریف‌شده</h2>
            <Flex direction="column" gap="3">
              {roles.data?.map((role) => (
                <Card key={role.id}>
                  <Flex justify="between" align="center" gap="3">
                    <Box>
                      <Text weight="bold">{role.name}</Text>
                      <Text as="div" size="2" color="gray" mt="1">{role.assigned_count} عضو · {role.permissions.length} مجوز</Text>
                    </Box>
                    <Flex gap="1">
                      <Button size="1" variant="ghost" onClick={() => { setEditingRoleId(role.id); setRoleName(role.name); setPermissions(role.permissions); }}>ویرایش</Button>
                      <Button size="1" color="red" variant="ghost" disabled={role.assigned_count > 0 || deleteRole.isPending} onClick={() => deleteRole.mutate(role.id)}>حذف</Button>
                    </Flex>
                  </Flex>
                </Card>
              ))}
            </Flex>
          </Box>
        </Grid>
      ) : null}
    </Box>
  );
}
