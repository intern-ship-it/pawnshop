/**
 * useVersionCheck Hook
 * Proactively checks for new app versions on load and periodically
 * Shows notification when a new version is available
 */

import { useState, useEffect, useCallback } from "react";

const VERSION_CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes
const VERSION_KEY = "pawnsys_app_version";

export function useVersionCheck() {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [newVersion, setNewVersion] = useState(null);

    const checkVersion = useCallback(async () => {
        try {
            // Fetch version.json with cache-busting
            const response = await fetch(`/version.json?t=${Date.now()}`, {
                cache: "no-store",
            });

            if (!response.ok) return;

            const data = await response.json();
            const serverVersion = data.version;
            const storedVersion = localStorage.getItem(VERSION_KEY);

            // First visit - store the version
            if (!storedVersion) {
                localStorage.setItem(VERSION_KEY, serverVersion);
                return;
            }

            // Version changed - show update notification
            if (storedVersion !== serverVersion) {
                setUpdateAvailable(true);
                setNewVersion(serverVersion);
            }
        } catch (error) {
            // Silently fail - version check is non-critical
            console.debug("Version check failed:", error);
        }
    }, []);

    const dismissUpdate = useCallback(() => {
        if (newVersion) {
            localStorage.setItem(VERSION_KEY, newVersion);
        }
        setUpdateAvailable(false);
        setNewVersion(null);
    }, [newVersion]);

    const applyUpdate = useCallback(() => {
        if (newVersion) {
            localStorage.setItem(VERSION_KEY, newVersion);
        }
        window.location.reload();
    }, [newVersion]);

    useEffect(() => {
        // Check on mount
        checkVersion();

        // Check periodically
        const interval = setInterval(checkVersion, VERSION_CHECK_INTERVAL);

        return () => clearInterval(interval);
    }, [checkVersion]);

    return {
        updateAvailable,
        newVersion,
        dismissUpdate,
        applyUpdate,
        checkVersion,
    };
}

export default useVersionCheck;
