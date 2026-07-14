export {};

declare global {
  interface Window {
    Bale?: {
      WebApp?: BaleWebApp;
    };
  }
}

type BaleBackButton = {
  show: () => void;
  hide: () => void;
};

type BaleThemeParams = {
  bg_color?: string;
  header_bg_color?: string;
  secondary_bg_color?: string;
};

type BaleWebApp = {
  initData: string;
  isMiniAppSupported?: boolean;
  themeParams?: BaleThemeParams;
  ready: () => void;
  expand: () => void;
  setHeaderColor?: (color: string) => void;
  BackButton?: BaleBackButton;
};
