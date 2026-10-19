import { Button } from "@/shared/ui/button/button";
import { TextInput } from "@/shared/ui/form/input/text-input";
import { MagnifyingGlassIcon, TextAlignTopIcon } from "@radix-ui/react-icons";
import {
  Callout,
  Flex,
  Grid,
  Popover,
  RadioGroup,
  Spinner,
  Text,
} from "@radix-ui/themes";
import { useState } from "react";
import { useDeleteProduct, useProducts } from "../hooks/use-products";
import type { ProductSort } from "../types";
import AddButton from "./add-button";
import { ProductCard } from "./product-card";

const SORT_LABELS: Record<ProductSort, string> = {
  newest: "جدیدترین",
  price_desc: "بیشترین قیمت",
  price_asc: "کمترین قیمت",
  name: "نام",
};

const ProductsList = () => {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ProductSort>("newest");

  const { data, isLoading, isError } = useProducts({
    search: search || undefined,
    sort,
  });

  const products = data?.items ?? [];
  const meta = data?.meta;

  const deleteProduct = useDeleteProduct();

  console.log(products);
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
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Flex align={"center"} gapX={"5"}>
          <Popover.Root>
            <Popover.Trigger>
              <Button variant="soft">
                <Flex align={"center"} gapX={"1"}>
                  <TextAlignTopIcon width="20" height="18" />
                  <Text size={"1"}>مرتب سازی: {SORT_LABELS[sort]}</Text>
                </Flex>
              </Button>
            </Popover.Trigger>
            <Popover.Content width="300px">
              <RadioGroup.Root
                size="2"
                value={sort}
                onValueChange={(value) => setSort(value as ProductSort)}
              >
                <Flex
                  direction={"column"}
                  align={"end"}
                  justify="center"
                  gap="4"
                >
                  {(Object.keys(SORT_LABELS) as ProductSort[]).map((key) => (
                    <Flex key={key} align={"center"} justify={"end"} gap={"2"}>
                      <Text size={"2"} weight={"bold"}>
                        {SORT_LABELS[key]}
                      </Text>
                      <RadioGroup.Item value={key} />
                    </Flex>
                  ))}
                </Flex>
              </RadioGroup.Root>
            </Popover.Content>
          </Popover.Root>
        </Flex>
      </Flex>

      {isLoading && (
        <Flex justify="center" align="center" py="9">
          <Spinner size="3" />
        </Flex>
      )}

      {isError && (
        <Callout.Root color="red" dir="rtl" mt="5">
          <Callout.Text>خطا در دریافت محصولات</Callout.Text>
        </Callout.Root>
      )}

      {!isLoading && !isError && products.length === 0 && (
        <Flex justify="center" align="center" py="9">
          <Text color="gray">محصولی یافت نشد</Text>
        </Flex>
      )}

      <Grid columns={{ xs: "1", md: "4" }} gap={"5"} mt={"5"}>
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onDelete={(id) => deleteProduct.mutate(id)}
            deleting={
              deleteProduct.isPending && deleteProduct.variables === product.id
            }
          />
        ))}
      </Grid>

      <AddButton />
    </>
  );
};

export default ProductsList;
