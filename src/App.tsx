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
import ResourcesScreen from '@/pages/ResourcesScreen';

import InstallPage from '@/pages/InstallPage';
import SharedTripPage from '@/pages/SharedTripPage';
import UserGuidePage from '@/pages/UserGuidePage';
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
import { TravelerLocationDialog } from '@/components/TravelerLocationDialog';
import { DrillAlertBanner } from '@/components/DrillAlertBanner';
import { CommunityChat } from '@/components/CommunityChat';

import { StatusCheckinPrompt } from '@/components/StatusCheckinPrompt';
import { Clave100CheckinPrompt } from '@/components/Clave100CheckinPrompt';
import { ReopenCheckinButton } from '@/components/ReopenCheckinButton';
import { OnboardingTutorial } from '@/components/OnboardingTutorial';
import { ComprehensiveTutorial } from '@/components/ComprehensiveTutorial';
import { FloatingHelpButton } from '@/components/FloatingHelpButton';
import { useAppState } from '@/hooks/useRealtime';
import { useLocation } from '@/hooks/useLocation';
import { useEarthquakeDetection } from '@/hooks/useEarthquakeDetection';
import { useSkyAlertAlerts } from '@/hooks/useSkyAlertAlerts';
import { useEarthquakeHistory } from '@/hooks/useEarthquakeHistory';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useStatusCheckin } from '@/hooks/useStatusCheckin';
import { useAuth } from '@/hooks/useAuth';
import { usePanicAlerts } from '@/hooks/usePanicAlerts';
import { useMyAlertResponders } from '@/hooks/useMyAlertResponders';
import { useMyPanicResponders } from '@/hooks/useMyPanicResponders';
import { useTestMode } from '@/hooks/useTestMode';
import { useBackgroundSync } from '@/hooks/useBackgroundSync';
import { useAutoUpdate } from '@/hooks/useAutoUpdate';
import { useOverdueTrips } from '@/hooks/useOverdueTrips';
import { useDelayedTripChecker } from '@/hooks/useDelayedTripChecker';
import { useInactiveDelayedTripsAlert } from '@/hooks/useInactiveDelayedTripsAlert';
import { useAutoArrivalDetection } from '@/hooks/useAutoArrivalDetection';
import { useEmergencyNotification } from '@/hooks/useEmergencyNotification';
import { useInternalMessages } from '@/hooks/useInternalMessages';
import { InternalMessagesProvider } from '@/providers/InternalMessagesProvider';
import { useNewUserNotification } from '@/hooks/useNewUserNotification';
import { useWebPushSubscription } from '@/hooks/useWebPushSubscription';
import { useBackgroundConnection } from '@/hooks/useBackgroundConnection';
import { useAutoWakeLock } from '@/hooks/useWakeLock';
import { useBackgroundLocation } from '@/hooks/useBackgroundLocation';
import { useAppLifecycle } from '@/hooks/useAppLifecycle';
import { usePrefetch } from '@/hooks/usePrefetch';
import { useIOSKeyboardFix } from '@/hooks/useIOSKeyboardFix';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { UserRole, USGSEarthquake, PanicType } from '@/types';

const queryClient = new QueryClient();

