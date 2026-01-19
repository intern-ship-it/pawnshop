/**
 * Barcode Scanner Detection Hook
 * 
 * Detects barcode scanner input by measuring keystroke timing.
 * Barcode scanners type much faster than humans (< 50ms between keystrokes).
 * 
 * Usage:
 * const { inputRef, isScanning, lastScannedCode } = useBarcodeScanner({
 *   onScan: (barcode) => console.log('Scanned:', barcode),
 *   minLength: 3,
 * });
 * 
 * <input ref={inputRef} placeholder="Scan barcode..." />
 */

import { useRef, useState, useCallback, useEffect } from 'react';

const DEFAULT_OPTIONS = {
    // Minimum characters to consider a valid barcode
    minLength: 3,
    // Maximum time between keystrokes to be considered scanner input (ms)
    maxTimeBetweenKeystrokes: 50,
    // Time to wait for complete barcode (ms)
    scanCompletionDelay: 100,
    // Whether to prevent default form submission on Enter
    preventSubmit: true,
    // Callback when barcode is scanned
    onScan: null,
    // Callback on scan error
    onError: null,
    // Play beep sound on scan
    playSound: true,
};

export function useBarcodeScanner(options = {}) {
    const config = { ...DEFAULT_OPTIONS, ...options };

    const inputRef = useRef(null);
    const bufferRef = useRef('');
    const lastKeyTimeRef = useRef(0);
    const timeoutRef = useRef(null);

    const [isScanning, setIsScanning] = useState(false);
    const [lastScannedCode, setLastScannedCode] = useState(null);
    const [scanCount, setScanCount] = useState(0);

    // Play beep sound
    const playBeep = useCallback(() => {
        if (!config.playSound) return;

        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 1800;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.1;

            oscillator.start();
            setTimeout(() => {
                oscillator.stop();
                audioContext.close();
            }, 100);
        } catch (e) {
            // Audio not supported
        }
    }, [config.playSound]);

    // Process the scanned barcode
    const processBarcode = useCallback((barcode) => {
        if (barcode.length >= config.minLength) {
            setLastScannedCode(barcode);
            setScanCount(prev => prev + 1);
            playBeep();

            if (config.onScan) {
                config.onScan(barcode);
            }

            return true;
        }
        return false;
    }, [config.minLength, config.onScan, playBeep]);

    // Clear the buffer
    const clearBuffer = useCallback(() => {
        bufferRef.current = '';
        setIsScanning(false);
    }, []);

    // Handle keydown events
    const handleKeyDown = useCallback((event) => {
        const currentTime = Date.now();
        const timeDiff = currentTime - lastKeyTimeRef.current;
        lastKeyTimeRef.current = currentTime;

        // Clear any existing timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Handle Enter key - possibly end of barcode
        if (event.key === 'Enter') {
            const scannedCode = bufferRef.current.trim();

            if (scannedCode.length >= config.minLength) {
                // This looks like a barcode scan
                if (config.preventSubmit) {
                    event.preventDefault();
                }

                processBarcode(scannedCode);
                clearBuffer();
                return;
            }

            // Not a barcode, allow normal Enter behavior
            clearBuffer();
            return;
        }

        // Ignore non-printable characters
        if (event.key.length !== 1) {
            return;
        }

        // Check if typing speed indicates scanner input
        if (timeDiff < config.maxTimeBetweenKeystrokes || bufferRef.current === '') {
            // Fast input - likely scanner
            bufferRef.current += event.key;

            if (bufferRef.current.length >= 2) {
                setIsScanning(true);
            }
        } else {
            // Slow input - likely human, reset buffer
            bufferRef.current = event.key;
            setIsScanning(false);
        }

        // Set timeout to clear buffer if no more input
        timeoutRef.current = setTimeout(() => {
            // If we have a substantial buffer, try to process it
            if (bufferRef.current.length >= config.minLength) {
                processBarcode(bufferRef.current.trim());
            }
            clearBuffer();
        }, config.scanCompletionDelay);
    }, [config, processBarcode, clearBuffer]);

    // Attach/detach event listeners
    useEffect(() => {
        const input = inputRef.current;
        if (!input) return;

        input.addEventListener('keydown', handleKeyDown);

        return () => {
            input.removeEventListener('keydown', handleKeyDown);
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [handleKeyDown]);

    // Reset function
    const reset = useCallback(() => {
        setLastScannedCode(null);
        setScanCount(0);
        clearBuffer();
    }, [clearBuffer]);

    return {
        inputRef,
        isScanning,
        lastScannedCode,
        scanCount,
        reset,
    };
}

/**
 * Global barcode scanner listener
 * Use when you want to detect scans anywhere on the page
 */
export function useGlobalBarcodeScanner(options = {}) {
    const config = { ...DEFAULT_OPTIONS, ...options };

    const bufferRef = useRef('');
    const lastKeyTimeRef = useRef(0);
    const timeoutRef = useRef(null);

    const [isScanning, setIsScanning] = useState(false);
    const [lastScannedCode, setLastScannedCode] = useState(null);

    // Play beep sound
    const playBeep = useCallback(() => {
        if (!config.playSound) return;

        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 1800;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.1;

            oscillator.start();
            setTimeout(() => {
                oscillator.stop();
                audioContext.close();
            }, 100);
        } catch (e) {
            // Audio not supported
        }
    }, [config.playSound]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            // Ignore if typing in input/textarea
            const activeElement = document.activeElement;
            if (activeElement && ['INPUT', 'TEXTAREA'].includes(activeElement.tagName)) {
                return;
            }

            const currentTime = Date.now();
            const timeDiff = currentTime - lastKeyTimeRef.current;
            lastKeyTimeRef.current = currentTime;

            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            if (event.key === 'Enter') {
                const scannedCode = bufferRef.current.trim();

                if (scannedCode.length >= config.minLength) {
                    event.preventDefault();
                    setLastScannedCode(scannedCode);
                    playBeep();

                    if (config.onScan) {
                        config.onScan(scannedCode);
                    }
                }

                bufferRef.current = '';
                setIsScanning(false);
                return;
            }

            if (event.key.length !== 1) {
                return;
            }

            if (timeDiff < config.maxTimeBetweenKeystrokes || bufferRef.current === '') {
                bufferRef.current += event.key;
                if (bufferRef.current.length >= 2) {
                    setIsScanning(true);
                }
            } else {
                bufferRef.current = event.key;
                setIsScanning(false);
            }

            timeoutRef.current = setTimeout(() => {
                bufferRef.current = '';
                setIsScanning(false);
            }, config.scanCompletionDelay);
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [config, playBeep]);

    return {
        isScanning,
        lastScannedCode,
    };
}

export default useBarcodeScanner;
