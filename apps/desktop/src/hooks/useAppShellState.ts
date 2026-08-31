import { useMemo } from "react";
import type { ActiveView } from "../components/Sidebar";

export type AppDataState = "bootstrapping" | "ready-empty" | "ready-has-data" | "importing" | "clearing" | "error";

export function useAppShellState(params: {
  activeView: ActiveView;
  searchSelectedConvId: string | null;
  loading: boolean;
  stats: { conversationCount: number } | null;
  loadError: string | null;
  clearingData: boolean;
  importing: boolean;
}) {
  const { activeView, searchSelectedConvId, loading, stats, loadError, clearingData, importing } = params;

  const searchPanelClosed = activeView === "search" && !searchSelectedConvId;

  const shellLayoutClass = useMemo(() => {
    if (activeView === "search") return searchPanelClosed ? "search-layout search-panel-closed" : "search-layout";
    if (activeView === "overview") return "overview-layout";
    if (activeView === "settings") return "settings-layout";
    if (activeView === "import") return "import-layout";
    return "conversations-layout";
  }, [activeView, searchPanelClosed]);

  const isEmpty = !loading && stats?.conversationCount === 0;
  const showOnboarding = false; // handled via separate hook/state in App

  const appDataState: AppDataState = useMemo(() => {
    if (loadError) return "error";
    if (clearingData) return "clearing";
    if (importing) return "importing";
    if (loading) return "bootstrapping";
    if (isEmpty) return "ready-empty";
    return "ready-has-data";
  }, [loadError, clearingData, importing, loading, isEmpty]);

  return { shellLayoutClass, appDataState, isEmpty, searchPanelClosed, showOnboarding };
}
