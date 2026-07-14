import { useEffect } from "react";

import { baleLogin } from "@/features/auth/api/auth.api";
import { setToken, getToken } from "@/shared/api/token-store";
import { getDeviceFingerprint } from "@/shared/lib/device/fingerprint";

export function BaleMiniAppBridge() {
  useEffect(() => {
    const webApp = window.Bale?.WebApp;

    if (!webApp) return;

    webApp.ready();
    webApp.expand();

    const headerColor =
      webApp.themeParams?.header_bg_color ??
      webApp.themeParams?.secondary_bg_color ??
      webApp.themeParams?.bg_color;

    if (headerColor && webApp.setHeaderColor) {
      webApp.setHeaderColor(headerColor);
    }

    if (!webApp.isMiniAppSupported) {
      return;
    }

    if (!webApp.initData || getToken()) {
      return;
    }

    baleLogin({
      init_data: webApp.initData,
      device_fingerprint: getDeviceFingerprint(),
    })
      .then((response) => {
        setToken(response.access_token);

        if (location.pathname.startsWith("/auth")) {
          location.replace("/");
          return;
        }

        location.reload();
      })
      .catch(() => {
        webApp.BackButton?.hide();
      });
  }, []);

  return null;
}
