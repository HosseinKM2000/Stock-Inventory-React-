import { Form } from "@/shared/ui/form/form";
import { BellIcon } from "@radix-ui/react-icons";
import { Button } from "@/shared/ui/button/button";
import { createFileRoute } from "@tanstack/react-router";
import { FormField } from "@/shared/ui/form/field/form-field";
import { TextInput } from "@/shared/ui/form/input/text-input";
import { TextAreaInput } from "@/shared/ui/form/input/text-area";
import { SelectInput } from "@/shared/ui/form/input/select-input";
import { Box, Card, Flex, Grid, Switch, Text } from "@radix-ui/themes";
import { ProductImageUpload } from "@/features/app/products/components/upload-file";

export const Route = createFileRoute("/(app)/product/add")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <Form>
      <Box
        mt={"6"}
        mb={"9"}
        className="bg-foreground/5 p-5 rounded-2xl mt-5 border-foreground/20 border"
      >
        <Text className="text-xl font-medium">افزودن محصول جدید</Text>
        <Grid columns={{ xs: "1", md: "3" }} gap={"5"} width="auto" mt={"5"}>
          <Box className="md:col-span-3">
            <ProductImageUpload />
          </Box>
          <FormField label="نام محصول" id="">
            <TextInput size={"3"} />
          </FormField>
          <FormField label="دسته بندی" id="">
            <SelectInput
              size={"3"}
              placeholder="دسته بندی محصول"
              options={[
                { value: "b", label: "B" },
                { value: "a", label: "A" },
              ]}
            />
          </FormField>
          <FormField label="واحد" id="">
            <SelectInput
              size={"3"}
              placeholder="دسته بندی محصول"
              options={[
                { value: "b", label: "B" },
                { value: "a", label: "A" },
              ]}
            />
          </FormField>
          <FormField label="تعداد اولیه" id="">
            <TextInput size={"3"} type="number" />
          </FormField>
          <FormField label="قیمت (تومان)" id="">
            <TextInput size={"3"} type="number" />
          </FormField>
          <FormField label="وضعیت موجودی" id="">
            <SelectInput
              size={"3"}
              placeholder=""
              value="a"
              options={[
                { value: "b", label: "B" },
                { value: "a", label: "A" },
              ]}
            />
          </FormField>
          <Box className="md:col-span-3">
            <FormField id="" label="توضیحات">
              <TextAreaInput size="3" />
            </FormField>
          </Box>
          <Card
            size="3"
            className="
        w-full
        rounded-3xl
        border
        md:col-span-3
        border-violet-1
        bg-violet-1/40
      "
          >
            <Flex
              gap="3"
              wrap={"wrap"}
              width={"100%"}
              align={"center"}
              justify={"between"}
            >
              {/* Header */}
              <Flex justify="between" wrap={"wrap"} align="start" gap="4">
                <Switch size="3" onCheckedChange={() => {}} />
                <Flex align="start" gap="3" wrap={"wrap"}>
                  <Box className="mt-1 text-amber-600">
                    <BellIcon width={28} height={28} />
                  </Box>

                  <Box>
                    <Text as="div" size="3" weight="bold">
                      هشدار کم موجودی
                    </Text>

                    <Text as="div" size="2" color="gray" className="mt-1">
                      هنگام رسیدن موجودی به حد نصاب اطلاع‌رسانی شود.
                    </Text>
                  </Box>
                </Flex>
              </Flex>

              {/* Threshold */}
              <Box className="w-full md:w-45">
                <FormField id="threshold" label="حد نصاب هشدار">
                  <TextInput size="3" type="number" />
                </FormField>
              </Box>
            </Flex>
          </Card>
        </Grid>
        <Grid width={"100%"} mt={"6"}>
          <Button>افزودن</Button>
        </Grid>
      </Box>
    </Form>
  );
}
