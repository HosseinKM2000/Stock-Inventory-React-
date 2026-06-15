import { Button } from "@/shared/ui/button/button";
import { TextInput } from "@/shared/ui/form/input/text-input";
import {
  MagnifyingGlassIcon,
  TextAlignTopIcon,
  TrashIcon,
} from "@radix-ui/react-icons";
import {
  Badge,
  Card,
  Checkbox,
  Flex,
  Grid,
  Inset,
  Popover,
  RadioGroup,
  Text,
} from "@radix-ui/themes";
import AddButton from "./add-button";

const ProductList = () => {
  return (
    <>
      <Flex
        gapX={"3"}
        gapY={"4"}
        wrap={"wrap"}
        width={"100%"}
        align={"center"}
        justify={"start"}
      >
        <TextInput
          className="w-full md:w-88"
          rightSlot={
            <Button variant="ghost" ml={"1"}>
              <MagnifyingGlassIcon width={"20"} height={"20"} />
            </Button>
          }
          size={"3"}
          placeholder="جستجو..."
        />
        <Flex align={"center"} gapX={"5"}>
          <Popover.Root>
            <Popover.Trigger>
              <Button variant="soft">
                <Flex align={"center"} gapX={"1"}>
                  <TextAlignTopIcon width="20" height="18" />
                  <Text size={"1"}> مرتب سازی براساس</Text>
                </Flex>
              </Button>
            </Popover.Trigger>
            <Popover.Content width="300px">
              <RadioGroup.Root size="2" defaultValue="1">
                <Flex
                  direction={"column"}
                  align={"end"}
                  justify="center"
                  gap="4"
                >
                  <Flex align={"center"} justify={"end"} gap={"2"}>
                    <Text size={"2"} weight={"bold"}>
                      بیشترین قیمت
                    </Text>
                    <RadioGroup.Item value="1" />
                  </Flex>
                  <Flex align={"center"} justify={"end"} gap={"2"}>
                    <Text size={"2"} weight={"bold"}>
                      کمترین قیمت
                    </Text>
                    <RadioGroup.Item value="2" />
                  </Flex>
                </Flex>
              </RadioGroup.Root>
            </Popover.Content>
          </Popover.Root>
          <Button
            type="button"
            variant="outline"
            className="text-rose-400! hover:text-rose-50! border-red-900! border!"
          >
            <TrashIcon width={"30"} height={"30"} />
          </Button>
        </Flex>
      </Flex>
      <Grid columns={{ xs: "1", md: "4" }} gap={"5"} mt={"5"}>
        <Grid>
          <Card size="1">
            <Inset clip="padding-box" side="top" pb="current">
              <img
                src="https://images.unsplash.com/photo-1617050318658-a9a3175e34cb?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=600&q=80"
                alt="Bold typography"
                style={{
                  height: 140,
                  width: "100%",
                  display: "block",
                  objectFit: "cover",
                  backgroundColor: "var(--gray-5)",
                }}
              />
            </Inset>
            <Flex
              align={"center"}
              justify={"between"}
              className="w-full text-left flex-wrap"
            >
              <Checkbox size="3" />
              <Badge color="green">موجود</Badge>
            </Flex>
            <Flex direction={"column"} gap="1" mt={"3"} align="start">
              <Text as="div" size="2" weight="bold">
                محصول شماره یک
              </Text>
              <Text as="div" size="2" color="gray" className="line-clamp-1">
                Lorem ipsum dolor sit amet consectetur adipisicing elit. Sint
                repellendus dolorem veniam voluptate accusantium consequuntur
                perferendis praesentium eius dolor, beatae quo odio corrupti
                voluptates? Modi deserunt dolore deleniti nisi natus.
              </Text>
            </Flex>
            <Flex mt={"5"} justify={"between"}>
              <Badge variant="solid" radius="full" color="indigo">
                100,000,000 تومان
              </Badge>
              <Flex gapX={"2"}>
                <Badge color="gray" variant="surface">
                  New
                </Badge>
                <Badge color="gray" variant="solid">
                  100000
                </Badge>
              </Flex>
            </Flex>
          </Card>
        </Grid>
      </Grid>
      <AddButton />
    </>
  );
};

export default ProductList;
