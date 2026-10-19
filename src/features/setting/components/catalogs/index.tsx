import { useDeferredValue, useMemo, useState } from "react";

import { resolveAssetUrl } from "@/shared/api/client";
import { Button } from "@/shared/ui/button/button";
import { SelectInput } from "@/shared/ui/form/input/select-input";
import { TextInput } from "@/shared/ui/form/input/text-input";
import {
  CalendarIcon,
  CubeIcon,
  EyeOpenIcon,
  MagnifyingGlassIcon,
  Pencil1Icon,
  PlusIcon,
} from "@radix-ui/react-icons";
import { Badge, Box, Callout, Card, Flex, Spinner, Text } from "@radix-ui/themes";

import {
  useArchivedCatalogProducts,
  useCatalogProducts,
} from "../../mutations/use-catalog";
import { useIndustries } from "../../mutations/use-industry";
import ArchiveCatalogDialog from "./archive-catalog-dialog";
import CatalogDetailsDialog from "./catalog-details-dialog";
import CatalogFormDialog from "./catalog-form-dialog";
import DeleteCatalogDialog from "./delete-catalog-dialog";
import RestoreCatalogDialog from "./restore-catalog-dialog";

const dateFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" });

const Catalogs = () => {
  const [industryId, setIndustryId] = useState<number | undefined>();
  const [search, setSearch] = useState("");
  const [catalogState, setCatalogState] = useState<"active" | "archived">("active");
  const deferredSearch = useDeferredValue(search.trim());

  const listParams = {
    search: deferredSearch || undefined,
    industry_id: industryId,
  };
  const activeCatalogs = useCatalogProducts(listParams, catalogState === "active");
  const archivedCatalogs = useArchivedCatalogProducts(
    listParams,
    catalogState === "archived",
  );
  const catalogQuery = catalogState === "active" ? activeCatalogs : archivedCatalogs;
  const catalogs = catalogQuery.data ?? [];
  const catalogLoading = catalogQuery.isLoading;
  const isFetching = catalogQuery.isFetching;
  const catalogError = catalogQuery.isError;
  const catalogErrorMessage = catalogQuery.error;

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
  const industryNames = useMemo(
    () => new Map(industries.map((industry) => [industry.id, industry.name])),
    [industries],
  );
  const isFiltered = Boolean(deferredSearch || industryId);

  return (
    <Box className="space-y-6">
      <Flex justify="between" align="center" gap="3" wrap="wrap">
        <Box>
          <Text as="div" size="6" weight="bold">کاتالوگ محصولات</Text>
          <Text as="div" size="2" color="gray" mt="1">مدیریت محصولات مشترک حوزه‌های کاری</Text>
        </Box>

        <CatalogFormDialog
          mode="create"
          trigger={<Button><PlusIcon />افزودن محصول</Button>}
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

      <Flex gap="3" direction={{ initial: "column", sm: "row" }}>
        <Box className="w-full sm:max-w-52">
          <SelectInput
            aria-label="وضعیت محصولات کاتالوگ"
            options={[
              { label: "محصولات فعال", value: "active" },
              { label: "محصولات بایگانی‌شده", value: "archived" },
            ]}
            value={catalogState}
            onValueChange={(value) =>
              setCatalogState(value as "active" | "archived")
            }
          />
        </Box>
        <Box className="w-full sm:max-w-md">
          <TextInput
            aria-label="جستجوی محصولات کاتالوگ"
            placeholder="جستجو در نام، برند یا توضیحات..."
            rightSlot={<MagnifyingGlassIcon />}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </Box>
        <Box className="w-full sm:max-w-64">
          <SelectInput
            disabled={industriesLoading}
            aria-label="فیلتر حوزه کاری"
            placeholder="فیلتر حوزه کاری"
            options={[{ label: "همه حوزه‌ها", value: "all" }, ...industryOptions]}
            value={industryId ? String(industryId) : "all"}
            onValueChange={(value) => setIndustryId(value === "all" ? undefined : Number(value))}
          />
        </Box>
        {isFetching && !catalogLoading && (
          <Flex align="center" gap="2">
            <Spinner size="1" />
            <Text size="1" color="gray">در حال به‌روزرسانی</Text>
          </Flex>
        )}
      </Flex>

      {catalogLoading && (
        <Flex justify="center" align="center" height="300px"><Spinner size="3" /></Flex>
      )}

      {!catalogLoading && !catalogError && catalogs.length === 0 && (
        <Card>
          <Flex direction="column" align="center" justify="center" gap="3" py="8">
            <Box className="card-empty-icon" aria-hidden="true"><CubeIcon width="26" height="26" /></Box>
            <Text size="4" weight="medium">
              {isFiltered
                ? "محصولی مطابق جستجو پیدا نشد."
                : catalogState === "archived"
                  ? "محصول بایگانی‌شده‌ای وجود ندارد."
                  : "محصولی در کاتالوگ وجود ندارد."}
            </Text>
            <Text color="gray" size="2">
              {isFiltered ? "عبارت جستجو یا فیلتر حوزه کاری را تغییر دهید." : "اولین محصول کاتالوگ را ایجاد کنید."}
            </Text>
          </Flex>
        </Card>
      )}

      {!catalogLoading && !catalogError && catalogs.length > 0 && (
        <Box className="grid! grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-3">
          {catalogs.map((product) => {
            const imageUrl = resolveAssetUrl(product.image_url);
            const industryName = product.industry?.name ?? industryNames.get(product.industry_id) ?? "حوزه نامشخص";

            return (
              <Card key={product.id} className="min-w-0 overflow-hidden p-0!">
                <Box className="aspect-[16/7] bg-[var(--gray-a3)] lg:aspect-[16/6]">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={product.name}
                      className="h-full w-full object-cover"
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <Flex height="100%" align="center" justify="center"><CubeIcon width="30" height="30" /></Flex>
                  )}
                </Box>

                <Flex direction="column" justify="between" gap={{ initial: "4", lg: "3" }} className="min-h-56 p-4 lg:min-h-44 lg:p-3">
                  <Box className="min-w-0">
                    <Flex justify="between" align="start" gap="2">
                      <Text as="div" size="4" weight="bold" className="min-w-0 break-words">{product.name}</Text>
                      <Flex gap="1" wrap="wrap" justify="end">
                        {!product.is_active && <Badge color="amber" variant="soft">بایگانی‌شده</Badge>}
                        <Badge color="violet" variant="soft" className="shrink-0">{industryName}</Badge>
                      </Flex>
                    </Flex>
                    <Text as="div" mt="2" size="2" color="gray" className="line-clamp-3 whitespace-pre-wrap lg:line-clamp-2">
                      {product.description || "بدون توضیحات"}
                    </Text>
                    {product.brand && <Text as="div" mt="2" size="2">برند: {product.brand}</Text>}
                    <Flex align="center" gap="1" mt={{ initial: "3", lg: "2" }}>
                      <CalendarIcon />
                      <Text size="1" color="gray">{dateFormatter.format(new Date(product.created_at))}</Text>
                    </Flex>
                  </Box>

                  <Flex justify="end" gap="2" wrap="wrap">
                    {product.is_active && (
                      <CatalogDetailsDialog
                        catalogId={product.id}
                        fallbackIndustryName={industryName}
                        trigger={<Button size={{ initial: "2", lg: "1" }} variant="soft"><EyeOpenIcon />مشاهده</Button>}
                      />
                    )}
                    <CatalogFormDialog
                      mode="edit"
                      catalogProduct={product}
                      trigger={<Button size={{ initial: "2", lg: "1" }} color="amber" variant="soft"><Pencil1Icon />ویرایش</Button>}
                    />
                    {product.is_active ? (
                      <ArchiveCatalogDialog catalog={product} />
                    ) : (
                      <RestoreCatalogDialog catalog={product} />
                    )}
                    <DeleteCatalogDialog catalog={product} />
                  </Flex>
                </Flex>
              </Card>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

export default Catalogs;
