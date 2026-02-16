import { Home, MessageCircle, Search, Settings, Upload } from "lucide-react";
import { MemexLogoIcon } from "../icons";

export type ActiveView = "overview" | "search" | "conversations" | "import" | "settings";

type SidebarProps = {
  activeView: ActiveView;
  onSelectView: (view: ActiveView) => void;
  onOpenImport: () => void;
};

export default function Sidebar({ activeView, onSelectView, onOpenImport }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <MemexLogoIcon size={26} />
      </div>
      <nav className="sidebar-nav" aria-label="Main">
        <button
          type="button"
          className={`sidebar-item ${activeView === "overview" ? "active" : ""}`}
          onClick={() => onSelectView("overview")}
          title="Overview"
          aria-label="Overview"
          aria-current={activeView === "overview" ? "page" : undefined}
        >
          <Home size={20} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          className={`sidebar-item ${activeView === "search" ? "active" : ""}`}
          onClick={() => onSelectView("search")}
          title="Search (⌘K)"
          aria-label="Search"
          aria-current={activeView === "search" ? "page" : undefined}
        >
          <Search size={20} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          className={`sidebar-item ${activeView === "conversations" ? "active" : ""}`}
          onClick={() => onSelectView("conversations")}
          title="Conversations"
          aria-label="Conversations"
          aria-current={activeView === "conversations" ? "page" : undefined}
        >
          <MessageCircle size={20} strokeWidth={1.5} />
        </button>
      </nav>
      <div className="sidebar-bottom">
        <button
          type="button"
          className={`sidebar-item ${activeView === "import" ? "active" : ""}`}
          onClick={onOpenImport}
          title="Import"
          aria-label="Import"
          aria-current={activeView === "import" ? "page" : undefined}
        >
          <Upload size={20} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          className={`sidebar-item ${activeView === "settings" ? "active" : ""}`}
          onClick={() => onSelectView("settings")}
          title="Settings"
          aria-label="Settings"
          aria-current={activeView === "settings" ? "page" : undefined}
        >
          <Settings size={20} strokeWidth={1.5} />
        </button>
      </div>
    </aside>
  );
}

