import React from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface Props {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<Props> = ({ children }) => {
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 relative">
        <Header />
        {children}
      </div>
    </div>
  );
};
