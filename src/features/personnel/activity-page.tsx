import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Box, Card, Flex, Select, Text, TextField } from "@radix-ui/themes";
import { personnelApi } from "./api";
import { formatJalaliDateTime } from "@/shared/lib/date/jalali";
import { ActivityLogIcon } from "@radix-ui/react-icons";
import { PageGuide } from "@/features/app/layout/page-guide";

export function ActivityPage() {
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const filters = { actor_user_id: actor ? Number(actor) : undefined, action: action || undefined, date_from: dateFrom || undefined, date_to: dateTo || undefined };
  const query = useQuery({ queryKey: ["store-activity", filters], queryFn: () => personnelApi.activity(filters) });
  const people = useQuery({ queryKey: ["store-personnel"], queryFn: personnelApi.personnel });

  return (
    <Box dir="rtl" className="mx-auto w-full max-w-4xl">
      <PageGuide section="ابزارها" sectionTo="/tools" title="فعالیت مجموعه" description="رویدادهای تأییدشده سرور با هویت پایدار انجام‌دهنده ثبت می‌شوند." icon={ActivityLogIcon} />
      <Card mt="5"><Flex gap="3" wrap="wrap">
        <Select.Root value={actor || "all"} onValueChange={(value) => setActor(value === "all" ? "" : value)}><Select.Trigger placeholder="همه افراد" /><Select.Content><Select.Item value="all">همه افراد</Select.Item>{people.data?.map((person) => <Select.Item key={person.user_id} value={String(person.user_id)}>{person.first_name} {person.last_name}</Select.Item>)}</Select.Content></Select.Root>
        <TextField.Root placeholder="نوع عملیات" value={action} onChange={(event) => setAction(event.target.value)} />
        <TextField.Root type="date" aria-label="از تاریخ" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        <TextField.Root type="date" aria-label="تا تاریخ" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
      </Flex></Card>
      <Flex direction="column" gap="3" mt="6">
        {query.data?.items.map((item) => <Card key={item.id}><Flex justify="between" align="start" gap="3"><Box><Text weight="bold">{item.actor_display_name}</Text><Text as="div" size="2" color="gray">{item.actor_role_name} · {item.action} · {item.target_entity}{item.target_id ? ` #${item.target_id}` : ""}</Text></Box><Box className="text-left"><Badge color={item.outcome === "applied" ? "green" : item.outcome === "conflict" ? "orange" : "red"}>{item.outcome === "applied" ? "اعمال شد" : item.outcome === "conflict" ? "تعارض" : "رد شد"}</Badge><Text as="div" size="1" color="gray" mt="1">{formatJalaliDateTime(item.accepted_at)}</Text></Box></Flex></Card>)}
        {query.data?.items.length === 0 ? <Text color="gray">هنوز فعالیتی با این فیلتر ثبت نشده است.</Text> : null}
      </Flex>
    </Box>
  );
}
