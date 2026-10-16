import { useState } from "react";
import { BookmarkIcon, Cross2Icon, Pencil1Icon, PlusIcon } from "@radix-ui/react-icons";
import { Box, Callout, Card, Flex, IconButton, Spinner, Text, TextField } from "@radix-ui/themes";
import { Button } from "@/shared/ui/button/button";
import { useCreateLabel, useDeleteLabel, useLabels, useUpdateLabel } from "../../mutations/use-labels";
import { ConfirmDialog } from "@/shared/ui/dialog/confirm-dialog";
import { toast } from "sonner";

export default function LabelsPage() {
  const { data: labels = [], isLoading } = useLabels();
  const create = useCreateLabel();
  const update = useUpdateLabel();
  const remove = useDeleteLabel();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const error = create.error ?? update.error ?? remove.error;

  const submit = async () => {
    try {
      if (editing == null) {
        await create.mutateAsync({ name });
        toast.success("برچسب ایجاد شد");
      } else {
        await update.mutateAsync({ id: editing, name });
        toast.success("برچسب ویرایش شد");
      }
      setName("");
      setEditing(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ذخیره برچسب ناموفق بود");
    }
  };

  const deleteLabel = async () => {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync(deleteTarget.id);
      toast.success(`برچسب «${deleteTarget.name}» حذف شد`);
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "حذف برچسب ناموفق بود");
    }
  };

  return (
    <Box dir="rtl" className="space-y-6">
      <Box>
        <Text as="div" size="6" weight="bold">برچسب‌ها</Text>
        <Text as="p" size="2" color="gray" mt="2" className="leading-6">
          برای گروه‌بندی منعطف محصولات چند برچسب بسازید. برچسب‌ها متعلق به حساب شما هستند و تغییرات حتی در حالت آفلاین ذخیره می‌شوند.
        </Text>
      </Box>
      <Card size="3">
        <Flex gap="3" align="end" wrap="wrap">
          <Box className="grow">
            <Text as="label" size="2" weight="medium">{editing == null ? "برچسب جدید" : "ویرایش برچسب"}</Text>
            <TextField.Root mt="2" value={name} maxLength={60} placeholder="مثلاً پرفروش" onChange={(e) => setName(e.target.value)} />
          </Box>
          <Button intent="positive" disabled={!name.trim()} loading={create.isPending || update.isPending} onClick={() => void submit()}>
            <PlusIcon /> {editing == null ? "افزودن" : "ذخیره"}
          </Button>
          {editing != null && <Button variant="soft" onClick={() => { setEditing(null); setName(""); }}>انصراف</Button>}
        </Flex>
      </Card>
      {error && <Callout.Root color="red"><Callout.Text>{error instanceof Error ? error.message : "ذخیره برچسب انجام نشد"}</Callout.Text></Callout.Root>}
      {isLoading ? <Flex justify="center" py="8"><Spinner /></Flex> : labels.length === 0 ? (
        <Card><Flex direction="column" align="center" gap="3" py="8"><BookmarkIcon width="28" height="28"/><Text>هنوز برچسبی ندارید.</Text></Flex></Card>
      ) : (
        <Flex direction="column" gap="2">
          {labels.map((label) => (
            <Card key={label.id}>
              <Flex justify="between" align="center" gap="3">
                <Flex align="center" gap="3"><Box className="card-title-icon"><BookmarkIcon /></Box><Text weight="medium">{label.name}</Text></Flex>
                <Flex gap="2">
                  <IconButton variant="soft" aria-label={`ویرایش ${label.name}`} onClick={() => { setEditing(label.id); setName(label.name); }}><Pencil1Icon /></IconButton>
                  <IconButton color="red" variant="soft" aria-label={`حذف ${label.name}`} onClick={() => setDeleteTarget({ id: label.id, name: label.name })}><Cross2Icon /></IconButton>
                </Flex>
              </Flex>
            </Card>
          ))}
        </Flex>
      )}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="حذف برچسب؟"
        description={deleteTarget ? `«${deleteTarget.name}» از برچسب‌ها حذف می‌شود.` : ""}
        confirmLabel="حذف"
        cancelLabel="لغو"
        variant="danger"
        loading={remove.isPending}
        onConfirm={() => { void deleteLabel(); }}
      />
    </Box>
  );
}
