import { Button } from "@/shared/ui/button/button";
import { TrashIcon } from "@radix-ui/react-icons";
import { Dialog, Flex } from "@radix-ui/themes";

const DeleteCategoryDialog = () => {
  return (
    <Dialog.Root>
      <Dialog.Trigger>
        <Button size={"2"} color="red">
          <TrashIcon width={"20"} height={"20"}/>
        </Button>
      </Dialog.Trigger>
      <Dialog.Content maxWidth="450px">
        <Dialog.Title color="red">حذف دسته بندی</Dialog.Title>
        <Dialog.Description size="2" mb="4">
          آیا از حذف این دسته بندی اطمینان دارید؟
        </Dialog.Description>
        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close>
            <Button variant="soft" color="gray">
              لغو
            </Button>
          </Dialog.Close>
          <Button color="red">حذف</Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default DeleteCategoryDialog;
