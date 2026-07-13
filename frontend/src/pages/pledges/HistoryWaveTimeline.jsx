import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import {
  CheckCircle,
  CreditCard,
  RefreshCw,
  Banknote,
  DollarSign,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

/** Card geometry (px). Node spacing must match so wave peaks land on cards. */
const CARD_W = 260;
const GAP = 40;
const SLOT = CARD_W + GAP;
/**
 * Run-up before the first node, so the wave eases in from the left edge instead
 * of starting flush against it. PHASE0 is derived from nodeX(0), so any value
 * here preserves the trough/crest alternation.
 */
const LEAD = 140;

/**
 * The wave band. Its resting shape is a sine of period 2*SLOT, so consecutive
 * nodes land on alternating extremes: node 0 in a trough, node 1 on a crest,
 * and so on. Cards hang on the opposite side of their node, which is what
 * gives the zig-zag.
 */
const AMPLITUDE = 62;
/** Padding above/below the extremes so the stroke is never clipped. */
const WAVE_PAD = 16;
const WAVE_H = AMPLITUDE * 2 + WAVE_PAD * 2;
const WAVE_MID = WAVE_H / 2;

/**
 * Vertical space reserved for a card on each side of the band.
 *
 * Must fit the tallest expanded card plus its stem. Measured worst case is the
 * redemption card at ~251px; a multi-bank payout can wrap taller still. An
 * expanded card that outgrows the lane is clipped, not scrolled, because the
 * track deliberately has no vertical overflow -- so this keeps real headroom.
 */
const CARD_LANE = 310;
/** Length of the connector drawn between a node and its card. */
const STEM = 26;

/**
 * The wave is never still: it undulates gently at rest and swells while
 * scrolling. Both are the same travelling ripple, which is windowed to zero at
 * every node so cards and nodes never drift off the curve.
 */
const VELOCITY_FOR_FULL_RIPPLE = 45;
/** Amplitude of the resting undulation, and of a full-speed scroll. */
const RIPPLE_IDLE = 7;
const RIPPLE_MAX = 20;
/** Per-frame decay back toward the idle undulation once scrolling stops. */
const DECAY = 0.94;

/** A glowing pulse travels the wave on a fixed cycle, like a signal on a wire. */
const PULSE_PERIOD_MS = 2600;
const PULSE_LEN = 150;

const ACCENTS = {
  created: {
    dot: "bg-emerald-500",
    ring: "ring-emerald-200",
    stroke: "#10b981",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  payout: {
    dot: "bg-blue-500",
    ring: "ring-blue-200",
    stroke: "#3b82f6",
    chip: "bg-blue-50 text-blue-700 border-blue-200",
  },
  renewal: {
    dot: "bg-amber-500",
    ring: "ring-amber-200",
    stroke: "#f59e0b",
    chip: "bg-amber-50 text-amber-700 border-amber-200",
  },
  interest: {
    dot: "bg-amber-500",
    ring: "ring-amber-200",
    stroke: "#f59e0b",
    chip: "bg-amber-50 text-amber-700 border-amber-200",
  },
  redemption: {
    dot: "bg-blue-600",
    ring: "ring-blue-200",
    stroke: "#2563eb",
    chip: "bg-blue-50 text-blue-700 border-blue-200",
  },
};

const ICONS = {
  created: CheckCircle,
  payout: CreditCard,
  renewal: RefreshCw,
  interest: Banknote,
  redemption: DollarSign,
};

/**
 * Flattens the pledge into one chronological event list.
 *
 * created_at is the sort key throughout: it is the only timestamp always
 * present (renewal_date / payment_date are nullable) and it carries seconds,
 * so same-day events still order correctly.
 */
function buildEvents(pledge) {
  const events = [];

  events.push({
    id: "created",
    type: "created",
    at: pledge.createdAt || pledge.pledgeDate,
    title: "Pledge Created",
    date: pledge.pledgeDate || pledge.createdAt,
    amount: pledge.loanAmount,
    amountLabel: "Loan amount",
    by: pledge.createdBy,
    rows: [
      { label: "Items", value: `${pledge.items?.length || 0} item(s)` },
      { label: "Loan", value: formatCurrency(pledge.loanAmount) },
    ],
  });

  if (pledge.payments?.length) {
    const rows = pledge.payments;
    const primary = rows[0];
    const totalCash = rows.reduce((s, p) => s + (p.cashAmount || 0), 0);
    const banks = rows.filter((p) => p.bankName);
    const paymentDate = rows.find((p) => p.paymentDate)?.paymentDate;
    events.push({
      id: "payout",
      type: "payout",
      at: primary.occurredAt || paymentDate || pledge.createdAt,
      title: `Payout — ${primary.paymentMethod || "cash"}`,
      date: paymentDate || primary.occurredAt,
      amount: totalCash + banks.reduce((s, b) => s + (b.transferAmount || 0), 0),
      amountLabel: "Disbursed",
      by: primary.createdBy || pledge.createdBy,
      rows: [
        ...(totalCash > 0
          ? [{ label: "Cash", value: formatCurrency(totalCash) }]
          : []),
        ...banks.map((b) => ({
          label: b.bankName,
          value: formatCurrency(b.transferAmount),
        })),
      ],
    });
  }

  (pledge.renewals || []).forEach((r, idx) => {
    events.push({
      id: `renewal-${r.id || idx}`,
      type: "renewal",
      // Sequence reflects renewal order, not timeline position.
      seq: idx + 1,
      at: r.occurredAt || r.renewalDate,
      title: `Renewal #${idx + 1}`,
      ref: r.renewalNo,
      date: r.renewalDate,
      amount: r.interestAmount,
      amountLabel: "Interest paid",
      rows: [
        { label: "Extended", value: `${r.renewalMonths} month(s)` },
        { label: "Interest paid", value: formatCurrency(r.interestAmount) },
        { label: "New due date", value: formatDate(r.newDueDate), accent: true },
      ],
    });
  });

  (pledge.interestPayments || []).forEach((p, idx) => {
    const months = Number(p.interestMonths) || 0;
    events.push({
      id: `interest-${p.id || idx}`,
      type: "interest",
      at: p.occurredAt || p.paymentDate,
      title: "Interest Payment",
      ref: p.paymentNo,
      date: p.paymentDate,
      amount: p.totalPayable,
      amountLabel: "Amount paid",
      badge: `${months} mo paid`,
      rows: [
        { label: "Period", value: `${months} month(s) at ${p.interestRate}%` },
        {
          label: "Covers",
          value: `${formatDate(p.periodFrom)} → ${formatDate(p.periodTo)}`,
        },
        {
          label: "Per month",
          // interest_months has no positive constraint; guard the divide.
          value: months > 0 ? formatCurrency(p.totalPayable / months) : "—",
        },
      ],
    });
  });

  (pledge.redemptions || []).forEach((r, idx) => {
    events.push({
      id: `redemption-${r.id || idx}`,
      type: "redemption",
      at: r.occurredAt || r.redemptionDate,
      title: r.isPartial ? "Partial Redemption" : "Redemption",
      ref: r.redemptionNo,
      date: r.redemptionDate,
      amount: r.totalPayable,
      amountLabel: "Total paid",
      by: r.createdBy,
      rows: [
        { label: "Principal", value: formatCurrency(r.principalAmount) },
        {
          label: `Interest (${r.interestMonths} mo @ ${r.interestRate}%)`,
          value: formatCurrency(r.interestAmount),
        },
        ...(r.handlingFee > 0
          ? [{ label: "Handling fee", value: formatCurrency(r.handlingFee) }]
          : []),
        {
          label: "Method",
          value: `${r.paymentMethod}${r.bankName ? ` — ${r.bankName}` : ""}`,
        },
      ],
    });
  });

  // Rank breaks ties and, for "created", pins the pledge to the head of the
  // timeline: it shares a created_at second with its own payout row, and a
  // pledge cannot be paid out before it exists.
  const RANK = { created: 0, payout: 1, interest: 2, renewal: 3, redemption: 4 };

  return events.sort((a, b) => {
    if (a.type === "created") return -1;
    if (b.type === "created") return 1;
    const ta = a.at ? new Date(a.at).getTime() : 0;
    const tb = b.at ? new Date(b.at).getTime() : 0;
    if (ta !== tb) return ta - tb;
    // Same instant: interest settles before the renewal it unlocks.
    return RANK[a.type] - RANK[b.type];
  });
}

/** Centre x of node i. Cards share this x, so both sit on the same vertical. */
const nodeX = (i) => LEAD + GAP + i * SLOT + CARD_W / 2;

/**
 * Phase chosen so node 0 lands at sin = -1 (a trough, i.e. its card hangs
 * above the wave), matching the intended zig-zag start.
 */
const PHASE0 = -Math.PI / 2 - (Math.PI * nodeX(0)) / SLOT;

/** Resting height of the wave at x, before any scroll ripple. */
const baseY = (x) => WAVE_MID + Math.sin((Math.PI * x) / SLOT + PHASE0) * AMPLITUDE;

/**
 * The travelling ripple, windowed so it dies at every node.
 *
 * baseY hits an extreme at each node, so cos of the same argument is exactly 0
 * there. Squaring it keeps the window non-negative and pins the ripple to zero
 * at the nodes, letting the wave writhe between them without ever lifting a
 * node off the curve.
 */
const rippleY = (x, ripple, phase) => {
  if (ripple === 0) return 0;
  const window = Math.cos((Math.PI * x) / SLOT + PHASE0) ** 2;
  return Math.sin((x / SLOT) * Math.PI * 4 + phase) * ripple * window;
};

/** y of the curve at x, including the ripple. Nodes use this too. */
const waveY = (x, ripple, phase) => baseY(x) + rippleY(x, ripple, phase);

/** Builds the SVG path as a smooth polyline through the sampled curve. */
function wavePath(width, ripple, phase) {
  if (width <= 0) return "";
  const step = 4;
  let d = "";
  for (let x = 0; x <= width; x += step) {
    const y = waveY(x, ripple, phase);
    d += `${d ? "L" : "M"}${x.toFixed(1)},${y.toFixed(2)}`;
  }
  return d;
}

export default function HistoryWaveTimeline({ pledge }) {
  const events = useMemo(() => buildEvents(pledge), [pledge]);
  const scrollerRef = useRef(null);
  // Nothing is expanded until the user asks. Hover opens; click pins it open.
  const [hoverIdx, setHoverIdx] = useState(null);
  const [pinnedIdx, setPinnedIdx] = useState(null);
  const [width, setWidth] = useState(0);
  const [ripple, setRipple] = useState(RIPPLE_IDLE);
  const [phase, setPhase] = useState(0);
  const [pulseAt, setPulseAt] = useState(0);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  // How far right the timeline has been revealed, in track px. Everything
  // left of this frontier is drawn; the rest is still hidden.
  const [revealX, setRevealX] = useState(0);

  // Scroll state lives in refs: the rAF loop reads it every frame and must not
  // re-subscribe or re-render to see fresh values.
  const lastScroll = useRef(0);
  const velocity = useRef(0);
  const amp = useRef(RIPPLE_IDLE);
  const pathRef = useRef(null);
  const [pathLen, setPathLen] = useState(0);
  const reduceMotion = useRef(false);

  useEffect(() => {
    reduceMotion.current =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const syncArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  // The reveal frontier: the right edge of the viewport, in track coordinates.
  // It only ever advances, so scrolling back does not un-reveal what was seen.
  const advanceReveal = useCallback((el) => {
    const frontier = el.scrollLeft + el.clientWidth;
    setRevealX((cur) => (frontier > cur ? frontier : cur));
  }, []);

  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    velocity.current = Math.abs(el.scrollLeft - lastScroll.current);
    lastScroll.current = el.scrollLeft;
    advanceReveal(el);
    syncArrows();
  }, [syncArrows, advanceReveal]);

  // Single rAF loop. The wave always undulates; scrolling swells it above the
  // idle floor, and it decays back to that floor rather than to zero. A pulse
  // clock runs alongside so a glow can travel the stroke.
  useEffect(() => {
    if (reduceMotion.current) return undefined;
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const scrollTarget =
        Math.min(1, velocity.current / VELOCITY_FOR_FULL_RIPPLE) * RIPPLE_MAX;
      // Never fall below the resting undulation.
      const target = Math.max(RIPPLE_IDLE, scrollTarget);
      // Rise fast toward the target, fall slowly once scrolling stops.
      amp.current =
        target > amp.current
          ? amp.current + (target - amp.current) * 0.35
          : RIPPLE_IDLE + (amp.current - RIPPLE_IDLE) * DECAY;
      velocity.current *= 0.85;

      setRipple(amp.current);
      // Baseline drift keeps the shape alive even at rest.
      setPhase((p) => p + 0.012 + (amp.current / RIPPLE_MAX) * 0.14);
      setPulseAt(((now - start) % PULSE_PERIOD_MS) / PULSE_PERIOD_MS);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Track the scrollable width so the SVG path spans the whole content.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return undefined;
    const measure = () => {
      setWidth(el.scrollWidth);
      syncArrows();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [events.length, syncArrows]);

  // Open on the oldest event; layout effects elsewhere can leave this scrolled.
  // Seed the frontier so whatever is on screen at rest counts as revealed.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollLeft = 0;
    lastScroll.current = 0;
    advanceReveal(el);
  }, [advanceReveal]);

  // The dash-trace needs the path's arc length. It shifts slightly as the wave
  // undulates, but re-measuring every frame would thrash; the track width is
  // what actually matters, so key off that.
  useEffect(() => {
    if (pathRef.current) setPathLen(pathRef.current.getTotalLength());
  }, [width, events.length]);

  const scrollBy = (dir) =>
    scrollerRef.current?.scrollBy({ left: dir * SLOT, behavior: "smooth" });

  // A vertical wheel over the track scrolls it sideways: this tab never
  // scrolls in Y.
  const onWheel = useCallback((e) => {
    const el = scrollerRef.current;
    if (!el) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) el.scrollLeft += e.deltaY;
  }, []);

  const trackWidth = LEAD + GAP * 2 + events.length * SLOT;
  const drawnWidth = Math.max(width, trackWidth);
  const d = wavePath(drawnWidth, ripple, phase);
  // A click pins a card open; otherwise hover decides.
  const activeIdx = pinnedIdx ?? hoverIdx;

  // Fraction of the track revealed so far, mapped onto the path's arc length.
  const revealed = Math.min(1, drawnWidth ? revealX / drawnWidth : 0);
  const drawnLen = pathLen * revealed;
  // The pulse travels only over the part already drawn.
  const pulseOffset = pulseAt * (drawnLen + PULSE_LEN) - PULSE_LEN;

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-lg font-semibold text-zinc-800">
          Transaction History
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400 hidden sm:inline">
            Hover or click a card
          </span>
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            disabled={!canLeft}
            aria-label="Scroll to earlier events"
            className="w-8 h-8 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-600 enabled:hover:bg-zinc-50 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            disabled={!canRight}
            aria-label="Scroll to later events"
            className="w-8 h-8 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-600 enabled:hover:bg-zinc-50 disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      <p className="text-xs text-zinc-500 mb-2">
        {events.length} event{events.length === 1 ? "" : "s"} · oldest to newest
      </p>

      <div className="relative">
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 w-12 z-30 bg-gradient-to-r from-white to-transparent transition-opacity",
            canLeft ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 w-12 z-30 bg-gradient-to-l from-white to-transparent transition-opacity",
            canRight ? "opacity-100" : "opacity-0",
          )}
        />

        <div
          ref={scrollerRef}
          onScroll={onScroll}
          onWheel={onWheel}
          className="overflow-x-auto overflow-y-hidden [scrollbar-width:thin]"
          style={{ perspective: "1400px" }}
        >
          <div
            className="relative"
            style={{
              width: trackWidth,
              minWidth: "100%",
              height: CARD_LANE * 2 + WAVE_H,
            }}
          >
            {/* The wave runs between the two card lanes. */}
            <svg
              className="absolute left-0 pointer-events-none"
              style={{ top: CARD_LANE, width: trackWidth, height: WAVE_H }}
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="waveGrad" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="50%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#2563eb" />
                </linearGradient>
                <filter
                  id="waveGlow"
                  x="-10%"
                  y="-30%"
                  width="120%"
                  height="160%"
                >
                  <feGaussianBlur stdDeviation="4" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <line
                x1="0"
                y1={WAVE_MID}
                x2={trackWidth}
                y2={WAVE_MID}
                stroke="#e4e4e7"
                strokeDasharray="2 6"
              />
              {/*
                The wave draws itself as you scroll: a single dash as long as
                the revealed arc, with the remainder pushed past the end. The
                ref is what lets us measure that arc length.
              */}
              <path
                ref={pathRef}
                d={d}
                fill="none"
                stroke="url(#waveGrad)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#waveGlow)"
                strokeDasharray={pathLen ? `${drawnLen} ${pathLen}` : undefined}
              />
              {/* A glowing pulse running along the drawn part of the wave. */}
              {pathLen > 0 && drawnLen > PULSE_LEN && (
                <path
                  d={d}
                  fill="none"
                  stroke="#fff"
                  strokeWidth="3"
                  strokeLinecap="round"
                  opacity="0.75"
                  filter="url(#waveGlow)"
                  strokeDasharray={`0 ${Math.max(0, pulseOffset)} ${PULSE_LEN} ${pathLen}`}
                  style={{ mixBlendMode: "overlay" }}
                />
              )}
            </svg>

            {events.map((e, i) => {
              const x = nodeX(i);
              const y = baseY(x);
              // A trough sits above the midline, so its card hangs above the
              // wave; a crest pushes its card below. Hence the zig-zag.
              const above = y < WAVE_MID;
              const accent = ACCENTS[e.type];
              const Icon = ICONS[e.type];
              const isOpen = i === activeIdx;
              // An event appears once the drawing wave has reached its node.
              const shown = x <= revealX;

              return (
                <div key={e.id}>
                  {/* Stem joining the node to its card. Behind both. */}
                  <motion.div
                    initial={false}
                    animate={{ opacity: shown ? 1 : 0 }}
                    transition={{ duration: 0.25 }}
                    className="absolute w-px bg-zinc-300 z-0"
                    style={{
                      left: x,
                      top: above ? CARD_LANE + y - STEM : CARD_LANE + y,
                      height: STEM,
                    }}
                  />

                  {/* Node, welded to the curve at (x, baseY(x)). */}
                  <div
                    className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
                    style={{ left: x, top: CARD_LANE + y }}
                  >
                    <motion.div
                      initial={false}
                      animate={{
                        scale: shown ? (isOpen ? 1.15 : 1) : 0,
                        opacity: shown ? 1 : 0,
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 22,
                      }}
                      className={cn(
                        "w-11 h-11 rounded-full flex items-center justify-center text-white shadow-md ring-4 ring-white",
                        accent.dot,
                        isOpen && accent.ring,
                      )}
                    >
                      <Icon className="w-5 h-5" />
                    </motion.div>
                  </div>

                  <EventCard
                    event={e}
                    centre={x}
                    above={above}
                    // The y where the card's edge nearest the wave must sit.
                    // Both are measured from the track top, so there is no
                    // dependence on the track's own height.
                    edgeY={
                      above ? CARD_LANE + y - STEM : CARD_LANE + y + STEM
                    }
                    shown={shown}
                    open={isOpen}
                    onHover={(on) =>
                      setHoverIdx((cur) => (on ? i : cur === i ? null : cur))
                    }
                    onToggle={() =>
                      setPinnedIdx((cur) => (cur === i ? null : i))
                    }
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * One event. Compact at rest; the detail rows open on hover or click.
 * Tilts toward the cursor for depth.
 */
function EventCard({
  event,
  centre,
  above,
  edgeY,
  shown,
  open,
  onHover,
  onToggle,
}) {
  const accent = ACCENTS[event.type];
  const ref = useRef(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });

  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Normalised cursor offset from card centre, in [-0.5, 0.5].
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    // Invert Y so pushing the cursor up tips the top edge away.
    setTilt({ rx: -py * 12, ry: px * 14 });
  };

  // `edgeY` is the card edge nearest the wave. An "above" card is shifted up by
  // its own height, so it grows upward when it expands and never covers the
  // curve; a "below" card hangs straight down from edgeY.
  const shiftY = above ? "-100%" : "0";
  // Before it is revealed the card sits low and transparent, then rises into
  // place. `rise` is folded into the transform so it composes with the tilt.
  const rise = shown ? 0 : 18;

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => {
        onHover(false);
        setTilt({ rx: 0, ry: 0 });
      }}
      onClick={onToggle}
      animate={{ opacity: shown ? (open ? 1 : 0.94) : 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      style={{
        position: "absolute",
        left: centre,
        top: edgeY,
        width: CARD_W,
        transformStyle: "preserve-3d",
        // translateX(-50%) centres the card under its node; translateY pins the
        // correct edge to the wave.
        transform: `translate(-50%, ${shiftY}) translateY(${rise}px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translateZ(${open ? 40 : 0}px)`,
        transition: "transform 300ms ease-out",
        zIndex: open ? 25 : 10,
        // A card that has not been revealed must not swallow the pointer.
        pointerEvents: shown ? "auto" : "none",
      }}
      className={cn(
        "rounded-xl border bg-white overflow-hidden cursor-pointer select-none",
        open
          ? "border-zinc-300 shadow-2xl"
          : "border-zinc-200 shadow-sm hover:shadow-lg",
      )}
    >
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-zinc-800 truncate">{event.title}</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {formatDate(event.date)}
            </p>
          </div>
          {event.amount != null && (
            <p className="text-sm font-bold text-emerald-700 shrink-0">
              {formatCurrency(event.amount)}
            </p>
          )}
        </div>
        {(event.ref || event.badge) && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {event.ref && (
              <span className="px-1.5 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-[11px] font-mono font-bold text-zinc-700">
                {event.ref}
              </span>
            )}
            {event.badge && (
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wide",
                  accent.chip,
                )}
              >
                {event.badge}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Detail is collapsed until hover or click. */}
      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.18 }}
        className="overflow-hidden"
      >
        <div className="px-4 py-3 space-y-1.5 border-t border-zinc-100 bg-zinc-50/60">
          {event.rows?.map((row) => (
            <div
              key={row.label}
              className="flex items-baseline justify-between gap-3 text-sm"
            >
              <span className="text-zinc-500 shrink-0">{row.label}</span>
              <span
                className={cn(
                  "font-semibold text-right",
                  row.accent ? "text-amber-600" : "text-zinc-800",
                )}
              >
                {row.value}
              </span>
            </div>
          ))}
          {event.by && (
            <p className="text-xs text-zinc-400 pt-1">By: {event.by}</p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
