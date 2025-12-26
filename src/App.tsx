import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BottomNavigation, type TabId } from '@/components/BottomNavigation';
import { MatsLogo } from '@/components/MatsLogo';
import { PanicButton } from '@/components/PanicButton';
import { AppHeader } from '@/components/AppHeader';
import { AuthGate } from '@/pages/AuthGate';
import { MapScreen } from '@/pages/MapScreen';
import { TransitScreen } from '@/pages/TransitScreen';
import { AlertsScreen } from '@/pages/AlertsScreen';
import { StatusScreen } from '@/pages/StatusScreen';
import { MarketScreen } from '@/pages/MarketScreen';
import { SettingsScreen } from '@/pages/SettingsScreen';
import { CommunityScreen } from '@/pages/CommunityScreen';

import InstallPage from '@/pages/InstallPage';
import { InstallPrompt } from '@/components/InstallPrompt';
import { UpdatePrompt, UpdateIndicator } from '@/components/UpdatePrompt';
import { SplashScreen } from '@/components/SplashScreen';

import { SeismicAlert } from '@/components/SeismicAlert';
import { EmergencyAlertOverlay } from '@/components/EmergencyAlertOverlay';
import { ActiveAlertBanner } from '@/components/ActiveAlertBanner';
import { StatusCheckinPrompt } from '@/components/StatusCheckinPrompt';
import { OnboardingTutorial } from '@/components/OnboardingTutorial';
import { useAppState } from '@/hooks/useRealtime';
import { useLocation } from '@/hooks/useLocation';
import { useEarthquakeDetection } from '@/hooks/useEarthquakeDetection';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useStatusCheckin } from '@/hooks/useStatusCheckin';
import { useAuth } from '@/hooks/useAuth';
import { usePanicAlerts } from '@/hooks/usePanicAlerts';
import { useMyAlertResponders } from '@/hooks/useMyAlertResponders';
import { useTestMode } from '@/hooks/useTestMode';
import { useOverdueTrips } from '@/hooks/useOverdueTrips';
import { useEmergencyNotification } from '@/hooks/useEmergencyNotification';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { UserRole, USGSEarthquake, PanicType } from '@/types';

const queryClient = new QueryClient();

function AppContent() {
  const [showSplash, setShowSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('map');
  const [userRole] = useState<UserRole>('RESCATISTA');
  
  // Use the auth hook to check for existing session
  const { user, profile, loading: authLoading, signOut } = useAuth();
  
  // Determine authentication state
  const isAuthenticated = !!user;
  const isProfileComplete = !!profile;

  // Handle new user onboarding
  useEffect(() => {
    if (isAuthenticated && isProfileComplete) {
      const onboardingComplete = localStorage.getItem('onboarding-complete');
      if (!onboardingComplete) {
        setIsNewUser(true);
        setShowOnboarding(true);
      }
    }
  }, [isAuthenticated, isProfileComplete]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    setIsNewUser(false);
    localStorage.setItem('onboarding-complete', 'true');
  };

  const handleLogout = async () => {
    await signOut();
  };

  // Check if splash was shown recently (within session)
  useEffect(() => {
    const splashShown = sessionStorage.getItem('splash-shown');
    if (splashShown) {
      setShowSplash(false);
    }
  }, []);

  const handleSplashComplete = () => {
    setShowSplash(false);
    sessionStorage.setItem('splash-shown', 'true');
  };

  // Show splash screen
  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  // Show loading while checking auth state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <MatsLogo size={64} showText />
      </div>
    );
  }

  // Show auth gate if not authenticated or profile incomplete
  if (!isAuthenticated || !isProfileComplete) {
    return <AuthGate onAuthComplete={() => {}} />;
  }

  // Show onboarding for new users
  if (showOnboarding) {
    return <OnboardingTutorial onComplete={handleOnboardingComplete} />;
  }

  return <AuthenticatedApp activeTab={activeTab} setActiveTab={setActiveTab} userRole={userRole} handleLogout={handleLogout} />;
}

