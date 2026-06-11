import { Form } from "@/shared/ui/form/form";
import { Box, Grid, Text } from "@radix-ui/themes";
import { FormField } from "@/shared/ui/form/field/form-field";
import { TextInput } from "@/shared/ui/form/input/text-input";
import { Button } from "@/shared/ui/button/button";

const PersonalInformationFields = () => {
  return (
    <Form>
      <Box
        mt={"6"}
        className="bg-foreground/5 p-5 rounded-2xl mt-5 border-foreground/20 border"
      >
        <Text className="text-xl font-medium">اطلاعات کاربری</Text>
        <Grid columns={{ xs: "1", md: "3" }} gap={"5"} width="auto" mt={"5"}>
          <FormField label="نام" id="">
            <TextInput size={"3"} />
          </FormField>
          <FormField label="نام خانوادگی" id="">
            <TextInput size={"3"} />
          </FormField>
          <FormField label="نام کاربری" id="">
            <TextInput size={"3"} />
          </FormField>
          <FormField label="ایمیل" id="">
            <TextInput size={"3"} />
          </FormField>
          <FormField label="شماره تماس" id="">
            <TextInput size={"3"} />
          </FormField>
        </Grid>
        <Grid width={"100%"} mt={"6"}>
          <Button>ویرایش</Button>
        </Grid>
      </Box>
    </Form>
  );
};

export default PersonalInformationFields;
