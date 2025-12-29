import { useState, useEffect, useCallback, useMemo } from 'react';
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
import SharedTripPage from '@/pages/SharedTripPage';
import { InstallPrompt } from '@/components/InstallPrompt';
import { UpdatePrompt, UpdateIndicator } from '@/components/UpdatePrompt';
import { SplashScreen } from '@/components/SplashScreen';

import { SeismicAlert } from '@/components/SeismicAlert';
import { EmergencyAlertOverlay } from '@/components/EmergencyAlertOverlay';
import { ActiveAlertBanner } from '@/components/ActiveAlertBanner';
import { QuakeDamageBanner } from '@/components/QuakeDamageBanner';
import { ResponderComingOverlay } from '@/components/ResponderComingOverlay';
import { TripSafetyCheckDialog } from '@/components/TripSafetyCheckDialog';
import { ResponderTrackingMap } from '@/components/ResponderTrackingMap';
import { InternalMessaging } from '@/components/InternalMessaging';
import { UnreadMessagesBanner } from '@/components/UnreadMessagesBanner';
import { Clave100Overlay } from '@/components/Clave100Overlay';

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
import { useMyPanicResponders } from '@/hooks/useMyPanicResponders';
import { useTestMode } from '@/hooks/useTestMode';
import { useBackgroundSync } from '@/hooks/useBackgroundSync';
import { useOverdueTrips } from '@/hooks/useOverdueTrips';
import { useDelayedTripChecker } from '@/hooks/useDelayedTripChecker';
import { useInactiveDelayedTripsAlert } from '@/hooks/useInactiveDelayedTripsAlert';
import { useEmergencyNotification } from '@/hooks/useEmergencyNotification';
import { useInternalMessages } from '@/hooks/useInternalMessages';
import { InternalMessagesProvider } from '@/providers/InternalMessagesProvider';
import { useNewUserNotification } from '@/hooks/useNewUserNotification';
import { useWebPushSubscription } from '@/hooks/useWebPushSubscription';
import { useBackgroundConnection } from '@/hooks/useBackgroundConnection';
import { useAutoWakeLock } from '@/hooks/useWakeLock';
import { useBackgroundLocation } from '@/hooks/useBackgroundLocation';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { UserRole, USGSEarthquake, PanicType } from '@/types';

const queryClient = new QueryClient();

