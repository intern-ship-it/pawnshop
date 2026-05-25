/**
 * MainLayout - Main application layout with authentication check
 */

import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router";
import { useAppSelector, useAppDispatch } from "@/app/hooks";
import { fetchCurrentUser, logoutSuccess } from "@/features/auth/authSlice";
import authService from "@/services/authService";
import { cn } from "@/lib/utils";
import Sidebar from "./Sidebar";
import Header from "./Header";
import Toast from "@/components/common/Toast";
import { GlobalCameraModal, Breadcrumb } from "@/components/common";
import UpdateBanner from "@/components/common/UpdateBanner";
import { useVersionCheck } from "@/hooks/useVersionCheck";
import { Loader2 } from "lucide-react";
import { addToast, setSettings } from "@/features/ui/uiSlice";
import settingsService from "@/services/settingsService";
import dayEndService from "@/services/dayEndService";

export default function MainLayout() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const {
    isAuthenticated,
    user,
    loading: authLoading,
  } = useAppSelector((state) => state.auth);
  const { sidebarCollapsed, toasts } = useAppSelector((state) => state.ui);

  const [isVerifying, setIsVerifying] = useState(true);

  // Version check for app updates
  const { updateAvailable, newVersion, applyUpdate, dismissUpdate } =
    useVersionCheck();

  useEffect(() => {
    const verifyAuth = async () => {
      const hasToken = authService.isAuthenticated();

      // No token at all - redirect to login
      if (!hasToken) {
        setIsVerifying(false);
        navigate("/login", { replace: true });
        return;
      }

      // Always fetch fresh user data from backend to get latest permissions
      try {
        const response = await dispatch(fetchCurrentUser()).unwrap();
        if (response) {
          // Token is valid - user is set by fetchCurrentUser.fulfilled in Redux
          // Also update localStorage so next refresh has fresh data
          const storage = localStorage.getItem("pawnsys_remember") === "true"
            ? localStorage
            : sessionStorage;
          storage.setItem("pawnsys_user", JSON.stringify(response));
          setIsVerifying(false);
          return;
        }
      } catch (error) {
        console.warn("Token verification failed:", error);
        authService.clearLocalAuth();
        dispatch(logoutSuccess());
        navigate("/login", { replace: true });
        return;
      }

      setIsVerifying(false);
    };

    verifyAuth();
  }, [dispatch, navigate]);

  // Fetch settings from API on startup (only once when authenticated)
  useEffect(() => {
    const loadSettings = async () => {
      const hasToken = authService.isAuthenticated();
      if (!hasToken || !isAuthenticated) return;

      try {
        const response = await settingsService.getAll();
        if (response.success && response.data) {
          // Transform API data
          const companyData = response.data.company || [];
          const companyMap = {};
          companyData.forEach((s) => {
            companyMap[s.key_name] = s.value;
          });

          dispatch(
            setSettings({
              company: {
                name: companyMap.name || "PawnSys",
                license: companyMap.registration_no || "",
              },
            }),
          );
        }
      } catch (error) {
        // Silently ignore errors during logout
        if (!error.silent) {
          console.error("Failed to load settings:", error);
        }
      }
    };

    // Only load settings once when the user becomes authenticated
    // Don't reload when isAuthenticated changes to false (logout)
    if (isAuthenticated && user) {
      loadSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, dispatch]); // Only depend on user and dispatch, not isAuthenticated

  // Auto-open today's day-end report (admin only; backend gates).
  // Backend is idempotent. On every fresh browser session, show a notification
  // so the user knows the day is active and can adjust opening balance if needed.
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    dayEndService
      .ensureOpen()
      .then((res) => {
        if (!res?.success || !res?.data?.report) return;

        // Notify once per browser session that the day is active for today.
        const today = new Date().toISOString().split("T")[0];
        const notifyKey = `dayend_notified_${today}`;
        if (sessionStorage.getItem(notifyKey)) return;
        sessionStorage.setItem(notifyKey, "1");

        const report = res.data.report;
        const opening = parseFloat(report.opening_balance) || 0;
        const wasJustCreated = res.data.created === true;

        dispatch(
          addToast({
            type: "info",
            title: wasJustCreated ? "Day auto-opened" : "Day is open",
            message: `Today's opening balance: RM ${opening.toFixed(2)}${
              wasJustCreated ? " (carried from yesterday's closing)" : ""
            }. You can adjust it from the Day End page.`,
            duration: 8000,
          }),
        );
      })
      .catch((err) => {
        console.warn("[Auto-open] failed:", err?.message || err);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user]);

  if (isVerifying || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-zinc-500">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && !authService.isAuthenticated()) {
    return null;
  }

  return (
    <div className="min-h-screen bg-stone-100">
      {/* Version Update Banner */}
      <UpdateBanner
        show={updateAvailable}
        version={newVersion}
        onUpdate={applyUpdate}
        onDismiss={dismissUpdate}
      />

      <Sidebar />

      <div
        className={cn(
          "min-h-screen transition-all duration-300",
          sidebarCollapsed ? "ml-20" : "ml-64",
        )}
      >
        <Header />

        <main className="pt-16">
          <div className="p-4 lg:p-6">
            <Breadcrumb />
            <Outlet />
          </div>
        </main>
      </div>

      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} />
        ))}
      </div>

      <GlobalCameraModal />
    </div>
  );
}
