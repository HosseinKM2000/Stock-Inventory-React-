import { useState } from "react";
import AddButton from "./add-button";
import FilterPanel from "./filter-panel";
import type { ProductSort } from "../types";
import { ProductCard } from "./inventory-card";
import { Box, Callout, Flex, Spinner, Text } from "@radix-ui/themes";
import { useInventoryVirtual } from "../mutations/useInventoryVirtual";
import { useDeleteProduct, useProducts } from "../mutations/use-products";

const InventoryList = () => {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ProductSort>("newest");

  const { data, isLoading, isError } = useProducts({
    search: search || undefined,
    sort,
  });

  const products = data ?? [];

  const { parentRef, virtualizer } = useInventoryVirtual(products.length);

  const deleteProduct = useDeleteProduct();

  return (
    <Flex
      direction="column"
      className="
        h-[calc(100dvh-64px)] lg:h-[calc(100dvh-80px)]
        overflow-hidden
        p-4
        gap-4
      "
    >
      {/* FILTERS MOBILE + TABLET */}

      <Box
        className="
          lg:hidden!
          w-full
        "
      >
        <FilterPanel
          search={search}
          setSearch={setSearch}
          sort={sort}
          setSort={setSort}
        />
      </Box>

      <Flex
        className="
          flex-1
          overflow-hidden
          gap-5
        "
      >
        {/* DESKTOP FILTER */}

        <Box
          className="
            hidden!
            lg:block!
            w-80
            shrink-0
          "
        >
          <div
            className="
              sticky
              top-5
            "
          >
            <FilterPanel
              search={search}
              setSearch={setSearch}
              sort={sort}
              setSort={setSort}
            />
          </div>
        </Box>
        {/* PRODUCTS */}

        <Box
          className="
            flex-1
            min-w-0
          "
        >
          {isLoading && (
            <Flex justify="center" align="center" className="h-full">
              <Spinner />
            </Flex>
          )}

          {isError && (
            <Callout.Root color="red">
              <Callout.Text>خطا در دریافت محصولات</Callout.Text>
            </Callout.Root>
          )}

          {!isLoading && !isError && products.length === 0 && (
            <Flex justify="center" align="center" className="h-full">
              <Text color="gray">محصولی یافت نشد</Text>
            </Flex>
          )}

          {products.length > 0 && (
            <div
              ref={parentRef}
              className="
                h-full
                overflow-y-auto
                scrollbar-thin
              "
            >
              <div
                style={{
                  height: virtualizer.getTotalSize(),
                  position: "relative",
                }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const product = products[virtualRow.index];

                  return (
                    <div
                      key={product.id}
                      data-index={virtualRow.index}
                      ref={virtualizer.measureElement}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <div
                        className="
                            pb-4
                          "
                      >
                        <ProductCard
                          product={product}
                          onDelete={(id) => deleteProduct.mutate(id)}
                          deleting={
                            deleteProduct.isPending &&
                            deleteProduct.variables === product.id
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Box>
      </Flex>

      <AddButton />
    </Flex>
  );
};

export default InventoryList;
