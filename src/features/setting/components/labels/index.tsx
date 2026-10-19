import { useState } from "react";
import { BookmarkIcon, Cross2Icon, Pencil1Icon, PlusIcon } from "@radix-ui/react-icons";
import { Box, Callout, Card, Flex, IconButton, Spinner, Text, TextField } from "@radix-ui/themes";
import { Button } from "@/shared/ui/button/button";
import { useCreateLabel, useDeleteLabel, useLabels, useUpdateLabel } from "../../mutations/use-labels";

export default function LabelsPage() {
  const { data: labels = [], isLoading } = useLabels();
  const create = useCreateLabel();
  const update = useUpdateLabel();
  const remove = useDeleteLabel();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const error = create.error ?? update.error ?? remove.error;

  const submit = async () => {
    if (editing == null) await create.mutateAsync({ name });
    else await update.mutateAsync({ id: editing, name });
    setName(""); setEditing(null);
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
          <Button disabled={!name.trim()} loading={create.isPending || update.isPending} onClick={() => void submit()}>
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
                  <IconButton color="red" variant="soft" aria-label={`حذف ${label.name}`} onClick={() => { if (confirm(`برچسب «${label.name}» حذف شود؟`)) void remove.mutateAsync(label.id); }}><Cross2Icon /></IconButton>
                </Flex>
              </Flex>
            </Card>
          ))}
        </Flex>
      )}
    </Box>
  );
}
