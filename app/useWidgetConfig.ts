import useSWR from "swr";
import { DEFAULT_PRIMARY_COLOR } from "@/lib/constants";
import { widgetFetcher } from "@/lib/widget-fetcher";

export interface WidgetConfig {
  primaryColor?: string;
  widgetTheme?: string;
  allowedDomain?: string | null;
}

export interface WidgetTheme {
  primaryColor: string;
  widgetTheme: string;
}

/**
 * Shared config fetch + theme resolution for the iframe widget pages
 * (/changelog, /board, /survey). URL theme params (from the embed snippet) win
 * over the org's saved config so the customer's chosen look applies immediately,
 * before /api/config resolves. `theme` is null until it can be resolved.
 */
export function useWidgetConfig(
  apiKey: string | null,
  themeParam: string | null,
  primaryColorParam: string | null,
): { config: WidgetConfig | undefined; theme: WidgetTheme | null } {
  const { data: config } = useSWR<WidgetConfig>(
    apiKey ? ["/api/config", apiKey] : null,
    widgetFetcher,
  );

  const theme = themeParam
    ? { primaryColor: primaryColorParam ?? DEFAULT_PRIMARY_COLOR, widgetTheme: themeParam }
    : config
      ? {
          primaryColor: config.primaryColor ?? DEFAULT_PRIMARY_COLOR,
          widgetTheme: config.widgetTheme ?? "light",
        }
      : null;

  return { config, theme };
}
