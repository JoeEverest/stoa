// Present only inside the desktop app (desktop/preload.cjs).
type StoaSecretName = "anthropic" | "custom" | "bedrock";
type StoaSecretInfo = { set: boolean; last4: string | null };
type StoaUpdateStatus = {
  current: string;
  kind: "mac" | "appimage" | "deb" | null;
  blocked: string | null;
  state: "idle" | "checking" | "none" | "available" | "downloading" | "ready" | "error";
  latest: { version: string; notes: string; url: string; publishedAt: string; size: number } | null;
  progress: { bytes: number; total: number } | null;
  error: string | null;
  checkedAt: string | null;
  auto: boolean;
};
interface Window {
  stoaDesktop?: {
    platform: string;
    setSecret(name: StoaSecretName, value: string): Promise<{ ok: boolean; error?: string }>;
    clearSecret(name: StoaSecretName): Promise<{ ok: boolean }>;
    secretInfo(): Promise<Record<StoaSecretName, StoaSecretInfo>>;
    openClaudeLogin(cliPath: string | null): Promise<{ ok: boolean; error?: string }>;
    openLogs(): Promise<string>;
    updates: {
      status(): Promise<StoaUpdateStatus>;
      check(): Promise<StoaUpdateStatus>;
      download(): Promise<StoaUpdateStatus>;
      install(): Promise<{ ok: boolean; error?: string }>;
      setAuto(on: boolean): Promise<StoaUpdateStatus>;
      openReleasePage(): Promise<void>;
      onStatus(cb: (s: StoaUpdateStatus) => void): () => void;
    };
  };
}
