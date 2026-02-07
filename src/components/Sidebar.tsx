import { SidebarContent } from "./SidebarContent";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Sidebar = ({ activeTab, onTabChange }: SidebarProps) => {
  return (
    <div className="w-64 h-screen bg-sidebar border-r border-sidebar-border flex flex-col shrink-0 overflow-hidden">
      <SidebarContent activeTab={activeTab} onTabChange={onTabChange} touchFriendly={false} />
    </div>
  );
};

export default Sidebar;
