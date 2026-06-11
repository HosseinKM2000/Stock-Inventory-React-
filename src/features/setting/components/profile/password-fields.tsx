import { Button } from "@/shared/ui/button/button";
import { FormField } from "@/shared/ui/form/field/form-field";
import { Form } from "@/shared/ui/form/form";
import { PasswordInput } from "@/shared/ui/form/input/password-input";
import { Box, Grid, Text } from "@radix-ui/themes";

const PasswordFields = () => {
  return (
    <Form>
      <Box
        mt={"6"}
        mb={{ xs: "9", md: "0" }}
        className="bg-foreground/5 p-5 rounded-2xl mt-5 border-foreground/20 border"
      >
        <Text className="text-xl font-medium">امنیت</Text>
        <Grid gap={"5"} width="auto" mt={"5"} columns={{ xs: "1", md: "3" }}>
          <FormField label="رمز عبور" id="">
            <PasswordInput size={"3"} />
          </FormField>
          <FormField label="تکرار رمز عبور" id="">
            <PasswordInput size={"3"} />
          </FormField>
        </Grid>
        <Grid width={"100%"} mt={"6"}>
          <Button>ویرایش رمز عبور</Button>
        </Grid>
      </Box>
    </Form>
  );
};

export default PasswordFields;
