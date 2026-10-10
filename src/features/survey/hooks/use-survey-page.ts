import { useEffect } from "react";

const SURVEY_FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='12' fill='%236c4cff'/%3E%3C/svg%3E";

export function useSurveyPage() {
  useEffect(() => {
    const favicon = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    const previousFavicon = favicon?.href;

    document.title = "پرسش‌نامه نیازهای فروشندگان لوازم یدکی";
    document.documentElement.classList.add("survey-page-active");
    favicon?.setAttribute("href", SURVEY_FAVICON);

    return () => {
      document.documentElement.classList.remove("survey-page-active");

      if (favicon && previousFavicon) {
        favicon.href = previousFavicon;
      }
    };
  }, []);
}
