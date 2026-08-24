import { getAppearance, setAppearance, type Appearance } from "@/shared/theme/appearance";
import { Avatar, Box, Grid, RadioCards, Separator, Text } from "@radix-ui/themes";
import { useState } from "react";
import { avatarRegistry } from "@/shared/avatar/avatar-registry";
import { useAvatarPreference } from "@/shared/avatar/use-avatar-preference";

const options: { value: Appearance; title: string; description: string }[] = [
  { value: "system", title: "سیستم", description: "هماهنگ با تنظیمات دستگاه" },
  { value: "light", title: "روشن", description: "همیشه از پوسته روشن استفاده کن" },
  { value: "dark", title: "تیره", description: "همیشه از پوسته تیره استفاده کن" },
];

export default function AppearanceOptions() {
  const [value, update] = useState<Appearance>(getAppearance);
  const avatarPreference = useAvatarPreference();
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

      <Separator size="4" my="6" />
      <Text size="5" weight="bold">تصویر پروفایل</Text>
      <Text as="div" size="2" color="gray" mt="1">تصویر انتخاب‌شده سبک، کاملاً آفلاین و فقط روی همین دستگاه ذخیره می‌شود.</Text>
      <Grid columns={{ initial: "2", xs: "3", sm: "6" }} gap="3" mt="4">
        {avatarRegistry.map((avatar) => (
          <button
            key={avatar.id}
            type="button"
            aria-pressed={avatarPreference.id === avatar.id}
            aria-label={`انتخاب ${avatar.label}`}
            onClick={() => avatarPreference.select(avatar.id)}
            className={`min-w-0 rounded-xl border p-3 text-center transition-colors focus-visible:outline-2 focus-visible:outline-violet-500 ${avatarPreference.id === avatar.id ? "border-violet-500 bg-violet-500/10" : "border-foreground/10 hover:bg-foreground/5"}`}
          >
            <Avatar size="4" radius="full" src={avatar.src ?? undefined} fallback="من" className="mx-auto" />
            <Text as="div" size="1" mt="2" className="truncate">{avatar.label}</Text>
          </button>
        ))}
      </Grid>
    </Box>
  );
}