function AppContent() {
  const [showSplash, setShowSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('map');
  const [userRole] = useState<UserRole>('SOS_ACTIVO');
  
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
  
  // Keep screen awake during active emergency situations
  // Wake lock activates when there's a nearby quake, active emergency alert, or disaster mode
  const shouldKeepScreenAwake = !!latestEmergencyAlert || disasterMode || panicOpen;
  useAutoWakeLock(shouldKeepScreenAwake);
  
  // Listen for responders to user's own alerts and track their location
  const { respondersToMyAlerts, newResponderAlert: newAlertResponder, dismissNewResponderAlert: dismissAlertResponder } = useMyAlertResponders();
  
  // Listen for responders to user's own panic alerts
  const { respondersToMyPanics, newResponderAlert: newPanicResponder, dismissNewResponderAlert: dismissPanicResponder } = useMyPanicResponders();
  
  // State for showing responder tracking map
  const [showResponderMap, setShowResponderMap] = useState(false);
  
  // State for messaging modal
  const [messagingOpen, setMessagingOpen] = useState(false);
  const [messagingUserId, setMessagingUserId] = useState<string | null>(null);
  const [messagingUserName, setMessagingUserName] = useState<string | null>(null);
  
  // Handler to open messaging with a specific user
  const handleOpenMessaging = useCallback((userId: string, userName: string | null) => {
    setMessagingUserId(userId);
    setMessagingUserName(userName);
    setMessagingOpen(true);
  }, []);
  
  // Combined new responder alert state (from either hook)
  const activeNewResponder = newAlertResponder || newPanicResponder;
  const dismissNewResponder = useCallback(() => {
    if (newAlertResponder) dismissAlertResponder();
    if (newPanicResponder) dismissPanicResponder();
  }, [newAlertResponder, newPanicResponder, dismissAlertResponder, dismissPanicResponder]);
  
  // Combine responders from both hooks for the tracking map
  const allMyResponders = useMemo(() => {
    const combined = [
      ...respondersToMyAlerts.map(r => ({
        id: r.id,
        user_id: r.user_id,
        nickname: r.nickname,
        lat: r.lat,
        lng: r.lng,
        transport_mode: r.transport_mode,
        distance_km: r.distance_km,
        eta_minutes: r.eta_minutes,
        arrived_at: r.arrived_at,
        alert_lat: r.alert_lat,
        alert_lng: r.alert_lng,
      })),
      ...respondersToMyPanics.map(r => ({
        id: r.id,
        user_id: r.user_id,
        nickname: r.nickname,
        lat: r.lat,
        lng: r.lng,
        transport_mode: r.transport_mode,
        distance_km: r.distance_km,
        eta_minutes: r.eta_minutes,
        arrived_at: r.arrived_at,
        alert_lat: r.alert_lat,
        alert_lng: r.alert_lng,
      })),
    ];
    return combined;
  }, [respondersToMyAlerts, respondersToMyPanics]);
  
  // Get the alert location from the first active responder (they're all responding to same alert)
  const activeAlertLocation = useMemo(() => {
    const activeResponder = allMyResponders.find(r => !r.arrived_at);
    if (activeResponder) {
      return { lat: activeResponder.alert_lat, lng: activeResponder.alert_lng };
    }
    // Fallback: if all have arrived, use first responder's alert location
    if (allMyResponders.length > 0) {
      return { lat: allMyResponders[0].alert_lat, lng: allMyResponders[0].alert_lng };
    }
    return null;
  }, [allMyResponders]);
  
  // Monitor for overdue trips (30+ minutes past ETA) - client side with dialog
  const { 
    overdueTrip, 
    isUpdating: isUpdatingTrip,
    confirmSafe: confirmTripSafe,
    confirmArrived: confirmTripArrived,
    extendEta,
    dismissDialog: dismissTripDialog,
  } = useOverdueTrips();
  
  // Check for delayed trips and send push notifications - calls edge function
  useDelayedTripChecker();
  
  // Alert when delayed travelers haven't updated location in 30+ minutes (excludes flights)
  useInactiveDelayedTripsAlert();
  
  // Emergency contact notification
  const { notifyEmergencyContacts } = useEmergencyNotification();
  
  // Internal messages - unread count and last sender
  const { 
    unreadCount: unreadMessageCount, 
    lastUnreadSender, 
    bannerDismissed: messagesBannerDismissed,
    dismissBanner: dismissMessagesBanner,
    clave100Alert,
    dismissClave100
  } = useInternalMessages();
  
  // New user notifications
  useNewUserNotification();
  
  // Background sync - keeps data fresh every 2 minutes
  useBackgroundSync();
  
  // Background connection manager - keeps realtime connections alive
  const { isConnected: isBackgroundConnected } = useBackgroundConnection();
  
  // Background location tracking
  const { isTracking: isBackgroundTracking, startTracking: startBackgroundTracking } = useBackgroundLocation();
  
  // Start background location when user is authenticated
  useEffect(() => {
    if (user && !isBackgroundTracking) {
      startBackgroundTracking();
    }
  }, [user, isBackgroundTracking, startBackgroundTracking]);

  // Push notifications (browser)
  const { showEarthquakeNotification, requestPermission, permission } = usePushNotifications();
  
  // Web Push subscription for background notifications
  const { isSupported: webPushSupported, isSubscribed, subscribe: subscribeToPush } = useWebPushSubscription();
  
  // Status check-in timer
  const { 
    shouldPrompt: showCheckinPrompt, 
    recordEarthquakeAlert, 
    confirmSafe, 
    dismissPrompt,
    getTimeSinceEarthquake 
  } = useStatusCheckin();
  
  // Request notification permission and register web push on mount
  useEffect(() => {
    if (permission === 'default') {
      requestPermission();
    }
    
    // Register service worker for periodic background sync
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'REGISTER_PERIODIC_SYNC' });
    }
  }, [permission, requestPermission]);
  
  // Auto-subscribe to web push when notifications are granted
  useEffect(() => {
    if (webPushSupported && permission === 'granted' && !isSubscribed) {
      subscribeToPush().then(success => {
        if (success) {
          console.log('[App] Web Push subscription registered');
        }
      });
    }
  }, [webPushSupported, permission, isSubscribed, subscribeToPush]);
  
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
      map: <MapScreen className="h-[calc(100vh-120px)]" respondersToMyAlerts={respondersToMyAlerts} onNavigateToSettings={() => setActiveTab('settings')} />,
      transit: <TransitScreen userRole={userRole} />,
      alerts: <AlertsScreen userRole={userRole} />,
      community: <CommunityScreen />,
      market: <MarketScreen userRole={userRole} />,
      status: <StatusScreen userRole={userRole} />,
      settings: <SettingsScreen onLogout={handleLogout} />,
    };

    return (
      <div key={activeTab} className="animate-fade-in h-full">
        {screens[activeTab] || screens.map}
      </div>
    );
  };

  return (
    <div className="min-h-screen min-h-dvh bg-background flex flex-col overflow-x-hidden">
      <AppHeader
        onPanicClick={() => setPanicOpen(true)}
        unreadMessageCount={unreadMessageCount}
        onOpenMessages={() => {
          setMessagingUserId(null);
          setMessagingUserName(null);
          setMessagingOpen(true);
        }}
      />
      <QuakeDamageBanner />
      <ActiveAlertBanner 
        testAlert={testAlert} 
        onClearTestAlert={clearTestAlert} 
        refreshTrigger={alertRefreshTrigger}
        responderCount={allMyResponders.filter(r => !r.arrived_at).length}
        onViewResponders={() => setShowResponderMap(true)}
        onMessageResponder={handleOpenMessaging}
        responders={allMyResponders.map(r => ({ user_id: r.user_id, nickname: r.nickname }))}
      />
      <UpdatePrompt />
      <UpdateIndicator />
      <main className="main-content flex-1 overflow-y-auto overflow-x-hidden">{renderScreen()}</main>
      <PanicButton userRole={userRole} isOpen={panicOpen} onOpenChange={setPanicOpen} onPanicTriggered={handlePanicTriggered} />
      
      {/* Unread Messages Banner */}
      {!messagesBannerDismissed && unreadMessageCount > 0 && (
        <UnreadMessagesBanner
          unreadCount={unreadMessageCount}
          senderName={lastUnreadSender?.name}
          onOpen={() => {
            if (lastUnreadSender) {
              handleOpenMessaging(lastUnreadSender.id, lastUnreadSender.name);
            } else {
              setMessagingOpen(true);
            }
          }}
          onDismiss={dismissMessagesBanner}
        />
      )}

      <InstallPrompt />
      <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} isRescatista={userRole === 'SOS_ACTIVO' || userRole === 'EX_SOS'} disasterMode={disasterMode} messageCount={unreadMessageCount} />
      
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

      {/* Trip Safety Check Dialog - shown when trip is 30+ min overdue */}
      <TripSafetyCheckDialog
        trip={overdueTrip}
        onConfirmSafe={confirmTripSafe}
        onConfirmArrived={confirmTripArrived}
        onExtendEta={extendEta}
        onDismiss={dismissTripDialog}
        isUpdating={isUpdatingTrip}
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
        onMessageCreator={(userId, userName) => {
          handleOpenMessaging(userId, userName);
          dismissLatestAlert();
        }}
      />

      {/* Visual overlay when a rescuer starts responding to user's alert */}
      <ResponderComingOverlay
        isVisible={!!activeNewResponder}
        responder={activeNewResponder}
        onDismiss={dismissNewResponder}
        onViewOnMap={() => {
          setShowResponderMap(true);
          dismissNewResponder();
        }}
      />

      {/* Real-time responder tracking map */}
      {activeAlertLocation && (
        <ResponderTrackingMap
          isOpen={showResponderMap}
          onClose={() => setShowResponderMap(false)}
          alertLat={activeAlertLocation.lat}
          alertLng={activeAlertLocation.lng}
          responders={allMyResponders}
          onNavigate={() => {
            if (activeAlertLocation) {
              window.open(`https://maps.google.com/maps?q=${activeAlertLocation.lat},${activeAlertLocation.lng}`, '_blank');
            }
          }}
          onMessageResponder={handleOpenMessaging}
        />
      )}
      
      {/* Internal Messaging Modal */}
      {messagingOpen && (
        <InternalMessaging
          isOpen={messagingOpen}
          onClose={() => setMessagingOpen(false)}
          initialUserId={messagingUserId}
          initialUserName={messagingUserName}
        />
      )}
      
      {/* Clave 100 Emergency Overlay */}
      <Clave100Overlay
        isVisible={!!clave100Alert?.isVisible}
        senderName={clave100Alert?.senderName || 'Usuario'}
        message={clave100Alert?.message || ''}
        onDismiss={dismissClave100}
        onOpenChat={() => {
          if (clave100Alert?.senderId) {
            handleOpenMessaging(clave100Alert.senderId, clave100Alert.senderName);
          }
        }}
      />

    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <InternalMessagesProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/install" element={<InstallPage />} />
            <Route path="/trip/:shareToken" element={<SharedTripPage />} />
            <Route path="/" element={<AppContent />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </InternalMessagesProvider>
      <Toaster />
      <Sonner />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
