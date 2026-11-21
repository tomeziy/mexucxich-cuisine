import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { MobileTabBar } from './MobileTabBar';
import { AuthGateModal } from '../auth/AuthGateModal';
import { useStore } from '../../context/StoreContext';

export const Layout: React.FC = () => {
  const { authConfig, isAuthenticated, isScreenLocked } = useStore();
  const isMandatoryLock = (authConfig.requireSignIn && !isAuthenticated) || isScreenLocked;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 antialiased">
      <Navbar />
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <Sidebar />
        <main className="flex-1 min-w-0 p-3 sm:p-4 pb-20 lg:pb-6 overflow-y-auto max-w-full">
          <Outlet />
        </main>
      </div>
      <MobileTabBar />
      <AuthGateModal isOpen={isMandatoryLock} isMandatoryLock={isMandatoryLock} />
    </div>
  );
};
