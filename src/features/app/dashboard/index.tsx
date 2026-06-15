import {
  Cross1Icon,
  ExclamationTriangleIcon,
  IdCardIcon,
  MixIcon,
} from "@radix-ui/react-icons";
import { Avatar, Badge, Box, Card, Flex, Grid, Text } from "@radix-ui/themes";

const DashboardComponents = () => {
  return (
    <main className="container mx-auto">
      <Flex direction={"column"} gapY={"2"}>
        <Text size={"7"} weight={"bold"}>
          داشبورد
        </Text>
        <Text size={"3"} weight={"light"}>
          نمایش وضعیت لحظه ای موجودی اقلام شما.
        </Text>
      </Flex>
      <Grid columns={{ xs: "1", md: "4" }} gap={"5"} mt={"5"}>
        <Grid>
          <Card size="2">
            <Flex gap="3" align="start" justify={"between"}>
              <Avatar
                size="3"
                radius="full"
                fallback={<MixIcon />}
                color="indigo"
              />
            </Flex>
            <Box mt={"3"}>
              <Text as="div" size="2" color="gray">
                مجموع کالاها
              </Text>
              <Text as="div" size="2" weight="bold" mt={"1"}>
                2,500,000
              </Text>
            </Box>
          </Card>
        </Grid>
        <Grid>
          <Card size="2">
            <Flex gap="3" align="start" justify={"between"}>
              <Avatar
                size="3"
                radius="full"
                fallback={<ExclamationTriangleIcon />}
                color="yellow"
              />
              <Badge color="yellow">نیاز به اقدام</Badge>
            </Flex>
            <Box mt={"3"}>
              <Text as="div" size="2" color="gray">
                کمبود موجودی
              </Text>
              <Text as="div" size="2" weight="bold" mt={"1"}>
                15
              </Text>
            </Box>
          </Card>
        </Grid>
        <Grid>
          <Card size="2">
            <Flex gap="3" align="start" justify={"between"}>
              <Avatar
                size="3"
                radius="full"
                fallback={<Cross1Icon />}
                color="red"
              />
              <Badge color="red">فوری</Badge>
            </Flex>
            <Box mt={"3"}>
              <Text as="div" size="2" color="gray">
                عدم موجودی
              </Text>
              <Text as="div" size="2" weight="bold" mt={"1"}>
                3
              </Text>
            </Box>
          </Card>
        </Grid>
        <Grid>
          <Card size="2">
            <Flex gap="3" align="start" justify={"between"}>
              <Avatar
                size="3"
                radius="full"
                fallback={<IdCardIcon />}
                color="green"
              />
              <Badge color="green">Complete</Badge>
            </Flex>
            <Box mt={"3"}>
              <Text as="div" size="2" color="gray">
                ارزش موجودی
              </Text>
              <Text as="div" size="2" weight="bold" mt={"1"}>
                200,000,000 تومان
              </Text>
            </Box>
          </Card>
        </Grid>
      </Grid>
    </main>
  );
};

export default DashboardComponents;
