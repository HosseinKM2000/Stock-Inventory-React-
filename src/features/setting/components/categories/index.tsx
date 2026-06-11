import { Box, Card, Flex, Text } from "@radix-ui/themes";
import DeleteCategoryDialog from "./delete-category-dialog";
import EditCategoryDialog from "./edit-category-dialog";

const CategoriesCards = () => {
  return (
    <Flex mt={"6"} wrap={"wrap"} gap={"5"}>
      <Card className="w-full md:w-[33%] h-32 flex! flex-col justify-between">
        <Box>
          <Text as="div" size="2" weight="bold">
            دسته بندی جدید
          </Text>
          <Text as="div" mt={"1"} color="gray" size="2" className="line-clamp-1">
            Lorem ipsum dolor sit amet consectetur, adipisicing elit. Nemo ex
            nihil minus vero enim! Dolorem saepe impedit consequuntur, eligendi
            earum corrupti, necessitatibus quo recusandae, atque nemo optio odio
            veniam vitae.
          </Text>
        </Box>
        <Flex mt={"3"} align={"center"} gapX={"3"} justify={"end"}>
          <EditCategoryDialog />
          <DeleteCategoryDialog />
        </Flex>
      </Card>
    </Flex>
  );
};

export default CategoriesCards;
