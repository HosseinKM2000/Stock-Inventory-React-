
import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/ui/button/button";
import { FormField } from "@/shared/ui/form/field/form-field";
import { Form } from "@/shared/ui/form/form";
import { TextInput } from "@/shared/ui/form/input/text-input";
import { preventEventHandler } from "@/shared/lib/prevent-event";
import { Box, Callout, Grid, Text } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { useMe, useUpdateProfile } from "@/features/auth/mutations/use-register";

const PersonalInformationFields = () => {
  const { data: me } = useMe();
  const updateProfile = useUpdateProfile();

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    phone: "",
  });

  useEffect(() => {
    if (me) {
      setForm({
        first_name: me.first_name,
        last_name: me.last_name,
        username: me.username,
        email: me.email ?? "",
        phone: me.phone ?? "",
      });
    }
  }, [me]);

  const handleChange = (e: { target: { name: string; value: string } }) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    updateProfile.mutate({
      first_name: form.first_name,
      last_name: form.last_name,
      username: form.username,
      email: form.email || null,
      phone: form.phone || null,
    });
  };

  const errorMessage =
    updateProfile.error instanceof ApiError ? updateProfile.error.message : null;

  return (
    <Form
      onSubmit={preventEventHandler(handleSubmit)}
      isSubmitting={updateProfile.isPending}
    >
      <Box
        mt={"6"}
        className="bg-foreground/5 p-5 rounded-2xl mt-5 border-foreground/20 border"
      >
        <Text className="text-xl font-medium">اطلاعات کاربری</Text>

        {errorMessage && (
          <Callout.Root color="red" dir="rtl" mt="4">
            <Callout.Text>{errorMessage}</Callout.Text>
          </Callout.Root>
        )}
        {updateProfile.isSuccess && (
          <Callout.Root color="green" dir="rtl" mt="4">
            <Callout.Text>اطلاعات با موفقیت ذخیره شد</Callout.Text>
          </Callout.Root>
        )}

        <Grid columns={{ xs: "1", md: "3" }} gap={"5"} width="auto" mt={"5"}>
          <FormField label="نام" id="first_name">
            <TextInput
              size={"3"}
              name="first_name"
              value={form.first_name}
              onChange={handleChange}
            />
          </FormField>
          <FormField label="نام خانوادگی" id="last_name">
            <TextInput
              size={"3"}
              name="last_name"
              value={form.last_name}
              onChange={handleChange}
            />
          </FormField>
          <FormField label="نام کاربری" id="username">
            <TextInput
              size={"3"}
              name="username"
              value={form.username}
              onChange={handleChange}
            />
          </FormField>
          <FormField label="ایمیل" id="email">
            <TextInput
              size={"3"}
              name="email"
              value={form.email}
              onChange={handleChange}
            />
          </FormField>
          <FormField label="شماره تماس" id="phone">
            <TextInput
              size={"3"}
              name="phone"
              value={form.phone}
              onChange={handleChange}
            />
          </FormField>
        </Grid>
        <Grid width={"100%"} mt={"6"}>
          <Button type="submit" loading={updateProfile.isPending}>
            ویرایش
          </Button>
        </Grid>
      </Box>
    </Form>
  );
};

export default PersonalInformationFields;
