import { ChevronLeftIcon, CubeIcon, GearIcon, InfoCircledIcon, PersonIcon } from "@radix-ui/react-icons";
import { Link } from "@tanstack/react-router";
import type { ComponentType } from "react";
import { ContextualBackButton } from "./contextual-back-button";

type GuideIcon = ComponentType<{ width?: number | string; height?: number | string }>;

type Props = {
  section: "تنظیمات" | "ابزارها" | "مدیریت";
  sectionTo: "/setting" | "/tools" | "/management";
  title: string;
  description: string;
  icon: GuideIcon;
};

export function PageGuide({ section, sectionTo, title, description, icon: Icon }: Props) {
  const root = title === section;
  const SectionIcon = sectionTo === "/setting" ? GearIcon : sectionTo === "/tools" ? CubeIcon : PersonIcon;

  return (
    <header className="page-guide" dir="rtl" data-root={root}>
      <div className="page-guide-heading">
        <span className="page-guide-page-icon" aria-hidden="true"><Icon width="22" height="22" /></span>
        <div className="page-guide-title-row">
          {!root ? (
            <nav className="page-guide-breadcrumb" aria-label="مسیر صفحه">
              <Link to={sectionTo} className="page-guide-section">
                <SectionIcon width="17" height="17" aria-hidden="true" />
                <span>{section}</span>
              </Link>
              <ChevronLeftIcon className="page-guide-chevron" aria-hidden="true" />
              <h1 className="page-guide-title">{title}</h1>
            </nav>
          ) : <h1 className="page-guide-title">{title}</h1>}
        </div>
        <ContextualBackButton />
      </div>
      <div className="page-guide-description">
        <InfoCircledIcon className="page-guide-description-icon" width="20" height="20" aria-hidden="true" />
        <p>{description}</p>
      </div>
    </header>
  );
}
