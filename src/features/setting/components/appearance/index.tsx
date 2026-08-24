import { getAppearance, setAppearance, type Appearance } from "@/shared/theme/appearance";
import { Box, RadioCards, Text } from "@radix-ui/themes";
import { useState } from "react";

const options: { value: Appearance; title: string; description: string }[] = [
  { value: "system", title: "سیستم", description: "هماهنگ با تنظیمات دستگاه" },
  { value: "light", title: "روشن", description: "همیشه از پوسته روشن استفاده کن" },
  { value: "dark", title: "تیره", description: "همیشه از پوسته تیره استفاده کن" },
];

export default function AppearanceOptions() {
  const [value, update] = useState<Appearance>(getAppearance);
  const choose = (next: string) => {
    const appearance = next as Appearance;
    update(appearance);
    setAppearance(appearance);
  };

  return (
    <Box mt="6">
      <Text size="6" weight="bold">ظاهر برنامه</Text>
      <RadioCards.Root mt="4" columns={{ initial: "1", sm: "3" }} value={value} onValueChange={choose}>
        {options.map((option) => (
          <RadioCards.Item key={option.value} value={option.value}>
            <Box><Text as="div" weight="bold">{option.title}</Text><Text size="2" color="gray">{option.description}</Text></Box>
          </RadioCards.Item>
        ))}
      </RadioCards.Root>
    </Box>
  );
}
