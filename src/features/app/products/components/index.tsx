import {
  Card,
  Flex,
  Grid,
  Text,
  Badge,
  Avatar,
  Popover,
  RadioGroup,
} from "@radix-ui/themes";
import AddButton from "./add-button";
import { Button } from "@/shared/ui/button/button";
import { TextInput } from "@/shared/ui/form/input/text-input";
import {
  MagnifyingGlassIcon,
  TextAlignTopIcon,
  TrashIcon,
} from "@radix-ui/react-icons";
import { Link } from "@tanstack/react-router";

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
      <Link to="/">
        <Grid columns={{ xs: "1", md: "4" }} gap={"5"} mt={"5"}>
          <Grid>
            <Card size="1">
              <Flex
                align={"center"}
                justify={"between"}
                className="w-full text-left"
              >
                <Avatar size="3" radius="full" fallback="T" color="indigo" />
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
      </Link>
      <AddButton />
    </>
  );
};

export default ProductList;