function AuthenticatedApp({ activeTab, setActiveTab, userRole, handleLogout }: { 
  activeTab: TabId; setActiveTab: (tab: TabId) => void; userRole: UserRole; handleLogout: () => void;
}) {
  const { disasterMode } = useAppState();
  const [panicOpen, setPanicOpen] = useState(false);
  const [isSavingAlert, setIsSavingAlert] = useState(false);
  const [alertRefreshTrigger, setAlertRefreshTrigger] = useState(0);
  const { user } = useAuth();
  
  // Test mode for simulating panic alerts
  const { testAlert, simulatePanicAlert, clearTestAlert } = useTestMode();
  
  // Real-time panic alerts from other users
  const { recentAlerts, unreadCount, latestEmergencyAlert, dismissLatestAlert } = usePanicAlerts();
  
  // Listen for responders to user's own alerts and track their location
  const { respondersToMyAlerts } = useMyAlertResponders();
  
  // Monitor for overdue trips (30+ minutes past ETA)
  useOverdueTrips();
  
  // Emergency contact notification
  const { notifyEmergencyContacts } = useEmergencyNotification();

  // Push notifications
  const { showEarthquakeNotification, requestPermission, permission } = usePushNotifications();
  
  // Status check-in timer
  const { 
    shouldPrompt: showCheckinPrompt, 
    recordEarthquakeAlert, 
    confirmSafe, 
    dismissPrompt,
    getTimeSinceEarthquake 
  } = useStatusCheckin();
  
  // Request notification permission on mount
  useEffect(() => {
    if (permission === 'default') {
      requestPermission();
    }
  }, [permission, requestPermission]);
  
  // Callback for when earthquake is detected
  const handleEarthquakeDetected = useCallback((earthquake: USGSEarthquake, distanceKm: number) => {
    // Show push notification (works even in background tabs)
    showEarthquakeNotification(earthquake, distanceKm);
    // Record for status check-in timer
    recordEarthquakeAlert(earthquake.id);
  }, [showEarthquakeNotification, recordEarthquakeAlert]);
  
  // Location and earthquake detection
  const { position } = useLocation();
  const { nearbyQuake, distanceKm, dismissAlert, markAsReported } = useEarthquakeDetection(
    position,
    handleEarthquakeDetected
  );

  // Handle check-in prompt actions
  const handleConfirmSafe = () => {
    confirmSafe();
  };

  const handleNeedHelp = () => {
    dismissPrompt();
    setPanicOpen(true); // Open panic button to request help
  };

  // Handle panic button trigger - save to database and notify other users
  const handlePanicTriggered = useCallback(async (
    type: PanicType, 
    lat: number, 
    lng: number,
    message?: string,
    audioUrl?: string,
    audioDurationMs?: number
  ) => {
    if (!user?.id) {
      console.error('No user ID for panic event');
      return;
    }

    // Show saving indicator
    setIsSavingAlert(true);
    
    // Show immediate feedback toast
    const savingToastId = toast.loading('Enviando alerta a la comunidad...', {
      description: message ? 'Guardando tu mensaje y ubicación' : 'Guardando tu ubicación GPS',
    });

    try {
      // Always save to panic_events for SOS alerts (with or without context)
      const { error } = await supabase.from('panic_events').insert({
        user_id: user.id,
        panic_type: type,
        lat,
        lng,
        message: message || null,
        audio_url: audioUrl || null,
        audio_duration_ms: audioDurationMs || null,
        resolved: false,
      });

      if (error) {
        console.error('Error saving panic event:', error);
        toast.error('Error al guardar alerta', {
          id: savingToastId,
          description: 'Intenta de nuevo',
        });
      } else {
        console.log('Panic event saved:', type, lat, lng, message?.slice(0, 50));
        toast.success('Alerta enviada correctamente', {
          id: savingToastId,
          description: message || audioUrl 
            ? 'Todos los usuarios han sido notificados con tu mensaje' 
            : 'Todos los usuarios de la comunidad han sido notificados',
          duration: 5000,
        });
        setAlertRefreshTrigger(prev => prev + 1);
        
        // Notify emergency contacts via WhatsApp
        notifyEmergencyContacts(type, lat, lng, message);
      }
    } catch (err) {
      console.error('Failed to save alert:', err);
      toast.error('Error de conexión', {
        id: savingToastId,
        description: 'Verifica tu conexión a internet',
      });
    } finally {
      setIsSavingAlert(false);
    }
  }, [user?.id, notifyEmergencyContacts]);

  const renderScreen = () => {
    const screens: Record<string, React.ReactNode> = {
      map: <MapScreen className="h-[calc(100vh-120px)]" respondersToMyAlerts={respondersToMyAlerts} />,
      transit: <TransitScreen userRole={userRole} />,
      alerts: <AlertsScreen userRole={userRole} />,
      community: <CommunityScreen />,
      market: <MarketScreen userRole={userRole} />,
      status: <StatusScreen userRole={userRole} />,
      settings: <SettingsScreen onLogout={handleLogout} onSimulatePanicAlert={simulatePanicAlert} />,
    };

    return (
      <div key={activeTab} className="animate-fade-in h-full">
        {screens[activeTab] || screens.map}
      </div>
    );
  };

  return (
    <div className="min-h-screen min-h-dvh bg-background flex flex-col overflow-x-hidden">
      <AppHeader onPanicClick={() => setPanicOpen(true)} />
      <ActiveAlertBanner testAlert={testAlert} onClearTestAlert={clearTestAlert} refreshTrigger={alertRefreshTrigger} />
      <UpdatePrompt />
      <UpdateIndicator />
      <main className="main-content flex-1 overflow-y-auto overflow-x-hidden">{renderScreen()}</main>
      <PanicButton userRole={userRole} isOpen={panicOpen} onOpenChange={setPanicOpen} onPanicTriggered={handlePanicTriggered} />
      
      <InstallPrompt />
      <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} isRescatista={userRole === 'RESCATISTA'} disasterMode={disasterMode} />
      
      {/* Seismic Alert Dialog */}
      {nearbyQuake && position && distanceKm !== null && (
        <SeismicAlert
          earthquake={nearbyQuake}
          distanceKm={distanceKm}
          position={position}
          userRole={userRole}
          onDismiss={dismissAlert}
          onReported={markAsReported}
        />
      )}

      {/* Status Check-in Prompt (5 minutes after earthquake) */}
      <StatusCheckinPrompt
        open={showCheckinPrompt}
        timeSinceEarthquake={getTimeSinceEarthquake()}
        onConfirmSafe={handleConfirmSafe}
        onNeedHelp={handleNeedHelp}
        onDismiss={dismissPrompt}
      />

      {/* Prominent Emergency Alert Overlay for community alerts */}
      <EmergencyAlertOverlay
        alert={latestEmergencyAlert}
        onDismiss={dismissLatestAlert}
        onViewLocation={() => {
          if (latestEmergencyAlert) {
            setActiveTab('map');
            dismissLatestAlert();
          }
        }}
        onNavigate={() => {
          if (latestEmergencyAlert) {
            window.open(`https://maps.google.com/maps?daddr=${latestEmergencyAlert.lat},${latestEmergencyAlert.lng}`, '_blank');
            dismissLatestAlert();
          }
        }}
      />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/install" element={<InstallPage />} />
          <Route path="/" element={<AppContent />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
      <Sonner />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
