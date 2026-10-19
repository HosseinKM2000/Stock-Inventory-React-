import { isAdmin } from "@/shared/access/authorization";
import { useAuth } from "@/shared/auth/use-auth";
import { Link } from "@tanstack/react-router";
import { Box, Card, Flex, Text } from "@radix-ui/themes";
import { helpSections } from "./help-content";

export function HelpPage() {
  const { user } = useAuth();
  const sections = helpSections.filter((section) => !section.adminOnly || isAdmin(user));
  return <Box dir="rtl" className="help-page mx-auto w-full max-w-4xl">
    <header className="help-page-heading"><h1><Text size="7" weight="bold">راهنمای برنامه</Text></h1><Text as="p" color="gray" mt="2">پاسخ کوتاه و مرحله‌به‌مرحله برای کار با تنظیم.</Text></header>
    <nav aria-label="بخش‌های راهنما" className="help-quick-nav">
      {sections.map((section) => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}
    </nav>
    <Flex direction="column" gap="4" mt="6">
      {sections.map((section) => <Card asChild key={section.id} size="3"><section id={section.id} className="help-section scroll-mt-24">
        <h2><Text size="5" weight="bold">{section.title}</Text></h2><Text as="p" color="gray" mt="2">{section.summary}</Text>
        <ol>{section.steps.map((step, index) => <li key={step}><span>{(index + 1).toLocaleString("fa-IR")}</span>{step}</li>)}</ol>
        {section.faq?.map((item) => <details key={item.question}><summary>{item.question}</summary><Text as="p" size="2" color="gray">{item.answer}</Text></details>)}
        {section.links && <Flex gap="2" wrap="wrap" mt="4">{section.links.map((item) => <Link key={item.to} to={item.to as never} className="help-direct-link">{item.label}</Link>)}</Flex>}
      </section></Card>)}
    </Flex>
  </Box>;
}
