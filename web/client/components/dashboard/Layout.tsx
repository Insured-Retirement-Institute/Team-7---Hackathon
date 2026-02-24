import React from "react";
import { Header } from "./Header";

interface Props {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<Props> = ({ children }) => {
  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-sans min-h-0">
      <Header />
      <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
        {children}
      </div>
    </div>
  );
};
