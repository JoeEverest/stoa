// Present only inside the desktop app (desktop/preload.cjs).
interface Window {
  stoaDesktop?: {
    platform: string;
    setApiKey(key: string): Promise<{ ok: boolean; error?: string }>;
    clearApiKey(): Promise<{ ok: boolean }>;
    openLogs(): Promise<string>;
  };
}
