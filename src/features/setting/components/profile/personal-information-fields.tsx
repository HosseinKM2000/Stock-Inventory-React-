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
import { DUPLICATE_MOBILE_MESSAGE } from "@/features/auth/mobile";
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
      updateProfile.mutate(values, {
        onError(error) {
          if (error instanceof ApiError && error.message === DUPLICATE_MOBILE_MESSAGE) {
            form.setFieldError("phone", DUPLICATE_MOBILE_MESSAGE);
          }
        },
      });
    },
  });
  const loadForm = form.load;

  useEffect(() => {
    if (!me) return;

    loadForm({
      first_name: me.first_name ?? "",
      last_name: me.last_name ?? "",
      username: me.username,
      email: me.email ?? "",
      phone: me.phone ?? "",
    });
  }, [me, loadForm]);

  const errorMessage =
    updateProfile.error instanceof ApiError && updateProfile.error.message !== DUPLICATE_MOBILE_MESSAGE
      ? updateProfile.error.message
      : null;

  return (
    <Form
      isDirty={form.isDirty}
      onSubmit={preventEventHandler(form.submit)}
      isSubmitting={updateProfile.isPending}
    >
      <Box
        mt="6"
        className="settings-form-panel"
      >
        <Box className="settings-panel-heading">
          <Text as="div" size="5" weight="bold">اطلاعات کاربری</Text>
          <Text as="p" size="2" color="gray">مشخصات پایه‌ای که برای شناسایی حساب شما استفاده می‌شود.</Text>
        </Box>

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

          <FormField label="شماره موبایل" id="phone" error={form.errors.phone}>
            <TextInput
              size="3"
              name="phone"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              value={form.values.phone}
              onChange={form.handleChange}
            />
          </FormField>
        </Grid>

        <Grid mt="6">
          <Button type="submit" loading={updateProfile.isPending}>
            ذخیره اطلاعات
          </Button>
        </Grid>
      </Box>
    </Form>
  );
};

export default PersonalInformationFields;
