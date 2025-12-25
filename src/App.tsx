import { useState } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BottomNavigation, type TabId } from '@/components/BottomNavigation';
import { PanicButton } from '@/components/PanicButton';
import { AuthGate } from '@/pages/AuthGate';
import { MapScreen } from '@/pages/MapScreen';
import { TransitScreen } from '@/pages/TransitScreen';
import { AlertsScreen } from '@/pages/AlertsScreen';
import { StatusScreen } from '@/pages/StatusScreen';
import { SettingsScreen } from '@/pages/SettingsScreen';
import { useAppState } from '@/hooks/useRealtime';
import type { UserRole } from '@/types';

const queryClient = new QueryClient();

function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('map');
  const [userRole] = useState<UserRole>('RESCATISTA');

  const handleAuthComplete = () => setIsAuthenticated(true);
  const handleLogout = () => setIsAuthenticated(false);

  if (!isAuthenticated) {
    return <AuthGate onAuthComplete={handleAuthComplete} />;
  }

  return <AuthenticatedApp activeTab={activeTab} setActiveTab={setActiveTab} userRole={userRole} handleLogout={handleLogout} />;
}

function AuthenticatedApp({ activeTab, setActiveTab, userRole, handleLogout }: { 
  activeTab: TabId; setActiveTab: (tab: TabId) => void; userRole: UserRole; handleLogout: () => void;
}) {
  const { disasterMode } = useAppState();

  const renderScreen = () => {
    switch (activeTab) {
      case 'map': return <MapScreen className="h-[calc(100vh-64px)]" />;
      case 'transit': return <TransitScreen userRole={userRole} />;
      case 'alerts': return <AlertsScreen userRole={userRole} />;
      case 'status': return <StatusScreen userRole={userRole} />;
      case 'settings': return <SettingsScreen onLogout={handleLogout} />;
      default: return <MapScreen className="h-[calc(100vh-64px)]" />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 overflow-hidden">{renderScreen()}</main>
      <PanicButton userRole={userRole} />
      <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} isRescatista={userRole === 'RESCATISTA'} disasterMode={disasterMode} />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppContent />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;