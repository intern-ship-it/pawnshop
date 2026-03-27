/**
 * MyKadScanner — React component converted from pawnsys_3d_cardreader_scanner.html
 *
 * Props:
 *   onDataReceived(data) — called when scan completes with:
 *     { name, icNumber, address, gender, race, photo }
 *     (any fields that were populated; unscanned fields are undefined)
 *
 * Usage inside CustomerCreate:
 *   <MyKadScanner onDataReceived={handleScanData} />
 *
 * The component manages its own idle / scanning / success states internally.
 * The parent only needs to handle the onDataReceived callback to fill the form.
 */

import { useState, useEffect, useRef } from "react";
import api from "@/services/api";

/* ─── keyframe CSS injected once ─────────────────────────────────── */
const SCANNER_STYLES = `
@keyframes mks-float{0%,100%{transform:perspective(600px) rotateX(25deg) rotateY(-8deg) translateY(0)}50%{transform:perspective(600px) rotateX(25deg) rotateY(-8deg) translateY(-6px)}}
@keyframes mks-cardSlide{0%{transform:perspective(600px) rotateX(25deg) rotateY(-8deg) translateY(40px) translateX(20px);opacity:0}40%{opacity:1}100%{transform:perspective(600px) rotateX(25deg) rotateY(-8deg) translateY(0) translateX(0)}}
@keyframes mks-scanLine{0%{top:10%}50%{top:85%}100%{top:10%}}
@keyframes mks-ripple{0%{transform:scale(0.3);opacity:0.7}100%{transform:scale(2.2);opacity:0}}
@keyframes mks-particleUp{0%{transform:translateY(0) scale(1);opacity:0.8}100%{transform:translateY(-60px) scale(0);opacity:0}}
@keyframes mks-dotPulse{0%,80%,100%{opacity:0.2}40%{opacity:1}}
@keyframes mks-checkScale{0%{transform:scale(0) rotate(-45deg)}60%{transform:scale(1.15) rotate(0)}100%{transform:scale(1) rotate(0)}}
@keyframes mks-fadeSlideUp{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}
@keyframes mks-orbit{0%{transform:rotate(0deg) translateX(52px) rotate(0deg)}100%{transform:rotate(360deg) translateX(52px) rotate(-360deg)}}
@keyframes mks-chipBlink{0%,100%{opacity:0.4}50%{opacity:1}}
@keyframes mks-dataStream{0%{transform:translateX(-100%);opacity:0}20%{opacity:1}80%{opacity:1}100%{transform:translateX(100%);opacity:0}}
@keyframes mks-progressFill{0%{width:0}100%{width:100%}}
@keyframes mks-fadeIn{0%{opacity:0}100%{opacity:1}}

.mks-card-3d{width:120px;height:76px;background:linear-gradient(145deg,#f0f9ff 0%,#bae6fd 100%);border-radius:8px;position:relative;transform:perspective(600px) rotateX(25deg) rotateY(-8deg);transform-style:preserve-3d;animation:mks-float 3s ease-in-out infinite;box-shadow: 0 4px 12px rgba(0,0,0,0.15), inset 0 1px 1px rgba(255,255,255,0.8)}
.mks-card-entering{animation:mks-cardSlide 0.8s ease-out forwards!important}
.mks-scan-beam{position:absolute;left:5%;right:5%;height:2px;background:linear-gradient(90deg,transparent,#D97706,#EF9F27,#D97706,transparent);animation:mks-scanLine 2.2s ease-in-out infinite;opacity:0.9;border-radius:1px}
.mks-chip-odd{animation:mks-chipBlink 1.6s ease-in-out infinite}
.mks-chip-even{animation:mks-chipBlink 1.6s ease-in-out infinite 0.3s}
.mks-dot-1{animation:mks-orbit 3s linear infinite}
.mks-dot-2{animation:mks-orbit 3s linear infinite 1s}
.mks-dot-3{animation:mks-orbit 3s linear infinite 2s}
.mks-ripple-1{animation:mks-ripple 2.4s ease-out infinite}
.mks-ripple-2{animation:mks-ripple 2.4s ease-out infinite 0.6s}
.mks-ripple-3{animation:mks-ripple 2.4s ease-out infinite 1.2s}
.mks-ptcl-1{left:25%;bottom:30%;animation:mks-particleUp 2s ease-out infinite 0.2s}
.mks-ptcl-2{left:55%;bottom:25%;animation:mks-particleUp 2.4s ease-out infinite 0.8s}
.mks-ptcl-3{left:75%;bottom:35%;animation:mks-particleUp 1.8s ease-out infinite 1.4s}
.mks-ptcl-4{left:40%;bottom:20%;animation:mks-particleUp 2.6s ease-out infinite 0.5s}
.mks-ptcl-5{left:65%;bottom:40%;animation:mks-particleUp 2.2s ease-out infinite 1.1s}
.mks-dot-pulse-1{animation:mks-dotPulse 1.4s infinite}
.mks-dot-pulse-2{animation:mks-dotPulse 1.4s infinite 0.2s}
.mks-dot-pulse-3{animation:mks-dotPulse 1.4s infinite 0.4s}
.mks-df-bar{position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(217,119,6,0.15),transparent);animation:mks-dataStream 2s ease-in-out infinite;display:none}
.mks-df-streaming .mks-df-bar{display:block}
.mks-success-badge{animation:mks-checkScale 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards}
.mks-success-info{animation:mks-fadeSlideUp 0.4s ease-out 0.2s both}
.mks-sf-1{opacity:0;animation:mks-fadeSlideUp 0.3s ease-out 0.3s forwards}
.mks-sf-2{opacity:0;animation:mks-fadeSlideUp 0.3s ease-out 0.45s forwards}
.mks-sf-3{opacity:0;animation:mks-fadeSlideUp 0.3s ease-out 0.6s forwards}
.mks-sf-4{opacity:0;animation:mks-fadeSlideUp 0.3s ease-out 0.75s forwards}
.mks-sf-5{opacity:0;animation:mks-fadeSlideUp 0.3s ease-out 0.9s forwards}
.mks-sf-6{opacity:0;animation:mks-fadeSlideUp 0.3s ease-out 1.05s forwards}
@media(prefers-reduced-motion:reduce){
.mks-card-3d,.mks-scan-beam,.mks-dot-1,.mks-dot-2,.mks-dot-3,.mks-ripple-1,.mks-ripple-2,.mks-ripple-3,.mks-ptcl-1,.mks-ptcl-2,.mks-ptcl-3,.mks-ptcl-4,.mks-ptcl-5,.mks-df-bar,.mks-chip-odd,.mks-chip-even{animation:none!important}
}
`;

