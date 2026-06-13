import { Box, Text } from "@radix-ui/themes";
import { createFileRoute } from "@tanstack/react-router";
import CategoriesCards from "@/features/setting/components/categories";

export const Route = createFileRoute("/(public)/setting/categories")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <Box>
      <Text className="text-2xl font-bold">
        دسته بندی ها
      </Text>
      <CategoriesCards />
    </Box>
  );
}
