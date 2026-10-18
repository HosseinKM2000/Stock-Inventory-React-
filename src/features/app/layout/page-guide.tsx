import { ChevronLeftIcon } from "@radix-ui/react-icons";
import { Link } from "@tanstack/react-router";
import type { ComponentType } from "react";

type GuideIcon = ComponentType<{ width?: number | string; height?: number | string }>;

type Props = {
  section: "تنظیمات" | "ابزارها";
  sectionTo: "/setting" | "/tools";
  title: string;
  description: string;
  icon: GuideIcon;
};

export function PageGuide({ section, sectionTo, title, description, icon: Icon }: Props) {
  const root = title === section;

  return (
    <header className="page-guide" dir="rtl">
      <div className="page-guide-heading">
        {root ? (
          <span className="page-guide-section-icon" aria-hidden="true"><Icon width="19" height="19" /></span>
        ) : (
          <>
            <Link to={sectionTo} className="page-guide-section">
              <span>{section}</span>
              <span className="page-guide-section-icon" aria-hidden="true"><Icon width="19" height="19" /></span>
            </Link>
            <ChevronLeftIcon className="page-guide-chevron" aria-hidden="true" />
          </>
        )}
        <h1 className="page-guide-title">{title}</h1>
      </div>
      <div className="page-guide-description">
        <span className="page-guide-description-icon" aria-hidden="true"><Icon width="22" height="22" /></span>
        <p>{description}</p>
      </div>
    </header>
  );
}
