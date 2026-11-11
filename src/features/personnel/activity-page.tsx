import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Box, Card, Flex, Select, Text } from "@radix-ui/themes";
import { personnelApi } from "./api";
import { formatJalaliDateTime } from "@/shared/lib/date/jalali";
import { ActivityLogIcon } from "@radix-ui/react-icons";
import { PageGuide } from "@/features/app/layout/page-guide";
import { JalaliDateField } from "@/shared/ui/date/jalali-date-field";
import { parseJalaliDate, tehranDateRange } from "@/shared/lib/date/jalali";
import { presentActivity } from "./activity-presentation";

export function ActivityPage() {
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const parsedFrom = dateFrom ? parseJalaliDate(dateFrom) : null;
  const parsedTo = dateTo ? parseJalaliDate(dateTo) : null;
  const validDates = (!dateFrom || parsedFrom !== null) && (!dateTo || parsedTo !== null);
  const validOrder = !parsedFrom || !parsedTo || parsedFrom <= parsedTo;
  const validRange = validDates && validOrder;
  const range = tehranDateRange(dateFrom || null, dateTo || null);
  const filters = { actor_user_id: actor ? Number(actor) : undefined, action: action || undefined, date_from: validRange ? range.start : undefined, date_to: validRange ? range.end : undefined };
  const query = useQuery({ queryKey: ["store-activity", filters], queryFn: () => personnelApi.activity(filters), enabled: validRange });
  const people = useQuery({ queryKey: ["store-personnel"], queryFn: personnelApi.personnel });

  return (
    <Box dir="rtl" className="mx-auto w-full max-w-4xl">
      <PageGuide section="ابزارها" sectionTo="/tools" title="فعالیت مجموعه" description="ببینید چه کسی، چه کار تجاری را، چه زمانی انجام داده و نتیجه چه بوده است." icon={ActivityLogIcon} helpTopic="activity" />
      <Card mt="5"><Flex gap="3" wrap="wrap" align="end">
        <Select.Root value={actor || "all"} onValueChange={(value) => setActor(value === "all" ? "" : value)}><Select.Trigger placeholder="همه افراد" /><Select.Content><Select.Item value="all">همه افراد</Select.Item>{people.data?.map((person) => <Select.Item key={person.user_id} value={String(person.user_id)}>{person.first_name} {person.last_name}</Select.Item>)}</Select.Content></Select.Root>
        <Select.Root value={action || "all"} onValueChange={(value) => setAction(value === "all" ? "" : value)}><Select.Trigger aria-label="نوع فعالیت" placeholder="همه فعالیت‌ها" /><Select.Content><Select.Item value="all">همه فعالیت‌ها</Select.Item><Select.Item value="sync.create">ایجاد اطلاعات</Select.Item><Select.Item value="sync.update">ویرایش اطلاعات</Select.Item><Select.Item value="sync.delete">حذف اطلاعات</Select.Item><Select.Item value="invoice.posted">ثبت فاکتور</Select.Item><Select.Item value="invoice.cancelled">لغو فاکتور</Select.Item><Select.Item value="personnel.created">افزودن عضو</Select.Item><Select.Item value="personnel.updated">تغییر دسترسی عضو</Select.Item></Select.Content></Select.Root>
        <JalaliDateField id="activity-date-from" label="از تاریخ جلالی" value={dateFrom} onChange={setDateFrom} />
        <JalaliDateField id="activity-date-to" label="تا تاریخ جلالی" value={dateTo} onChange={setDateTo} />
      </Flex></Card>
      {!validOrder ? <Text as="p" color="red" size="2" mt="2" role="alert">تاریخ شروع باید پیش از تاریخ پایان یا برابر با آن باشد.</Text> : null}
      <Flex direction="column" gap="3" mt="6">
        {query.isLoading ? <Text color="gray" role="status">در حال دریافت فعالیت‌ها…</Text> : null}
        {query.isError ? <Text color="red" role="alert">دریافت فعالیت‌ها انجام نشد. اتصال اینترنت را بررسی و دوباره تلاش کنید.</Text> : null}
        {query.data?.items.map((item) => {
          const view = presentActivity(item);
          return <Card key={item.id} className="activity-card"><Flex justify="between" align="start" gap="3" wrap="wrap"><Box className="min-w-0 flex-1"><Text weight="bold">{view.title}</Text><Text as="div" size="2" mt="1">{view.detail}</Text><Text as="div" size="1" color="gray" mt="2">انجام‌دهنده: {item.actor_display_name} · {item.actor_role_name}</Text><details className="activity-diagnostic"><summary>جزئیات برای پشتیبانی</summary><code dir="ltr">{view.diagnostic}</code></details></Box><Box className="text-left"><Badge color={item.outcome === "applied" ? "green" : item.outcome === "conflict" ? "orange" : "red"}>{item.outcome === "applied" ? "تأیید شد" : item.outcome === "conflict" ? "نیازمند بررسی" : "انجام نشد"}</Badge><Text as="div" size="1" color="gray" mt="1">{formatJalaliDateTime(item.accepted_at)}</Text></Box></Flex></Card>;
        })}
        {!query.isLoading && query.data?.items.length === 0 ? <Text color="gray">هنوز فعالیتی با این فیلتر ثبت نشده است.</Text> : null}
      </Flex>
    </Box>
  );
}
