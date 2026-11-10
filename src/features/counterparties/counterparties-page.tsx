import { PageGuide } from "@/features/app/layout/page-guide";
import { accessState } from "@/shared/access/access-state";
import { OnlineGuard } from "@/shared/access/online-guard";
import { userErrorMessage } from "@/shared/lib/presentation/user-error";
import { Button } from "@/shared/ui/button/button";
import { ConfirmDialog } from "@/shared/ui/dialog/confirm-dialog";
import { Form } from "@/shared/ui/form/form";
import { MagnifyingGlassIcon, Pencil1Icon, PersonIcon, PlusIcon, TrashIcon } from "@radix-ui/react-icons";
import { Badge, Box, Callout, Card, Flex, IconButton, Select, Spinner, Text, TextArea, TextField } from "@radix-ui/themes";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { counterpartiesApi, counterpartyKeys, type Counterparty, type CounterpartyInput } from "./api";

const emptyForm: CounterpartyInput = { kind: "person", name: "", phone: null, address: null };

export function CounterpartiesPage() {
  return (
    <Box dir="rtl" className="counterparties-page mx-auto w-full max-w-5xl">
      <PageGuide section="ابزارها" sectionTo="/tools" title="طرف‌حساب‌ها" description="افراد و مجموعه‌هایی که با آن‌ها خرید یا فروش دارید." icon={PersonIcon} helpTopic="invoices" />
      <OnlineGuard><CounterpartiesContent /></OnlineGuard>
    </Box>
  );
}

