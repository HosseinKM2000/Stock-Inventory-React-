import { useEffect } from "react";

import { Button } from "@/shared/ui/button/button";
import { Form } from "@/shared/ui/form/form";
import { FormField } from "@/shared/ui/form/field/form-field";
import { TextInput } from "@/shared/ui/form/input/text-input";

import { useAppForm } from "@/shared/lib/form/use-app-form";
import { preventEventHandler } from "@/shared/lib/prevent-event";

import { ApiError } from "@/shared/api/api-error";

import {
  useMe,
  useUpdateProfile,
} from "@/features/auth/mutations/use-register";

import { Box, Callout, Grid, Text } from "@radix-ui/themes";
import {
  profileSchema,
  type ProfileFormValues,
} from "../../validators/profile.schema";

const emptyValues: ProfileFormValues = {
  first_name: "",
  last_name: "",
  username: "",
  email: "",
  phone: "",
};

const PersonalInformationFields = () => {
  const { data: me } = useMe();
  const updateProfile = useUpdateProfile();

  const form = useAppForm({
    schema: profileSchema,
    initialValues: emptyValues,

    onSubmit(values) {
      updateProfile.mutate(values);
    },
  });

  useEffect(() => {
    if (!me) return;

    form.load({
      first_name: me.first_name,
      last_name: me.last_name,
      username: me.username,
      email: me.email ?? "",
      phone: me.phone ?? "",
    });
  }, [me]);

  const errorMessage =
    updateProfile.error instanceof ApiError
      ? updateProfile.error.message
      : null;

  return (
    <Form
      onSubmit={preventEventHandler(form.submit)}
      isSubmitting={updateProfile.isPending}
    >
      <Box
        mt="6"
        className="bg-foreground/5 p-5 rounded-2xl border border-foreground/20"
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

        <Grid columns={{ initial: "1", md: "3" }} gap="5" mt="5" className="w-full min-w-0">
          <FormField label="نام" id="first_name" error={form.errors.first_name}>
            <TextInput
              size="3"
              name="first_name"
              value={form.values.first_name}
              onChange={form.handleChange}
            />
          </FormField>

          <FormField
            label="نام خانوادگی"
            id="last_name"
            error={form.errors.last_name}
          >
            <TextInput
              size="3"
              name="last_name"
              value={form.values.last_name}
              onChange={form.handleChange}
            />
          </FormField>

          <FormField
            label="نام کاربری"
            id="username"
            error={form.errors.username}
          >
            <TextInput
              size="3"
              name="username"
              value={form.values.username}
              onChange={form.handleChange}
            />
          </FormField>

          <FormField label="ایمیل" id="email" error={form.errors.email}>
            <TextInput
              size="3"
              name="email"
              value={form.values.email}
              onChange={form.handleChange}
            />
          </FormField>

          <FormField label="شماره تماس" id="phone" error={form.errors.phone}>
            <TextInput
              size="3"
              name="phone"
              value={form.values.phone}
              onChange={form.handleChange}
            />
          </FormField>
        </Grid>

        <Grid mt="6">
          <Button type="submit" loading={updateProfile.isPending}>
            ویرایش
          </Button>
        </Grid>
      </Box>
    </Form>
  );
};

export default PersonalInformationFields;
