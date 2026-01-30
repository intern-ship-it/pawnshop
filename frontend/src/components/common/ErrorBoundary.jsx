import { useRouteError } from "react-router";
import { Button } from "./index";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ErrorBoundary() {
  const error = useRouteError();
  console.error(error);

  const isChunkError =
    error?.message?.includes("Failed to fetch dynamically imported module") ||
    error?.message?.includes("Importing a module script failed");

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-amber-600" />
        </div>

        {isChunkError ? (
          <>
            <h1 className="text-xl font-bold text-zinc-800 mb-2">
              New Version Available
            </h1>
            <p className="text-zinc-600 mb-6">
              The application has been updated. Please refresh the page to load
              the latest version.
            </p>
            <Button
              variant="primary"
              className="w-full justify-center"
              onClick={() => window.location.reload()}
              leftIcon={RefreshCw}
            >
              Refresh Page
            </Button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-zinc-800 mb-2">
              Oops! Something went wrong
            </h1>
            <p className="text-zinc-600 mb-6 text-sm">
              {error?.message || "An unexpected error occurred."}
            </p>
            <div className="flex flex-col gap-3">
              <Button
                variant="primary"
                className="w-full justify-center"
                onClick={() => window.location.reload()}
                leftIcon={RefreshCw}
              >
                Reload Page
              </Button>
              <Button
                variant="outline"
                className="w-full justify-center"
                onClick={() => (window.location.href = "/")}
              >
                Go to Dashboard
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