function CounterpartiesContent() {
  const client = useQueryClient();
  const canManage = accessState.hasStorePermission("counterparties.manage");
  const hasInvoiceAccess = accessState.canUse("invoices.purchase") || accessState.canUse("invoices.sale");
  const query = useQuery({ queryKey: counterpartyKeys.all, queryFn: counterpartiesApi.list, enabled: hasInvoiceAccess });
  const [form, setForm] = useState<CounterpartyInput>(emptyForm);
  const [editing, setEditing] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Counterparty | null>(null);

  const refresh = () => client.invalidateQueries({ queryKey: counterpartyKeys.all });
  const save = useMutation({
    mutationFn: (input: CounterpartyInput) => editing == null ? counterpartiesApi.create(input) : counterpartiesApi.update(editing, input),
    onSuccess: () => {
      toast.success(editing == null ? "طرف‌حساب اضافه شد" : "تغییرات ذخیره شد");
      setForm(emptyForm); setEditing(null); void refresh();
    },
    onError: (error) => toast.error(userErrorMessage(error, "ذخیره طرف‌حساب انجام نشد.")),
  });
  const remove = useMutation({
    mutationFn: counterpartiesApi.remove,
    onSuccess: () => { toast.success("طرف‌حساب حذف شد"); setDeleteTarget(null); void refresh(); },
    onError: (error) => toast.error(userErrorMessage(error, "حذف طرف‌حساب انجام نشد.")),
  });

  const visible = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("fa-IR");
    if (!needle) return query.data ?? [];
    return (query.data ?? []).filter((item) => [item.name, item.phone, item.address].some((value) => value?.toLocaleLowerCase("fa-IR").includes(needle)));
  }, [query.data, search]);

  if (!hasInvoiceAccess) return <Callout.Root color="amber"><Callout.Text>این بخش در طرح فعلی شما فعال نیست.</Callout.Text></Callout.Root>;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !canManage) return;
    save.mutate({ ...form, name: form.name.trim(), phone: form.phone?.trim() || null, address: form.address?.trim() || null });
  };

  const edit = (item: Counterparty) => {
    setEditing(item.id);
    setForm({ kind: item.kind, name: item.name, phone: item.phone, address: item.address });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return <div className="counterparties-workspace">
    {canManage ? <Card size="3" className="counterparty-form-card">
      <Form onSubmit={submit} isSubmitting={save.isPending} isDirty={Boolean(form.name || form.phone || form.address)}>
        <div className="counterparty-form-grid">
          <label><Text as="span" size="2" weight="medium">نوع</Text><Select.Root value={form.kind} onValueChange={(kind) => setForm((current) => ({ ...current, kind: kind as CounterpartyInput["kind"] }))}><Select.Trigger mt="2" aria-label="نوع طرف‌حساب"/><Select.Content><Select.Item value="person">فرد</Select.Item><Select.Item value="organization">مجموعه</Select.Item></Select.Content></Select.Root></label>
          <label><Text as="span" size="2" weight="medium">نام</Text><TextField.Root mt="2" aria-label="نام طرف‌حساب" value={form.name} maxLength={160} placeholder={form.kind === "person" ? "مثلاً علی رضایی" : "مثلاً فروشگاه سپهر"} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}/></label>
          <label><Text as="span" size="2" weight="medium">تلفن <Text color="gray">(اختیاری)</Text></Text><TextField.Root mt="2" dir="ltr" aria-label="تلفن طرف‌حساب" value={form.phone ?? ""} maxLength={32} placeholder="0912…" onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}/></label>
          <label className="counterparty-address"><Text as="span" size="2" weight="medium">نشانی <Text color="gray">(اختیاری)</Text></Text><TextArea mt="2" aria-label="نشانی طرف‌حساب" value={form.address ?? ""} maxLength={300} rows={2} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}/></label>
        </div>
        <Flex mt="4" gap="2" justify="end" wrap="wrap">
          {editing != null ? <Button type="button" variant="soft" color="gray" onClick={() => { setEditing(null); setForm(emptyForm); }}>انصراف</Button> : null}
          <Button type="submit" disabled={!form.name.trim()} loading={save.isPending}><PlusIcon />{editing == null ? "افزودن" : "ذخیره"}</Button>
        </Flex>
      </Form>
    </Card> : <Callout.Root color="amber"><Callout.Text>دسترسی شما فقط برای مشاهده طرف‌حساب‌هاست.</Callout.Text></Callout.Root>}

    <section className="counterparty-results">
    <TextField.Root className="counterparty-search" value={search} placeholder="جست‌وجوی نام یا تلفن" onChange={(event) => setSearch(event.target.value)}><TextField.Slot><MagnifyingGlassIcon /></TextField.Slot></TextField.Root>
    {query.isLoading ? <Flex justify="center" py="8"><Spinner /></Flex> : query.isError ? <Callout.Root color="red"><Callout.Text>دریافت طرف‌حساب‌ها انجام نشد.</Callout.Text></Callout.Root> : visible.length === 0 ? <Card><Flex direction="column" align="center" gap="3" py="8"><PersonIcon width="30" height="30"/><Text>{search ? "موردی پیدا نشد." : "هنوز طرف‌حسابی ثبت نشده است."}</Text></Flex></Card> : <div className="counterparty-list">{visible.map((item) => <Card key={item.id} className="counterparty-card">
      <Flex align="center" justify="between" gap="3">
        <Flex align="center" gap="3" minWidth="0"><Box className="counterparty-avatar" data-kind={item.kind}><PersonIcon /></Box><Box minWidth="0"><Flex align="center" gap="2" wrap="wrap"><Text weight="bold">{item.name}</Text><Badge color={item.kind === "organization" ? "violet" : "gray"}>{item.kind === "organization" ? "مجموعه" : "فرد"}</Badge></Flex>{item.phone ? <Text as="div" size="2" color="gray" dir="ltr">{item.phone}</Text> : null}{item.address ? <Text as="div" size="1" color="gray" className="counterparty-card-address">{item.address}</Text> : null}</Box></Flex>
        {canManage ? <Flex gap="2"><IconButton variant="soft" aria-label={`ویرایش ${item.name}`} onClick={() => edit(item)}><Pencil1Icon /></IconButton><IconButton variant="soft" color="red" aria-label={`حذف ${item.name}`} onClick={() => setDeleteTarget(item)}><TrashIcon /></IconButton></Flex> : null}
      </Flex>
    </Card>)}</div>}
    </section>
    <ConfirmDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }} title="حذف طرف‌حساب؟" description={deleteTarget ? `«${deleteTarget.name}» از فهرست حذف می‌شود؛ فاکتورهای قبلی بدون تغییر می‌مانند.` : ""} confirmLabel="حذف" variant="danger" loading={remove.isPending} onConfirm={() => { if (deleteTarget) remove.mutate(deleteTarget.id); }}/>
  </div>;
}
