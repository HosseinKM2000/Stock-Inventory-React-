import { CheckCircledIcon, CubeIcon } from "@radix-ui/react-icons";
import { Link as RouterLink } from "@tanstack/react-router";
import type { ReactNode } from "react";

import "./auth-pages.css";

type AuthPageShellProps = {
  title: string;
  description: string;
  badge: string;
  badgeIcon?: ReactNode;
  descriptionAfterBadge?: boolean;
  children: ReactNode;
  switchText: string;
  switchLabel: string;
  switchTo: "/auth/login" | "/auth/register";
  trustText: string;
};

export function AuthPageShell({
  title,
  description,
  badge,
  badgeIcon,
  descriptionAfterBadge = false,
  children,
  switchText,
  switchLabel,
  switchTo,
  trustText,
}: AuthPageShellProps) {
  const descriptionNode = <p className="auth-page-description">{description}</p>;

  return (
    <main className="auth-page" dir="rtl">
      <span className="auth-page-shape auth-page-shape--top" aria-hidden="true" />
      <span className="auth-page-shape auth-page-shape--bottom" aria-hidden="true" />

      <section className="auth-shell" aria-labelledby="auth-page-title">
        <header className="auth-header">
          <div className="auth-brand" aria-label="تنظیم">
            <img
              className="auth-brand-logo"
              src="/icons/android/adaptive/ic_launcher_foreground-original.png"
              alt=""
              width="88"
              height="88"
            />
            <span className="auth-brand-name">تنظیم</span>
          </div>

          <h1 id="auth-page-title" className="auth-page-title">{title}</h1>
          {!descriptionAfterBadge && descriptionNode}

          <div className="auth-page-badge">
            <span className="auth-page-badge-icon" aria-hidden="true">
              {badgeIcon ?? <CubeIcon />}
            </span>
            <span>{badge}</span>
          </div>

          {descriptionAfterBadge && descriptionNode}
        </header>

        {children}

        <footer className="auth-footer">
          <p className="auth-switch">
            <span>{switchText}</span>{" "}
            <RouterLink to={switchTo}>{switchLabel}</RouterLink>
          </p>
          <p className="auth-trust">
            <CheckCircledIcon aria-hidden="true" />
            <span>{trustText}</span>
          </p>
        </footer>
      </section>
    </main>
  );
}
