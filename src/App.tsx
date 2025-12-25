import { useState, useEffect } from 'react';
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
import { isSupabaseConfigured } from '@/lib/supabase';
import type { UserRole } from '@/types';

const queryClient = new QueryClient();

function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(!isSupabaseConfigured());
  const [activeTab, setActiveTab] = useState<TabId>('map');
  const [userRole] = useState<UserRole>('RESCATISTA');
  const { disasterMode } = useAppState();

  // Handle auth completion
  const handleAuthComplete = () => {
    setIsAuthenticated(true);
  };

  // Handle logout
  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  // Show auth gate if not authenticated
  if (!isAuthenticated) {
    return <AuthGate onAuthComplete={handleAuthComplete} />;
  }

  // Render active screen
  const renderScreen = () => {
    switch (activeTab) {
      case 'map':
        return <MapScreen className="h-[calc(100vh-64px)]" />;
      case 'transit':
        return <TransitScreen userRole={userRole} />;
      case 'alerts':
        return <AlertsScreen userRole={userRole} />;
      case 'status':
        return <StatusScreen userRole={userRole} />;
      case 'settings':
        return <SettingsScreen onLogout={handleLogout} />;
      default:
        return <MapScreen className="h-[calc(100vh-64px)]" />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {renderScreen()}
      </main>

      {/* Panic FAB */}
      <PanicButton userRole={userRole} />

      {/* Bottom Navigation */}
      <BottomNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isRescatista={userRole === 'RESCATISTA'}
        disasterMode={disasterMode}
      />
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
