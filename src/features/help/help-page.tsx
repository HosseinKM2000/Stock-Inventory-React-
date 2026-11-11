import { isAdmin } from "@/shared/access/authorization";
import {
  CheckCircledIcon,
  ChevronLeftIcon,
  PersonIcon,
  QuestionMarkCircledIcon,
  StarIcon,
} from "@radix-ui/react-icons";
import { PageGuide } from "@/features/app/layout/page-guide";
import { useAuth } from "@/shared/auth/use-auth";
import { Link } from "@tanstack/react-router";
import { Box, Card, Flex, Text } from "@radix-ui/themes";
import { accessState } from "@/shared/access/access-state";
import {
  gettingStartedSteps,
  gettingStartedTracks,
  helpSections,
  type HelpLink,
  type HelpSection,
} from "./help-content";

function DirectLinks({ links }: { links: readonly HelpLink[] }) {
  return (
    <Flex gap="2" wrap="wrap" mt="4" className="help-direct-links">
      {links.map((item) => (
        <Link key={item.to} to={item.to as never} className="help-direct-link">
          {item.label}
          <ChevronLeftIcon aria-hidden="true" />
        </Link>
      ))}
    </Flex>
  );
}

function GettingStartedGuide() {
  const tracks = gettingStartedTracks.filter((track) => track.id !== "team" || accessState.canUse("personnel"));
  const visibleLink = (to: string) => {
    if (to === "/setting/sync" || to === "/tools/activity") return accessState.canUse("sync");
    if (to === "/setting/personnel" || to === "/setting/roles") return accessState.canUse("personnel");
    return true;
  };
  return (
    <section id="getting-started" className="help-start-guide scroll-mt-24" aria-labelledby="getting-started-title">
      <header className="help-start-heading">
        <span className="help-start-icon" aria-hidden="true"><StarIcon width="24" height="24" /></span>
        <Box>
          <Text as="div" size="1" weight="bold" className="help-start-label">پیشنهاد مهم برای شروع مطمئن</Text>
          <h2 id="getting-started-title">چطور اصولی شروع کنیم؟</h2>
          <p>این ترتیب کمک می‌کند اطلاعات از روز اول منظم بماند و بعداً زمان کمتری برای اصلاح خطاها بگذارید.</p>
        </Box>
      </header>

      <div className="help-start-tracks" aria-label="روش شروع بر اساس نوع مجموعه">
        {tracks.map((track) => (
          <article key={track.id}>
            <span aria-hidden="true"><PersonIcon width="20" height="20" /></span>
            <div><h3>{track.title}</h3><p>{track.description}</p></div>
          </article>
        ))}
      </div>

      <ol className="help-start-steps">
        {gettingStartedSteps.map((step, index) => (
          <li key={step.title}>
            <span className="help-start-step-number">{(index + 1).toLocaleString("fa-IR")}</span>
            <div className="help-start-step-copy">
              <h3>{step.title}</h3>
              <p>{step.description}</p>
              <DirectLinks links={step.links.filter((link) => visibleLink(link.to))} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function HelpSectionCard({ section }: { section: HelpSection }) {
  const faqOnly = section.id === "faq";
  return (
    <Card asChild size="3">
      <section id={section.id} className="help-section scroll-mt-24" data-faq={faqOnly || undefined}>
        <header className="help-section-heading">
          <span aria-hidden="true">{faqOnly ? <QuestionMarkCircledIcon /> : <CheckCircledIcon />}</span>
          <Box>
            <h2><Text size="5" weight="bold">{section.title}</Text></h2>
            <Text as="p" color="gray">{section.summary}</Text>
          </Box>
        </header>
        {section.steps?.length ? (
          <ol className="help-section-steps">
            {section.steps.map((step, index) => <li key={step}><span>{(index + 1).toLocaleString("fa-IR")}</span><p>{step}</p></li>)}
          </ol>
        ) : null}
        {section.faq?.length ? (
          <div className="help-faq-list">
            {section.faq.map((item) => (
              <details key={item.question}>
                <summary>{item.question}</summary>
                <Text as="p" size="2" color="gray">{item.answer}</Text>
              </details>
            ))}
          </div>
        ) : null}
        {section.links?.length ? <DirectLinks links={section.links} /> : null}
      </section>
    </Card>
  );
}

export function HelpPage() {
  const { user } = useAuth();
  const sections = helpSections.filter((section) =>
    (!section.adminOnly || isAdmin(user))
    && (!section.capabilities?.length || section.capabilities.some((capability) => accessState.canUse(capability))),
  );

  return (
    <Box dir="rtl" className="help-page mx-auto w-full max-w-5xl">
      <PageGuide
        section="ابزارها"
        sectionTo="/tools"
        title="راهنمای برنامه"
        description="مسیرهای کوتاه و روشن برای شروع درست، انجام کارهای روزانه و حل مشکل‌های رایج."
        icon={QuestionMarkCircledIcon}
      />
      <nav aria-label="بخش‌های راهنما" className="help-quick-nav">
        <a href="#getting-started" className="is-featured"><StarIcon aria-hidden="true" />شروع اصولی</a>
        {sections.map((section) => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}
      </nav>
      <GettingStartedGuide />
      <Flex direction="column" gap="4" mt="6" className="help-sections-list">
        {sections.map((section) => <HelpSectionCard key={section.id} section={section} />)}
      </Flex>
    </Box>
  );
}
