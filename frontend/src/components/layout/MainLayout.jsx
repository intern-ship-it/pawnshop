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
import { Loader2 } from "lucide-react";

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

  useEffect(() => {
    const verifyAuth = async () => {
      const hasToken = authService.isAuthenticated();
      const storedUser = authService.getStoredUser();

      if (!hasToken) {
        setIsVerifying(false);
        navigate("/login", { replace: true });
        return;
      }

      if (isAuthenticated && user) {
        setIsVerifying(false);
        return;
      }

      if (storedUser && !user) {
        try {
          const response = await dispatch(fetchCurrentUser()).unwrap();
          if (response) {
            setIsVerifying(false);
            return;
          }
        } catch (error) {
          console.warn("Token verification failed:", error);
          authService.clearLocalAuth();
          dispatch(logoutSuccess());
          navigate("/login", { replace: true });
        }
      }

      setIsVerifying(false);
    };

    verifyAuth();
  }, [dispatch, navigate, isAuthenticated, user]);

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
      <Sidebar />

      <div
        className={cn(
          "min-h-screen transition-all duration-300",
          sidebarCollapsed ? "ml-20" : "ml-64"
        )}
      >
        <Header />

        <main className="pt-16">
          <div className="p-4 lg:p-6">
            <Outlet />
          </div>
        </main>
      </div>

      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} />
        ))}
      </div>
    </div>
  );
}