function AppContent() {
  // Auto-update on app entry
  useAutoUpdate();
  
  const [showSplash, setShowSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showComprehensiveTutorial, setShowComprehensiveTutorial] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('map');
  const [userRole] = useState<UserRole>('SOS_ACTIVO');
  
  // Use the auth hook to check for existing session
  const { user, profile, loading: authLoading, signOut, refetchProfile } = useAuth();
  
  // Determine authentication state
  const isAuthenticated = !!user;
  const isProfileComplete = !!profile;

  // Handle new user onboarding - show comprehensive tutorial for new users
  // Check database for disclaimer acceptance, not just localStorage
  useEffect(() => {
    if (isAuthenticated && isProfileComplete && profile) {
      // Check if disclaimer was accepted in database
      const disclaimerAccepted = !!profile.tutorial_disclaimer_accepted_at;
      
      if (!disclaimerAccepted) {
        // Force tutorial if disclaimer not accepted in database
        setIsNewUser(true);
        setShowComprehensiveTutorial(true);
      } else {
        // Sync localStorage with database state
        localStorage.setItem('comprehensive-tutorial-complete', 'true');
      }
    }
  }, [isAuthenticated, isProfileComplete, profile]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    setIsNewUser(false);
    localStorage.setItem('onboarding-complete', 'true');
  };

  const handleComprehensiveTutorialComplete = () => {
    setShowComprehensiveTutorial(false);
    setIsNewUser(false);
    localStorage.setItem('comprehensive-tutorial-complete', 'true');
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
  // IMPORTANT: AppContent and AuthGate each call useAuth() (separate state instances).
  // We bridge them via onAuthComplete so AppContent refreshes its profile state after registration.
  if (!isAuthenticated || !isProfileComplete) {
    return <AuthGate onAuthComplete={refetchProfile} />;
  }

  // Show onboarding for new users (legacy - short version)
  if (showOnboarding) {
    return <OnboardingTutorial onComplete={handleOnboardingComplete} />;
  }

  // Show comprehensive tutorial for new users
  if (showComprehensiveTutorial) {
    return (
      <ComprehensiveTutorial 
        onComplete={handleComprehensiveTutorialComplete} 
        onClose={handleComprehensiveTutorialComplete} 
      />
    );
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
  
  // iOS keyboard fix - prevents footer from moving when keyboard opens
  useIOSKeyboardFix();
  
  // App lifecycle - handles pause/resume on native (Android/iOS)
  // This ensures session and connections are restored when returning to the app
  const { isActive: isAppActive, lastResumeAt } = useAppLifecycle();
  
  // Prefetch critical data in parallel as soon as user is authenticated
  // Re-prefetch when app resumes from background
  usePrefetch(user?.id, lastResumeAt);
  // Test mode for simulating panic alerts
  const { testAlert, simulatePanicAlert, clearTestAlert } = useTestMode();
  
  // Real-time panic alerts from other users
  const { recentAlerts, unreadCount, latestEmergencyAlert, dismissLatestAlert } = usePanicAlerts();
  
  // Keep screen awake ALWAYS while app is open (user requirement)
  // This prevents screen from turning off due to inactivity
  const wakeLockStatus = useAutoWakeLock(true);
  
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
  
  // State for community chat modal
  const [communityChatOpen, setCommunityChatOpen] = useState(false);
  const [communityChatContext, setCommunityChatContext] = useState<{ type: 'general' | 'clave100' | 'drill'; id?: string; title?: string }>({ type: 'general' });
  
  // State for active Clave 100 drill (for check-in prompt and map markers)
  const [activeDrillId, setActiveDrillId] = useState<string | null>(null);
  const [showClave100Checkin, setShowClave100Checkin] = useState(false);
  
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
  const { 
    pendingInactiveTrip, 
    dismissInactiveTrip 
  } = useInactiveDelayedTripsAlert();
  
  // Auto-detect arrival at destination via GPS and mark trip as completed
  useAutoArrivalDetection();
  
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
  const { 
    showEarthquakeNotification, 
    showMajorSSNQuakeNotification,
    requestPermission, 
    permission 
  } = usePushNotifications();
  
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
  
  // Location - declared first so it can be used in callbacks
  const { position } = useLocation();
  
  // Callback for when earthquake is detected nearby (USGS - only notification, no report dialog)
  const handleEarthquakeDetected = useCallback((earthquake: USGSEarthquake, distanceKm: number) => {
    // Show push notification (works even in background tabs)
    showEarthquakeNotification(earthquake, distanceKm);
    // Record for status check-in timer
    recordEarthquakeAlert(earthquake.id);
  }, [showEarthquakeNotification, recordEarthquakeAlert]);
  
  // State to hold major SSN quake for the SeismicAlert dialog (only SSN ≥6.0)
  const [majorSSNQuake, setMajorSSNQuake] = useState<{ earthquake: USGSEarthquake; distanceKm: number } | null>(null);
  
  // Callback for major SSN earthquakes (≥6.0) - alerts everyone regardless of distance
  // ONLY these earthquakes will trigger the SeismicAlert report dialog
  const handleMajorSSNQuake = useCallback((earthquake: USGSEarthquake) => {
    console.log(`[App] 🚨 Major SSN earthquake alert: M${earthquake.properties.mag}`);
    // Show special notification for major quakes
    showMajorSSNQuakeNotification(earthquake);
    // Play urgent alert sound
    import('@/lib/alertSound').then(({ playUrgentAlert }) => playUrgentAlert());
    // Show toast notification as well
    toast.error(`🚨 SISMO M${earthquake.properties.mag.toFixed(1)}`, {
      description: earthquake.properties.place || 'México',
      duration: 15000,
    });
    // Record for status check-in timer
    recordEarthquakeAlert(earthquake.id);
    
    // Calculate distance from epicenter to user position (if available)
    let calculatedDistance = 0;
    if (position) {
      const [lng, lat] = earthquake.geometry.coordinates;
      const { calculateDistance } = require('@/hooks/useLocation');
      calculatedDistance = calculateDistance(position.lat, position.lng, lat, lng);
    }
    
    // Set for the SeismicAlert dialog - ONLY SSN quakes ≥6.0 trigger report dialog
    setMajorSSNQuake({ earthquake, distanceKm: calculatedDistance });
  }, [showMajorSSNQuakeNotification, recordEarthquakeAlert, position]);
  
  // Monitor earthquake history for major SSN quakes
  useEarthquakeHistory(position, {
    onMajorSSNQuake: handleMajorSSNQuake,
  });
  
  // USGS earthquake detection by distance - only for notifications (no report dialog)
  const { dismissAlert: dismissUSGSAlert, nearbyQuake } = useEarthquakeDetection(
    position,
    handleEarthquakeDetected
  );

  // SkyAlert monitoring for bottom navigation animation
  const { isActive: hasSkyAlertActive } = useSkyAlertAlerts();
  
  // Combine all seismic alert sources for bottom nav animation
  const hasActiveSeismicAlert = hasSkyAlertActive || !!majorSSNQuake || !!nearbyQuake;

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
      const { data: insertedEvent, error } = await supabase.from('panic_events').insert({
        user_id: user.id,
        panic_type: type,
        lat,
        lng,
        message: message || null,
        audio_url: audioUrl || null,
        audio_duration_ms: audioDurationMs || null,
        resolved: false,
      }).select('id').single();

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
        
        // Broadcast push notification to all registered users
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('nickname, full_name')
            .eq('id', user.id)
            .single();
          
          const creatorName = profile?.nickname || profile?.full_name || null;
          
          const { data: session } = await supabase.auth.getSession();
          if (session?.session?.access_token && insertedEvent?.id) {
            fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-panic-broadcast`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.session.access_token}`,
              },
              body: JSON.stringify({
                panicEventId: insertedEvent.id,
                panicType: type,
                creatorName,
                message,
                lat,
                lng,
              }),
            }).then(res => {
              if (res.ok) {
                console.log('[handlePanicTriggered] Push broadcast sent successfully');
              } else {
                console.warn('[handlePanicTriggered] Push broadcast failed:', res.status);
              }
            }).catch(err => {
              console.warn('[handlePanicTriggered] Push broadcast error:', err);
            });
          }
        } catch (pushErr) {
          console.warn('[handlePanicTriggered] Error sending push broadcast:', pushErr);
          // Don't fail the main flow if push fails
        }
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
      map: <MapScreen className="h-[calc(100vh-120px)]" respondersToMyAlerts={respondersToMyAlerts} onNavigateToSettings={() => setActiveTab('settings')} activeDrillId={activeDrillId} onOpenDrillChat={(drillId) => { setCommunityChatContext({ type: 'drill', id: drillId, title: '🔔 Chat Clave 100' }); setCommunityChatOpen(true); }} />,
      transit: <TransitScreen userRole={userRole} onOpenMessaging={handleOpenMessaging} />,
      alerts: <AlertsScreen userRole={userRole} />,
      community: <CommunityScreen />,
      market: <MarketScreen userRole={userRole} />,
      resources: <ResourcesScreen />,
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
        onOpenClave100Chat={() => {
          // If a drill is active, default to drill chat; otherwise open the permanent Clave 100 room
          if (activeDrillId) {
            setCommunityChatContext({ type: 'drill', id: activeDrillId, title: '🔔 Chat Simulacro' });
          } else {
            setCommunityChatContext({ type: 'clave100', title: '🚨 Chat CLAVE 100' });
          }
          setCommunityChatOpen(true);
        }}
        onOpenMessages={() => {
          setMessagingUserId(null);
          setMessagingUserName(null);
          setMessagingOpen(true);
        }}
        wakeLockStatus={wakeLockStatus}
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
      
      {/* Unread Messages Banner - only show when chat modal is NOT open */}
      {!messagingOpen && !messagesBannerDismissed && unreadMessageCount > 0 && (
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

      {/* Drill Alert Banner - shows during active drills */}
      <DrillAlertBanner 
        onOpenCommunityChat={(drillId) => {
          setCommunityChatContext({ type: 'drill', id: drillId, title: '🔔 Chat Simulacro' });
          setCommunityChatOpen(true);
        }}
        onActiveDrillChange={(drillId) => {
          setActiveDrillId(drillId);
          if (drillId) {
            // Show check-in prompt when drill becomes active
            setShowClave100Checkin(true);
          }
        }}
      />

      {/* Clave 100 Check-in Prompt - shows during drills (always visible, even when chat is open) */}
      {showClave100Checkin && activeDrillId && (
        <Clave100CheckinPrompt
          drillId={activeDrillId}
          isDrill={true}
          onClose={() => setShowClave100Checkin(false)}
        />
      )}

      {/* Floating button to reopen check-in prompt if closed during active drill */}
      {!showClave100Checkin && activeDrillId && (
        <ReopenCheckinButton
          isDrill={true}
          onClick={() => setShowClave100Checkin(true)}
        />
      )}

      <InstallPrompt />
      <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} isRescatista={userRole === 'SOS_ACTIVO' || userRole === 'EX_SOS'} disasterMode={disasterMode} messageCount={unreadMessageCount} hasActiveSeismicAlert={hasActiveSeismicAlert} />
      
      {/* Seismic Alert Dialog - ONLY for SSN earthquakes ≥6.0 */}
      {majorSSNQuake && position && (
        <SeismicAlert
          earthquake={majorSSNQuake.earthquake}
          distanceKm={majorSSNQuake.distanceKm}
          position={position}
          userRole={userRole}
          onDismiss={() => setMajorSSNQuake(null)}
          onReported={() => setMajorSSNQuake(null)}
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
      
      {/* Inactive Delayed Trip Location Dialog */}
      {pendingInactiveTrip && (
        <TravelerLocationDialog
          isOpen={!!pendingInactiveTrip}
          onClose={dismissInactiveTrip}
          userId={pendingInactiveTrip.userId}
          onSendMessage={() => {
            handleOpenMessaging(pendingInactiveTrip.userId, pendingInactiveTrip.nickname);
            dismissInactiveTrip();
          }}
        />
      )}
      
      {/* Clave 100 Emergency Overlay */}
      <Clave100Overlay
        isVisible={!!clave100Alert?.isVisible}
        senderName={clave100Alert?.senderName || 'Usuario'}
        message={clave100Alert?.message || ''}
        imageUrl={clave100Alert?.imageUrl}
        audioUrl={clave100Alert?.audioUrl}
        audioDurationMs={clave100Alert?.audioDurationMs}
        onDismiss={dismissClave100}
        onOpenChat={() => {
          // Open community chat for Clave 100 instead of individual chat
          setCommunityChatContext({ type: 'clave100', title: '🚨 Chat CLAVE 100' });
          setCommunityChatOpen(true);
          dismissClave100();
        }}
      />
      
      {/* Community Chat - opens during drills and Clave 100 */}
      <CommunityChat
        isOpen={communityChatOpen}
        onClose={() => setCommunityChatOpen(false)}
        contextType={communityChatContext.type}
        contextId={communityChatContext.id}
        title={communityChatContext.title || 'Chat Comunidad'}
      />

      {/* Floating Help Button - Always accessible */}
      <FloatingHelpButton />

    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <Routes>
          {/* Public pages - outside of InternalMessagesProvider to avoid auth blocking */}
          <Route path="/install" element={<InstallPage />} />
          <Route path="/trip/:shareToken" element={<SharedTripPage />} />
          <Route path="/guia" element={<UserGuidePage />} />
          {/* Main app with internal messages provider */}
          <Route path="/" element={
            <InternalMessagesProvider>
              <AppContent />
            </InternalMessagesProvider>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
      <Sonner />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
