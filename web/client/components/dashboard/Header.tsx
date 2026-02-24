import React from "react";
import { 
  Grid, 
  Search, 
  Settings, 
  Bell, 
  HelpCircle, 
  UserCircle 
} from "lucide-react";

export const Header: React.FC = () => {
  return (
    <header className="h-14 bg-white border-b flex items-center justify-between px-6 shrink-0 relative z-20">
      {/* Left side utility */}
      <div className="flex items-center text-[10px] font-bold tracking-wider text-gray-400 uppercase">
        Client View
      </div>

      {/* Logo in the center */}
      <div className="flex flex-col items-center">
        <div className="flex items-center">
          <div className="bg-primary text-white w-6 h-6 flex items-center justify-center font-serif font-bold text-sm mr-2">D</div>
          <div className="flex flex-col leading-none">
            <span className="text-primary font-bold tracking-widest text-xs uppercase">Deliver Wealth</span>
            <span className="text-primary tracking-[0.2em] text-[10px] uppercase font-medium">Management</span>
          </div>
        </div>
      </div>

      {/* Right side icons */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center p-1 bg-blue-50 text-blue-700 rounded cursor-pointer">
          <Grid size={16} />
        </div>
        <div className="flex items-center text-gray-400 hover:text-gray-600 cursor-pointer">
          <Search size={16} />
        </div>
        <div className="flex items-center text-gray-400 hover:text-gray-600 cursor-pointer">
          <Settings size={16} />
        </div>
        <div className="flex items-center text-gray-400 hover:text-gray-600 cursor-pointer relative">
          <Bell size={16} />
          <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-red-500 rounded-full border border-white"></span>
        </div>
        <div className="flex items-center text-gray-400 hover:text-gray-600 cursor-pointer">
          <HelpCircle size={16} />
        </div>
        <div className="flex items-center space-x-2 text-gray-400 hover:text-gray-600 cursor-pointer group">
          <div className="flex items-center">
             <span className="text-xs mr-2 font-medium text-gray-600">LR</span>
             <UserCircle size={18} />
          </div>
        </div>
      </div>
    </header>
  );
};
