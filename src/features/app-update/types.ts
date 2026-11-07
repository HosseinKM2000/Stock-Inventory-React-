export type AppReleaseFeature = {
  title: string;
  description: string;
  capability?: string;
};

export type AppRelease = {
  version: string;
  released_at: string;
  title: string;
  summary: string;
  features: AppReleaseFeature[];
};

export type AppUpdateStatus =
  | "idle"
  | "checking"
  | "current"
  | "ready"
  | "deferred"
  | "applying"
  | "unsupported"
  | "failed";

export type AppUpdateSnapshot = {
  status: AppUpdateStatus;
  currentVersion: string;
  release: AppRelease | null;
  lastCheckedAt: string | null;
  canInstall: boolean;
  error: string | null;
};