function injectStyles() {
  let el = document.getElementById("mks-styles");
  if (!el) {
    el = document.createElement("style");
    el.id = "mks-styles";
    document.head.appendChild(el);
  }
  el.textContent = SCANNER_STYLES;
}

/* ─── Field label config ──────────────────────────────────────────── */
const FIELDS = [
  { key: "name",      label: "Name" },
  { key: "ic",        label: "IC number" },
  { key: "address",   label: "Address" },
  { key: "gender",    label: "Gender" },
  { key: "race",      label: "Race" },
  { key: "photo",     label: "Photo" },
];

/* ─── Sub-components ─────────────────────────────────────────────── */

function Card3D({ entering }) {
  return (
    <div style={{ position: "relative", width: 160, height: 160, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {/* Ripple rings */}
      {[1,2,3].map(n => (
        <div key={n} className={`mks-ripple-${n}`} style={{ position: "absolute", width: 100, height: 100, border: "1.5px solid rgba(217,119,6,0.4)", borderRadius: "50%", top: "50%", left: "50%", marginTop: -50, marginLeft: -50 }} />
      ))}
      {/* Orbit dots */}
      <div style={{ position: "absolute", inset: 0 }}>
        {[1,2,3].map(n => (
          <div key={n} className={`mks-dot-${n}`} style={{ position: "absolute", width: 6, height: 6, borderRadius: "50%", background: "#D97706", top: "50%", left: "50%", margin: "-3px 0 0 -3px" }} />
        ))}
      </div>
      {/* Card */}
      <div className={`mks-card-3d${entering ? " mks-card-entering" : ""}`}>
        <div style={{ position: "absolute", bottom: -10, left: 8, right: -8, height: 12, background: "rgba(0,0,0,0.25)", borderRadius: "50%", filter: "blur(6px)", transform: "scaleY(0.5)" }} />
        {/* Top Blue Header stripe */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 14, background: "linear-gradient(90deg, #0ea5e9, #38bdf8)", borderTopLeftRadius: 8, borderTopRightRadius: 8, opacity: 0.9 }} />
        <div style={{ position: "absolute", top: 4, left: 8, width: 30, height: 4, background: "#f0f9ff", borderRadius: 2, opacity: 0.8 }} />
        
        {/* Chip */}
        <div style={{ position: "absolute", top: 20, left: 10, width: 22, height: 16, background: "linear-gradient(145deg,#fbbf24,#d97706)", borderRadius: 3, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gridTemplateRows: "repeat(3,1fr)", gap: 1, padding: 2, boxShadow: "0 1px 2px rgba(0,0,0,0.2)" }}>
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className={i % 2 === 0 ? "mks-chip-odd" : "mks-chip-even"} style={{ background: "rgba(180,135,40,0.6)", borderRadius: 0.5 }} />
          ))}
        </div>
        
        {/* Abstract lines representing text fields */}
        <div style={{ position: "absolute", top: 44, left: 10, width: 50, height: 3, background: "#94a3b8", borderRadius: 1, opacity: 0.6 }} />
        <div style={{ position: "absolute", top: 52, left: 10, width: 40, height: 3, background: "#94a3b8", borderRadius: 1, opacity: 0.6 }} />
        <div style={{ position: "absolute", bottom: 12, left: 10, width: 60, height: 3, background: "#94a3b8", borderRadius: 1, opacity: 0.6 }} />
        
        {/* Ghost Photo Box */}
        <div style={{ position: "absolute", top: 22, right: 10, width: 28, height: 34, background: "rgba(255,255,255,0.6)", border: "1px solid rgba(148,163,184,0.3)", borderRadius: 3, display: "flex", alignItems: "flex-end", justifyContent: "center", overflow: "hidden" }}>
             <div style={{ width: 14, height: 14, background: "rgba(148,163,184,0.3)", borderRadius: "50%", marginBottom: 16 }} />
             <div style={{ position: "absolute", bottom: -10, width: 24, height: 24, background: "rgba(148,163,184,0.3)", borderRadius: "50%" }} />
        </div>

        {/* Malaysian flag overlay small */}
        <div style={{ position: "absolute", top: 60, right: 10, width: 14, height: 9, borderRadius: 1.5, overflow: "hidden", display: "flex", flexDirection: "column", opacity: 0.9 }}>
          <div style={{ flex: 1, background: "#010066" }} />
          <div style={{ flex: 1, background: "#CC0001" }} />
          <div style={{ flex: 1, background: "#CC0001" }} />
        </div>
        <div style={{ position: "absolute", top: 44, right: 12, fontSize: 5, color: "#8a7d6a", fontWeight: 500, letterSpacing: 0.5 }}>MyKAD</div>
        {/* Scan beam */}
        <div className="mks-scan-beam" />
      </div>
      {/* Particles */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {[1,2,3,4,5].map(n => (
          <div key={n} className={`mks-ptcl-${n}`} style={{ position: "absolute", width: 3, height: 3, borderRadius: "50%", background: "#EF9F27" }} />
        ))}
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────── */
export default function MyKadScanner({ onDataReceived, header }) {
  const [phase, setPhase]           = useState("idle");   // idle | scanning | success
  const [entering, setEntering]     = useState(false);
  const [filledFields, setFilledFields] = useState({});   // { name: bool, ic: bool, … }
  const [streamingField, setStreamingField] = useState(null);
  const [timeLeft, setTimeLeft]     = useState(180);
  const timerRef                    = useRef(null);
  const pollRef                     = useRef(null); // Reference for API polling

  useEffect(() => { injectStyles(); }, []);

  /* ── Timer and Polling ─────────────────────────────────────────────────────── */
  useEffect(() => {
    if (phase !== "scanning") {
        clearInterval(timerRef.current);
        clearInterval(pollRef.current);
        return;
    }
    
    // UI Countdown Timer
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); handleCancel(); return 180; }
        return t - 1;
      });
    }, 1000);

    // API Poller
    const pollBackend = async () => {
        try {
            const response = await api.get('/mykad/data');
            if (response?.status === 'success' && response?.data) {
                // Stop polling!
                clearInterval(pollRef.current);
                clearInterval(timerRef.current);
                
                // Map the data to our format expected by CustomerCreate!
                const cd = response.data;
                
                // Address construction
                const addressParts = [cd.Addr1, cd.Addr2, cd.Addr3].filter(Boolean);
                const fullAddr = addressParts.length > 0 ? addressParts.join(' ') + (cd.Postcode ? `, ${cd.Postcode}` : '') + (cd.City ? ` ${cd.City}` : '') : '';
                
                // Race remapping
                let mappedRace = null;
                if (cd.Race === 'CINA') mappedRace = 'Chinese';
                else if (cd.Race === 'MELAYU') mappedRace = 'Malay';
                else if (cd.Race === 'INDIA') mappedRace = 'Indian';
                else if (cd.Race) mappedRace = cd.Race;

                // Gender Mapping
                let mappedGender = null;
                if (cd.Gender === 'L') mappedGender = 'male';
                if (cd.Gender === 'P') mappedGender = 'female';

                // Photo Base64 handling
                let photoDataURI = null;
                if (cd.Photo) {
                    const isPng = cd.Photo.startsWith('iVBOR');
                    const mimeType = isPng ? 'image/png' : 'image/jpeg';
                    photoDataURI = `data:${mimeType};base64,${cd.Photo}`;
                }

                const payload = {
                    name: cd.Name || '',
                    icNumber: cd.ICNo || '',
                    address: fullAddr,
                    gender: mappedGender,
                    race: mappedRace,
                    photo: photoDataURI,
                };
                
                // Initiate the scanning stream visual animation with real data
                streamDataVisuals(payload);
            }
        } catch (error) {
            // Ignore normal failures/waiting states
            if (error.response?.status !== 404 && error.response?.status !== 204 && error.response?.data?.status !== 'waiting') {
                console.error("Scanner Error:", error);
            }
        }
    };

    pollBackend(); // initial run
    pollRef.current = setInterval(pollBackend, 4000);

    return () => {
        clearInterval(timerRef.current);
        clearInterval(pollRef.current);
    }
  }, [phase]);

  const progressPct  = phase === "scanning" ? Math.round(((180 - timeLeft) / 180) * 100) : 0;
  const arcTotal     = 106.8;
  const arcOffset    = phase === "scanning" ? ((180 - timeLeft) / 180 * arcTotal).toFixed(1) : 0;
  const timerDisplay = `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, "0")}`;

  /* ── Actions ────────────────────────────────────────────────────── */
  function handleStartScan() {
    setFilledFields({});
    setEntering(false);
    setTimeLeft(180);
    setPhase("scanning");
    // Trigger card entry animation on next tick
    requestAnimationFrame(() => setEntering(true));
  }

  function handleCancel() {
    clearInterval(timerRef.current);
    setPhase("idle");
    setEntering(false);
  }

  function handleSuccess() {
    clearInterval(timerRef.current);
    setPhase("success");
    setTimeout(() => setPhase("idle"), 4000);
  }

  /* ── Called by parent when real card data arrives ───────────────── */
  function streamDataVisuals(payload) {
    // Sequentially highlight the fields to simulate data decoding
    FIELDS.forEach(({ key }, i) => {
      setTimeout(() => {
        setStreamingField(key);
        setTimeout(() => {
          setStreamingField(null);
          setFilledFields(prev => ({ ...prev, [key]: true }));
        }, 600);
      }, i * 400);
    });
    
    // When done, show success checkmark and fire payload to parent
    const delay = FIELDS.length * 400 + 800;
    setTimeout(() => {
      setPhase("success");
      onDataReceived?.(payload);
      
      // Reset back to idle after a few seconds
      setTimeout(() => setPhase("idle"), 4000);
    }, delay);
  }



  /* ── Render ─────────────────────────────────────────────────────── */
  const isDark = phase === "scanning";
  const isSuccess = phase === "success";

  return (
    <div style={{ fontFamily: "inherit" }}>

      {/* ── IDLE HEADER ─────────────────────────────────────────────── */}
      {phase === "idle" && (
        <div style={{ padding: "20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {header}
          <button
            type="button"
            onClick={handleStartScan}
            style={{ 
              display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", 
              border: "1px solid #e5e7eb", borderRadius: 8, background: "#ffffff", 
              fontSize: 13, fontWeight: 600, color: "#4b5563", cursor: "pointer", 
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)" 
            }}
            onMouseEnter={e => { 
              e.currentTarget.style.background="#fffbeb"; 
              e.currentTarget.style.borderColor="#fcd34d"; 
              e.currentTarget.style.color="#b45309"; 
              e.currentTarget.style.transform="translateY(-2px)";
              e.currentTarget.style.boxShadow="0 6px 12px rgba(217,119,6,0.12)";
            }}
            onMouseLeave={e => { 
              e.currentTarget.style.background="#ffffff"; 
              e.currentTarget.style.borderColor="#e5e7eb"; 
              e.currentTarget.style.color="#4b5563"; 
              e.currentTarget.style.transform="translateY(0)";
              e.currentTarget.style.boxShadow="0 1px 2px rgba(0,0,0,0.05)";
            }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="1" y="3" width="12" height="9" rx="2"/><path d="M1 6h12"/></svg>
            Scan with Cardreader
          </button>
        </div>
      )}

      {/* ── SCANNING STATE ─────────────────────────────────────────── */}
      {phase === "scanning" && (
        <div style={{ borderBottom: "0.5px solid var(--color-border-tertiary,#e5e7eb)", animation: "mks-fadeIn 0.5s ease-out" }}>
          <div style={{ background: "linear-gradient(135deg, #fefce8 0%, #fef3c7 100%)", padding: "36px 32px", position: "relative", overflow: "hidden" }}>
            {/* grid bg */}
            <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 1px 1px,rgba(217,119,6,0.12) 1px,transparent 0)", backgroundSize: "24px 24px" }} />
            
            <div style={{ display: "flex", alignItems: "center", gap: 36, position: "relative", zIndex: 1 }}>
              <Card3D entering={entering} />
              
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Title with dots */}
                <div style={{ fontSize: 18, fontWeight: 600, color: "#92400e", display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  Waiting for MyKAD
                  <span style={{ color: "#d97706" }}>
                    <span className="mks-dot-pulse-1">.</span>
                    <span className="mks-dot-pulse-2">.</span>
                    <span className="mks-dot-pulse-3">.</span>
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "#b45309", lineHeight: 1.5, marginBottom: 20 }}>
                  Place the card on the reader device. Data will be captured automatically.
                </div>

                {/* Data field pills */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                  {FIELDS.map(({ key, label }) => {
                    const filled    = filledFields[key];
                    const streaming = streamingField === key;
                    return (
                      <div
                        key={key}
                        className={streaming ? "mks-df-streaming" : ""}
                        style={{
                          padding: "5px 12px", borderRadius: 99, fontSize: 12, fontWeight: 600,
                          border: `1px solid ${filled ? "rgba(217,119,6,0.4)" : "rgba(217,119,6,0.15)"}`,
                          color: filled ? "#92400e" : "rgba(180,83,9,0.5)",
                          background: filled ? "#fef3c7" : "#ffffff",
                          boxShadow: "0 2px 4px rgba(217,119,6,0.05)",
                          position: "relative", overflow: "hidden", transition: "all .4s",
                        }}
                      >
                        <div className="mks-df-bar" />
                        {label}
                      </div>
                    );
                  })}
                </div>

                {/* Timer */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 40, height: 40, position: "relative", flexShrink: 0 }}>
                    <svg width="40" height="40" style={{ transform: "rotate(-90deg)" }} viewBox="0 0 40 40">
                      <circle fill="none" stroke="rgba(217,119,6,0.15)" strokeWidth="3" cx="20" cy="20" r="17" />
                      <circle fill="none" stroke="#D97706" strokeWidth="3" strokeLinecap="round" cx="20" cy="20" r="17"
                        strokeDasharray="106.8" strokeDashoffset={arcOffset} style={{ transition: "stroke-dashoffset 1s linear" }} />
                    </svg>
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "#b45309", fontVariantNumeric: "tabular-nums" }}>
                      {timerDisplay}
                    </div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#b45309" }}>Time remaining</span>
                </div>

                {/* Buttons */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={handleCancel}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 18px", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, background: "#fef2f2", color: "#dc2626", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all .2s" }}
                    onMouseEnter={e => { e.currentTarget.style.background="#fee2e2"; }}
                    onMouseLeave={e => { e.currentTarget.style.background="#fef2f2"; }}
                  >
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3l8 8M11 3l-8 8"/></svg>
                    Cancel scan
                  </button>
                </div>
              </div>
            </div>
            {/* Soft decorative background circles */}
            <div style={{ position: "absolute", right: -20, top: -40, width: 250, height: 250, background: "radial-gradient(circle, rgba(217,119,6,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", left: '30%', bottom: -60, width: 140, height: 140, background: "radial-gradient(circle, rgba(217,119,6,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />
          </div>
        </div>
      )}

      {/* ── SUCCESS STATE ──────────────────────────────────────────── */}
      {phase === "success" && (
        <div style={{ borderBottom: "0.5px solid var(--color-border-tertiary,#e5e7eb)", animation: "mks-fadeIn 0.5s ease-out" }}>
          <div style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)", padding: "36px 32px", position: "relative", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 24, position: "relative", zIndex: 1 }}>
              <div className="mks-success-badge" style={{ width: 68, height: 68, borderRadius: "50%", background: "linear-gradient(145deg,#10b981,#059669)", boxShadow: "0 8px 16px rgba(16,185,129,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="32" height="32" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M7 16l5 5 13-13"/></svg>
              </div>
              <div className="mks-success-info">
                <div style={{ fontSize: 18, fontWeight: 600, color: "#065f46", marginBottom: 4 }}>MyKAD data captured correctly!</div>
                <div style={{ fontSize: 13, color: "#047857", lineHeight: 1.5 }}>Customer profile has been automatically populated from the card details.</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                  {FIELDS.map(({ label }, i) => (
                    <div key={label} className={`mks-sf-${i + 1}`} style={{ padding: "5px 12px", borderRadius: 99, fontSize: 12, fontWeight: 600, border: "1px solid rgba(16,185,129,0.2)", color: "#059669", background: "#ffffff", boxShadow: "0 2px 4px rgba(16,185,129,0.05)" }}>
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Soft decorative background circles */}
            <div style={{ position: "absolute", right: -20, top: -40, width: 250, height: 250, background: "radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", left: '30%', bottom: -60, width: 140, height: 140, background: "radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />
          </div>
        </div>
      )}
    </div>
  );
}