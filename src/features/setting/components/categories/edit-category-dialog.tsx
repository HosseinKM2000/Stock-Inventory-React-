import { Button } from "@/shared/ui/button/button";
import { FormField } from "@/shared/ui/form/field/form-field";
import { TextAreaInput } from "@/shared/ui/form/input/text-area";
import { TextInput } from "@/shared/ui/form/input/text-input";
import { Dialog, Flex } from "@radix-ui/themes";

const EditCategoryDialog = () => {
  return (
    <Dialog.Root>
      <Dialog.Trigger>
        <Button size={"2"} color="amber" variant="surface">
          ویرایش
        </Button>
      </Dialog.Trigger>

      <Dialog.Content maxWidth="450px">
        <Dialog.Title color="amber">ویرایش دسته بندی</Dialog.Title>
        <Dialog.Description size="2" mb="4"></Dialog.Description>

        <Flex direction="column" gap="3">
          <FormField label="عنوان" id="">
            <TextInput size={"3"} />
          </FormField>
          <FormField label="توضیحات" id="">
            <TextAreaInput size={"3"} />
          </FormField>
        </Flex>
        <Flex gap="3" mt="5" justify="end">
          <Dialog.Close>
            <Button variant="soft" color="gray">
              لغو
            </Button>
          </Dialog.Close>
          <Button color="amber" variant="surface">
            ویرایش
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default EditCategoryDialog;
