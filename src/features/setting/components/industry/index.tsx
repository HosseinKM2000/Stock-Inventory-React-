import { PlusIcon } from "@radix-ui/react-icons";
import { Box, Callout, Card, Flex, Spinner, Text } from "@radix-ui/themes";
import { Button } from "@/shared/ui/button/button";
import { useIndustries } from "../../mutations/use-industry";
import DeleteIndustryDialog from "./delete-industry-dialog";
import IndustryFormDialog from "./industry-form-dialog";

const Industries = () => {
  const { data: industries = [], isLoading, isError, error } = useIndustries();

  return (
    <Box className="space-y-6">
      <Flex justify="between" align="center">
        <Text size="6" weight="bold">
          حوزه‌های کاری
        </Text>
        <IndustryFormDialog
          mode="create"
          trigger={
            <Button>
              <PlusIcon />
              افزودن حوزه کاری
            </Button>
          }
        />
      </Flex>

      {isError && (
        <Callout.Root color="red">
          <Callout.Text>
            {error instanceof Error
              ? error.message
              : "خطا در دریافت حوزه‌های کاری"}
          </Callout.Text>
        </Callout.Root>
      )}

      {isLoading && (
        <Flex justify="center" align="center" height="300px">
          <Spinner size="3" />
        </Flex>
      )}

      {!isLoading && !isError && industries.length === 0 && (
        <Card>
          <Flex
            direction="column"
            align="center"
            justify="center"
            gap="3"
            py="8"
          >
            <Text size="4" weight="medium">
              هنوز هیچ حوزه کاری ثبت نشده است.
            </Text>

            <Text color="gray" size="2">
              اولین حوزه کاری را ایجاد کنید.
            </Text>
          </Flex>
        </Card>
      )}

      {!isLoading && !isError && industries.length > 0 && (
        <Flex wrap="wrap" gap="4">
          {industries.map((industry) => (
            <Card
              key={industry.id}
              className="w-full md:w-[calc(50%-8px)] xl:w-[calc(33.333%-11px)]"
            >
              <Flex direction="column" justify="between" height="100%" gap="4">
                <Box>
                  <Text as="div" size="4" weight="bold">
                    {industry.name}
                  </Text>

                  <Text mt="3" size="2" color="gray" className="line-clamp-3">
                    {industry.description ?? "بدون توضیحات"}
                  </Text>
                </Box>

                <Flex justify="between" align="center">
                  <Text size="1" color={industry.is_active ? "green" : "red"}>
                    {industry.is_active ? "فعال" : "غیرفعال"}
                  </Text>

                  <Flex gap="2">
                    <IndustryFormDialog
                      mode="edit"
                      industry={industry}
                      trigger={
                        <Button size="2" variant="surface" color="amber">
                          ویرایش
                        </Button>
                      }
                    />

                    <DeleteIndustryDialog industry={industry} />
                  </Flex>
                </Flex>
              </Flex>
            </Card>
          ))}
        </Flex>
      )}
    </Box>
  );
};

export default Industries;
