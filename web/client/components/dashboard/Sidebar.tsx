import React, { useState } from "react";
import { 
  ChevronDown, 
  ChevronRight, 
  ChevronLeft,
  Home, 
  User, 
  PieChart, 
  DollarSign, 
  FileText, 
  Clock, 
  Lock, 
  Map, 
  Shield,
  Search,
  ExternalLink,
  Plus,
  ArrowRight,
  HelpCircle
} from "lucide-react";
import { householdInfo, navigationLinks } from "@shared/mock-data";
import { cn } from "@/lib/utils";

const IconMap: Record<string, React.ElementType> = {
  Home,
  User,
  PieChart,
  DollarSign,
  FileText,
  Clock,
  Lock,
  Map,
  Shield,
};

export const Sidebar: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>(["Insurance"]);

  const toggleItem = (name: string) => {
    setExpandedItems(prev => 
      prev.includes(name) ? prev.filter(i => i !== name) : [...prev, name]
    );
  };

  return (
    <aside 
      className={cn(
        "bg-white border-r h-screen flex flex-col transition-all duration-300 overflow-hidden",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        {/* Household Header Image */}
        {!isCollapsed && (
          <div className="relative h-28 w-full">
            <img 
              src={householdInfo.image} 
              alt="Family" 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          </div>
        )}

        {/* Relationship Section */}
        {!isCollapsed && (
          <div className="p-4 border-b bg-gray-50/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Relationship</span>
              <div className="flex gap-1">
                <Search size={12} className="text-gray-400 cursor-pointer" />
                <Plus size={12} className="text-gray-400 cursor-pointer" />
                <ExternalLink size={12} className="text-gray-400 cursor-pointer" />
              </div>
            </div>
            <h3 className="text-sm font-bold text-primary">{householdInfo.name}</h3>
            <button className="text-[10px] text-blue-600 font-medium hover:underline mb-3">Search</button>
            
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-500">Net Worth of</span>
                <span className="font-bold text-gray-700">{householdInfo.netWorth}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-500">Client Since</span>
                <span className="font-bold text-gray-700">{householdInfo.clientSince}</span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Section */}
        <div className="flex-1 py-2">
          {!isCollapsed && <h4 className="px-4 py-1 text-[10px] uppercase font-bold text-gray-400 tracking-wider">Spaces</h4>}
          
          <nav className="mt-1">
            {navigationLinks.map((item) => {
              const Icon = IconMap[item.icon] || Home;
              const isExpanded = expandedItems.includes(item.name);
              const isActive = item.name === "Insurance" || item.name === "Home";

              return (
                <div key={item.name} className="flex flex-col">
                  <button
                    onClick={() => item.children && toggleItem(item.name)}
                    className={cn(
                      "flex items-center w-full px-4 py-1.5 text-xs transition-colors group",
                      isActive && !isCollapsed ? "bg-blue-50/50 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-50",
                      isCollapsed && "justify-center px-0"
                    )}
                  >
                    <Icon size={isCollapsed ? 18 : 14} className={cn(isActive ? "text-blue-700" : "text-gray-400 group-hover:text-gray-600", isCollapsed ? "mx-auto" : "mr-3")} />
                    {!isCollapsed && (
                      <span className="flex-1 text-left">{item.name}</span>
                    )}
                    {!isCollapsed && item.children && (
                      isExpanded ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />
                    )}
                  </button>

                  {!isCollapsed && item.children && isExpanded && (
                    <div className="bg-gray-50/30">
                      {item.subItems?.map(sub => (
                        <button
                          key={sub}
                          className={cn(
                            "flex items-center w-full pl-11 pr-4 py-1.5 text-[11px] hover:text-blue-700 transition-colors",
                            sub === "Policies" ? "text-blue-700 font-bold" : "text-gray-500"
                          )}
                        >
                          {sub === "Policies" && <div className="w-1 h-1 rounded-full bg-blue-700 mr-2 ml-[-12px]" />}
                          {sub}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Footer actions */}
        <div className="mt-auto border-t">
          {!isCollapsed && (
            <div className="p-4 space-y-4">
               <div className="bg-gray-100/50 p-2 rounded border border-dashed">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Accounts Not Reconciled (0)</span>
                  <HelpCircle size={10} className="text-gray-400" />
                </div>
              </div>

               <div>
                <h4 className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2">Morningstar</h4>
                <button className="flex items-center text-[11px] text-gray-600 hover:text-blue-700 py-1">
                  <ArrowRight size={12} className="mr-2" /> Launch Direct Advisory Suite
                </button>
                <button className="flex items-center text-[11px] text-gray-600 hover:text-blue-700 py-1">
                  <ArrowRight size={12} className="mr-2" /> Run Report
                </button>
              </div>

              <div>
                <h4 className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2">I Want To</h4>
                <button className="flex items-center text-[11px] text-gray-600 hover:text-blue-700 py-1">
                  <ExternalLink size={12} className="mr-2" /> Start DocuSign
                </button>
              </div>
            </div>
          )}
          
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full p-3 flex items-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {isCollapsed ? <ChevronRight size={16} className="mx-auto" /> : (
              <>
                <ChevronLeft size={16} className="mr-2" />
                <span className="text-xs font-medium">Collapse</span>
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
};
