import { useState } from "react";

import { Button } from "@/shared/ui/button/button";
import { SelectInput } from "@/shared/ui/form/input/select-input";

import { Box, Callout, Card, Flex, Spinner, Text } from "@radix-ui/themes";

import { CubeIcon, PlusIcon } from "@radix-ui/react-icons";

import { useCatalogProducts } from "../../mutations/use-catalog";

import { useIndustries } from "../../mutations/use-industry";

import CatalogFormDialog from "./catalog-form-dialog";
import DeleteCatalogDialog from "./delete-catalog-dialog";

const Catalogs = () => {
  const [industryId, setIndustryId] = useState<number | undefined>();

  const {
    data: catalogs = [],
    isLoading: catalogLoading,
    isError: catalogError,
    error: catalogErrorMessage,
  } = useCatalogProducts({
    industry_id: industryId,
  });

  const {
    data: industries = [],
    isLoading: industriesLoading,
    isError: industriesError,
    error: industriesErrorMessage,
  } = useIndustries();

  const industryOptions = industries.map((industry) => ({
    label: industry.name,
    value: String(industry.id),
  }));

  return (
    <Box className="space-y-6">
      <Flex justify="between" align="center" gap="3" wrap="wrap">
        <Text size="6" weight="bold">
          کاتالوگ محصولات
        </Text>

        <CatalogFormDialog
          mode="create"
          trigger={
            <Button>
              <PlusIcon />
              افزودن محصول
            </Button>
          }
        />
      </Flex>

      {(catalogError || industriesError) && (
        <Callout.Root color="red">
          <Callout.Text>
            {catalogErrorMessage instanceof Error
              ? catalogErrorMessage.message
              : industriesErrorMessage instanceof Error
                ? industriesErrorMessage.message
                : "خطا در دریافت اطلاعات"}
          </Callout.Text>
        </Callout.Root>
      )}

      <Flex className="w-full max-w-64">
        <SelectInput
          disabled={industriesLoading}
          placeholder="فیلتر حوزه کاری"
          options={[
            {
              label: "همه حوزه‌ها",
              value: "all",
            },
            ...industryOptions,
          ]}
          value={industryId ? String(industryId) : "all"}
          onValueChange={(value) => {
            setIndustryId(value === "all" ? undefined : Number(value));
          }}
        />
      </Flex>

      {catalogLoading && (
        <Flex justify="center" align="center" height="300px">
          <Spinner size="3" />
        </Flex>
      )}

      {!catalogLoading && !catalogError && catalogs.length === 0 && (
        <Card>
          <Flex
            direction="column"
            align="center"
            justify="center"
            gap="3"
            py="8"
          >
            <Box className="card-empty-icon" aria-hidden="true">
              <CubeIcon width="26" height="26" />
            </Box>

            <Text size="4" weight="medium">
              محصولی در کاتالوگ وجود ندارد.
            </Text>

            <Text color="gray" size="2">
              اولین محصول کاتالوگ را ایجاد کنید.
            </Text>
          </Flex>
        </Card>
      )}

      {!catalogLoading && !catalogError && catalogs.length > 0 && (
        <Flex wrap="wrap" gap="4">
          {catalogs.map((product) => (
            <Card
              key={product.id}
              className="w-full md:w-[calc(50%-8px)] xl:w-[calc(33.333%-11px)]"
            >
              <Flex direction="column" justify="between" height="100%" gap="4">
                <Box>
                  <Flex align="center" gap="3">
                    <Flex
                      align="center"
                      justify="center"
                      aria-hidden="true"
                      className="card-title-icon"
                    >
                      <CubeIcon width="20" height="20" />
                    </Flex>
                    <Text as="div" size="4" weight="bold">
                      {product.name}
                    </Text>
                  </Flex>

                  <Text mt="2" size="2" color="gray">
                    {product.description ?? "بدون توضیحات"}
                  </Text>

                  {product.brand && (
                    <Text mt="2" size="2">
                      برند: {product.brand}
                    </Text>
                  )}
                </Box>

                <Flex justify="end" gap="2">
                  <CatalogFormDialog
                    mode="edit"
                    catalogProduct={product}
                    trigger={
                      <Button size="2" color="amber">
                        ویرایش
                      </Button>
                    }
                  />

                  <DeleteCatalogDialog catalog={product} />
                </Flex>
              </Flex>
            </Card>
          ))}
        </Flex>
      )}
    </Box>
  );
};

export default Catalogs;
