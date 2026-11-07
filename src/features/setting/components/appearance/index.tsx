import {
  getAppearance,
  setAppearance,
  type Appearance,
} from "@/shared/theme/appearance";
import { DesktopIcon, MoonIcon, SunIcon } from "@radix-ui/react-icons";
import { Box, Flex, RadioCards, Text } from "@radix-ui/themes";
import { useState, type ReactNode } from "react";
import { getDisplaySize, setDisplaySize, type DisplaySize } from "@/shared/theme/display-size";

const options: {
  value: Appearance;
  title: string;
  description: string;
  icon: ReactNode;
}[] = [
  {
    value: "system",
    title: "سیستم",
    description: "هماهنگ با تنظیمات دستگاه",
    icon: <DesktopIcon width="20" height="20" />,
  },
  {
    value: "light",
    title: "روشن",
    description: "همیشه از پوسته روشن استفاده کن",
    icon: <SunIcon width="20" height="20" />,
  },
  {
    value: "dark",
    title: "تیره",
    description: "همیشه از پوسته تیره استفاده کن",
    icon: <MoonIcon width="20" height="20" />,
  },
];

export default function AppearanceOptions() {
  const [value, update] = useState<Appearance>(getAppearance);
  const [displaySize, updateDisplaySize] = useState<DisplaySize>(getDisplaySize);
  const choose = (next: string) => {
    const appearance = next as Appearance;
    update(appearance);
    setAppearance(appearance);
  };

  return (
    <Box mt="6">
      <Text size="6" weight="bold">
        ظاهر برنامه
      </Text>
      <RadioCards.Root
        mt="4"
        columns={{ initial: "1", sm: "3" }}
        value={value}
        onValueChange={choose}
      >
        {options.map((option) => (
          <RadioCards.Item key={option.value} value={option.value}>
            <Flex align="center" gap="3">
              <Flex
                align="center"
                justify="center"
                aria-hidden="true"
                className="card-title-icon"
              >
                {option.icon}
              </Flex>
              <Box>
                <Text as="div" weight="bold">
                  {option.title}
                </Text>
                <Text size="2" color="gray">
                  {option.description}
                </Text>
              </Box>
            </Flex>
          </RadioCards.Item>
        ))}
      </RadioCards.Root>
      <Text as="div" size="5" weight="bold" mt="7">اندازه نمایش</Text>
      <Text as="p" size="2" color="gray" mt="1">اندازه نوشته‌ها و فاصله اجزا را بدون تغییر بزرگ‌نمایی مرورگر تنظیم کنید.</Text>
      <RadioCards.Root mt="4" columns={{ initial: "1", sm: "3" }} value={displaySize} onValueChange={(next) => { const size = next as DisplaySize; updateDisplaySize(size); setDisplaySize(size); }}>
        <RadioCards.Item value="compact"><Box><Text as="div" weight="bold">کوچک</Text><Text size="2" color="gray">اطلاعات بیشتر در صفحه</Text></Box></RadioCards.Item>
        <RadioCards.Item value="normal"><Box><Text as="div" weight="bold">معمولی</Text><Text size="2" color="gray">اندازه پیش‌فرض برنامه</Text></Box></RadioCards.Item>
        <RadioCards.Item value="large"><Box><Text as="div" weight="bold">بزرگ</Text><Text size="2" color="gray">خوانایی و فاصله بیشتر</Text></Box></RadioCards.Item>
      </RadioCards.Root>
    </Box>
  );
}
