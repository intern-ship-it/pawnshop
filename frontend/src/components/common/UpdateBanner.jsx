/**
 * UpdateBanner - Shows notification when new version is available
 */

import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, X, Sparkles } from "lucide-react";

export default function UpdateBanner({ show, version, onUpdate, onDismiss }) {
  if (!show) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 shadow-lg"
        >
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 bg-white/20 rounded-full">
                  <Sparkles className="w-4 h-4 text-amber-900" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-900">
                    Versi Baru Tersedia / New Version Available
                    {version && (
                      <span className="ml-2 px-2 py-0.5 bg-amber-900/20 rounded text-xs">
                        v{version}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-amber-800">
                    Muat semula untuk mendapatkan ciri terkini / Refresh to get
                    latest features
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={onUpdate}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-900 text-white rounded-lg text-sm font-medium hover:bg-amber-800 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span className="hidden sm:inline">
                    Muat Semula / Refresh
                  </span>
                  <span className="sm:hidden">Refresh</span>
                </button>

                <button
                  onClick={onDismiss}
                  className="p-2 text-amber-900/70 hover:text-amber-900 hover:bg-amber-600/20 rounded-lg transition-colors"
                  title="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
