import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Truck, Box, Clock, CheckCircle } from 'lucide-react';

// Simple shipment tracker UI:
// - Single top-level progress bar (four steps)
// - Single vertical timeline (latest first)
// - Shows most recent N events by default with a "Show full tracking history" toggle
const STEPS = [
  { key: 'shipped', label: 'Order Shipped', icon: Truck },
  { key: 'in_transit', label: 'In Transit', icon: Box },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: Clock },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle }
];

function normalizeStatus(status) {
  if (!status) return null;
  const s = String(status).toLowerCase();
  // detect Out For Delivery before delivered ("delivery" contains "deliv")
  if (s.includes('out for') || s.includes('ofd')) return 'out_for_delivery';
  if (s.includes('deliv') || s.includes('delivered')) return 'delivered';
  if (s.includes('in transit') || s.includes('transit')) return 'in_transit';
  // Treat "ready" as a pre-shipment milestone (do not advance timeline to 'shipped')
  if (s.includes('ready') || s.includes('ready to ship') || s.includes('ready_to_ship')) return 'ready_to_ship';
  if (s.includes('ship') || s.includes('shipped')) return 'shipped';
  const m = s.match(/\d+/);
  if (m) {
    const code = Number(m[0]);
    if ([7, 16, 26].includes(code)) return 'delivered';
    if ([19].includes(code)) return 'out_for_delivery';
    if ([20, 6, 61].includes(code)) return 'in_transit';
  }
  return null;
}

export default function ShipmentTracker({ status, events }) {
  const VIRTUAL_MAX_SCANS = 20;
  const [showAll, setShowAll] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({});

  // Defensive normalization for events array and sorting
  const safeEvents = Array.isArray(events)
    ? events.map(e => (typeof e === 'string' ? { activity: e } : e)).filter(Boolean)
    : [];

  // Sort events in two orders: desc for rendering (latest first), asc for deriving timeline truth (oldest -> newest)
  const sortedDesc = safeEvents.slice().sort((a, b) => {
    const da = a && a.date ? Date.parse(a.date) || 0 : 0;
    const db = b && b.date ? Date.parse(b.date) || 0 : 0;
    return db - da;
  });
  const sortedAsc = safeEvents.slice().sort((a, b) => {
    const da = a && a.date ? Date.parse(a.date) || 0 : 0;
    const db = b && b.date ? Date.parse(b.date) || 0 : 0;
    return da - db;
  });

  // Canonical step keys used for derivation (keep DOM/stages unchanged)
  const STEP_KEYS = ['shipped', 'in_transit', 'out_for_delivery', 'delivered'];

  // Map each scan to one of the canonical steps so we can derive progression from timeline events
  function stepKeyForEvent(ev) {
    const txt = (ev && (ev['sr-status-label'] || ev.sr_status_label || ev.activity || ev.status || '') + '').toLowerCase();
    if (!txt) return 'in_transit';
    const ns = normalizeStatus(txt);
    if (ns) return ns;
    if (txt.includes('manifest')) return 'shipped';
    // Treat pickup / picked up events as 'shipped' (do not bucket them into in_transit)
    if (txt.includes('pickup') || txt.includes('picked') || txt.includes('pick up') || txt.includes('picked up')) return 'shipped';
    if (txt.includes('ready to ship') || txt.includes('ready') || txt.includes('ready_to_ship')) return 'ready_to_ship';
    if (txt.includes('out for delivery') || txt.includes('ofd')) return 'out_for_delivery';
    if (txt.includes('deliver') || txt.includes('delivered') || txt.includes('dlv')) return 'delivered';
    // Remaining keywords indicating movement within network map to in_transit
    if (txt.includes('bag') || txt.includes('facility') || txt.includes('trip') || txt.includes('in transit')) return 'in_transit';
    return 'in_transit';
  }

  // Determine whether we have timeline events. If present, they are the single source of truth.
  const hasTimeline = sortedAsc.length > 0;

  // Also build per-stage ascending buckets (oldest -> newest) for precise scan indexing
  const stepBucketsAsc = STEP_KEYS.reduce((acc, k) => { acc[k] = []; return acc; }, {});
  sortedAsc.forEach(ev => {
    const key = stepKeyForEvent(ev) || 'in_transit';
    stepBucketsAsc[key] = stepBucketsAsc[key] || [];
    stepBucketsAsc[key].push(ev);
  });
  // signature of scans to force reactivity when timestamps/content change
  const scansSignature = JSON.stringify(sortedAsc.map(ev => `${ev.date || ''}|${(ev && (ev.activity||ev.status||ev['sr-status-label'])) || ''}`));
  // Per-stage buckets for rendering (latest first)
  const stepBuckets = STEP_KEYS.reduce((acc, k) => { acc[k] = []; return acc; }, {});
  sortedDesc.forEach(ev => {
    const key = stepKeyForEvent(ev) || 'in_transit';
    stepBuckets[key] = stepBuckets[key] || [];
    stepBuckets[key].push(ev);
  });
  // Which stages have any scans (used for hasTimeline rendering)
  const stageDone = STEP_KEYS.reduce((acc, k) => { acc[k] = !!(stepBucketsAsc[k] && stepBucketsAsc[k].length); return acc; }, {});

  // shipped / ready-to-ship / delivered helpers
  const hasShippedScan = !!(stepBucketsAsc['shipped'] && stepBucketsAsc['shipped'].length);
  const hasReadyToShip = (sortedAsc || []).some(ev => stepKeyForEvent(ev) === 'ready_to_ship') || String(status || '').toLowerCase().includes('ready');
  const hasDeliveredScan = !!(stepBucketsAsc['delivered'] && stepBucketsAsc['delivered'].length);

  // Timeline-driven derivation (only determine current stage; DO NOT compute percent here)
  let activeIndex = -1;
  let isDelivered = false;
  let filledIndex = -1; // index of the last fully completed stage (computed from computedProgressPercent below)
  // Determine current stage from latest scan (this is allowed - stage only used for bounding)
  if (hasTimeline) {
    const latestEvent = sortedAsc[sortedAsc.length - 1];
    const latestKey = stepKeyForEvent(latestEvent) || 'in_transit';
    activeIndex = STEP_KEYS.indexOf(latestKey);
    if (activeIndex === -1) activeIndex = 1; // default to in_transit if unknown
    isDelivered = (STEP_KEYS[activeIndex] === 'delivered');
    // Debug: log current stage only
    try { console.debug('[ShipmentTracker] stage:', { latestKey, activeIndex }); } catch (e) {}
  }

  // Per-step expand state
  const [openSteps, setOpenSteps] = useState({});
  function toggleStep(k) { setOpenSteps(s => ({ ...s, [k]: !s[k] })); }
  // Refs for measuring marker positions so the vertical line exactly spans markers
  const containerRef = useRef(null);
  const markerRefs = useRef([]);
  const [verticalDims, setVerticalDims] = useState({ top: 0, height: 0, progressHeight: 0 });
  const topBarRef = useRef(null);

  // --- Enforce Virtual Max Scan model for horizontal progress (single source of truth)
  const scanCount = sortedAsc.length;
  const scanProgress = Math.min(scanCount / VIRTUAL_MAX_SCANS, 1);
  // If no timeline, reset progress to zero immediately
  let computedProgressPercent = 0;
  if (scanCount === 0) {
    computedProgressPercent = 0;
  } else {
    const latestKey = stepKeyForEvent(sortedAsc[sortedAsc.length - 1]) || 'in_transit';
    const ranges = {
      shipped: [0, 25],
      in_transit: [25, 50],
      out_for_delivery: [50, 75],
      delivered: [75, 100]
    };
    const range = ranges[latestKey] || ranges.in_transit;
    const [stageStart, stageEnd] = range;
    // scans in current stage
    const scansInStage = (stepBucketsAsc[latestKey] || []).length || 0;
    // find previous stage key (most recent earlier scan with different stage)
    let previousKey = latestKey;
    for (let i = sortedAsc.length - 2; i >= 0; i--) {
      const k = stepKeyForEvent(sortedAsc[i]) || 'in_transit';
      if (k !== latestKey) { previousKey = k; break; }
    }
    // Phase 1: if we've just entered a new stage (previous differs and at least one scan in this stage), snap to stage start
    computedProgressPercent = stageStart; // snap by default when scans exist
    if (scanProgress > 0) {
      // Phase 2: apply scan-based interpolation within current stage
      computedProgressPercent = stageStart + (scanProgress * (stageEnd - stageStart));
    }
    // Ensure we never exceed stage end or go below start
    if (computedProgressPercent > stageEnd) computedProgressPercent = stageEnd;
    if (computedProgressPercent < stageStart) computedProgressPercent = stageStart;
    // If this is a stage entry (previous stage different) and there are scans in this stage, ensure at least snapped to start
    if (previousKey !== latestKey && scansInStage > 0) {
      computedProgressPercent = Math.max(computedProgressPercent, stageStart);
    }
    // Prevent reaching delivered threshold unless an actual delivered scan exists
    if (!hasDeliveredScan && computedProgressPercent >= 75) {
      computedProgressPercent = 75 - 0.01;
    }
  }
  
  // shipped / ready-to-ship helpers are declared above to avoid TDZ

  // Force re-render when events content changes (covers in-place mutation cases)
  const [tick, setTick] = useState(0);
  const eventsSignatureProp = (() => {
    try { return JSON.stringify(events || []); } catch (e) { return String(events); }
  })();
  const prevEventsSig = useRef(null);
  useEffect(() => {
    if (prevEventsSig.current !== eventsSignatureProp) {
      prevEventsSig.current = eventsSignatureProp;
      setTick(t => t + 1);
    }
  }, [eventsSignatureProp]);

  // Compute vertical line dimensions based on marker positions
  useEffect(() => {
    let raf = null;
    function compute() {
      const container = containerRef.current;
      const markers = markerRefs.current || [];
      if (!container || !markers.length) return setVerticalDims({ top: 0, height: 0, progressHeight: 0 });
      const first = markers[0].getBoundingClientRect();
      const last = markers[markers.length - 1].getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const markerSize = first.height || 8;
      const top = (first.top - containerRect.top) + (markerSize / 2);
      const height = (last.top - first.top) + markerSize;
      // progressHeight: map computedProgressPercent into marker centers so stage-entry snaps exactly
      let progressHeight = 0;
      try {
        // compute marker centers (absolute page Y)
        const markerCenters = markers.map(m => {
          const r = m.getBoundingClientRect();
          return r.top + (r.height / 2);
        });
        const firstCenter = markerCenters[0];
        // clamp percent
        let p = Math.max(0, Math.min(100, computedProgressPercent));
        // Prevent vertical mapping from reaching Delivered marker when there is no delivered scan
        const allowedMax = hasDeliveredScan ? 100 : 74.99;
        if (p > allowedMax) p = allowedMax;
        // determine stage index from percent (0-24 -> 0, 25-49 ->1, etc.)
        let stageIdxFromPercent = Math.min(markerCenters.length - 1, Math.floor(p / 25));
        // If percent is exactly on a stage boundary but there are no scans in the next stage,
        // don't map to the next marker (avoid snapping to next stage center prematurely).
        if (p % 25 === 0 && p !== 0 && stageIdxFromPercent > 0) {
          const nextStageKey = STEP_KEYS[stageIdxFromPercent];
          const hasNextScans = !!(stepBucketsAsc[nextStageKey] && stepBucketsAsc[nextStageKey].length);
          if (!hasNextScans) stageIdxFromPercent = Math.max(0, stageIdxFromPercent - 1);
        }
        const nextIdx = Math.min(markerCenters.length - 1, stageIdxFromPercent + 1);
        const ranges = [0,25,50,75,100];
        const stageStart = ranges[stageIdxFromPercent];
        const stageEnd = ranges[stageIdxFromPercent + 1] || 100;
          let fractionWithin = (stageEnd === stageStart) ? 1 : ((p - stageStart) / (stageEnd - stageStart));
        let posCenter = markerCenters[stageIdxFromPercent] + (fractionWithin * (markerCenters[nextIdx] - markerCenters[stageIdxFromPercent]));
          // When mapping toward the final Delivered marker but no delivered scan exists,
          // cap interpolation to avoid visually touching the dot.
          if (nextIdx === (markerCenters.length - 1) && !hasDeliveredScan) {
            fractionWithin = Math.min(fractionWithin, 0.85);
          }
          posCenter = markerCenters[stageIdxFromPercent] + (fractionWithin * (markerCenters[nextIdx] - markerCenters[stageIdxFromPercent]));
          if (nextIdx === (markerCenters.length - 1) && !hasDeliveredScan) {
            const safePx = Math.max(6, (markerSize / 2) + 6); // at least a bit more than the marker radius
            const maxPos = markerCenters[nextIdx] - safePx;
            if (posCenter > maxPos) posCenter = maxPos;
          }
        progressHeight = posCenter - firstCenter;
        if (!isFinite(progressHeight) || progressHeight < 0) progressHeight = 0;
      } catch (e) {
        progressHeight = 0;
      }
      setVerticalDims({ top, height, progressHeight });
    }
    function scheduleCompute() {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        compute();
        // run one more time after layout settles
        setTimeout(compute, 50);
      });
    }
    scheduleCompute();
    window.addEventListener('resize', scheduleCompute);
    // Also observe container size changes (expanding details changes layout)
    let ro = null;
    try {
      const containerEl = containerRef.current;
      if (containerEl && typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(() => scheduleCompute());
        ro.observe(containerEl);
      }
    } catch (e) {}
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('resize', scheduleCompute);
      try { if (ro) ro.disconnect(); } catch (e) {}
    };
  }, [scansSignature, filledIndex, STEP_KEYS.length, JSON.stringify(openSteps), tick]);

  try {
    return (
      <div className="w-full mt-3">
        {/* Single top-level progress bar (fixed height, does not push content) */}
        <div className="w-full">
        <div className="relative w-full h-25 px-0 py-3 overflow-hidden">
          {/* Background rail centered vertically */}
          <div className="absolute left-6 right-6 top-1/2 transform -translate-y-1/2 h-1 bg-gray-200 rounded z-0" />
          {/* Filled progress (width based on completed steps) */}
          <div
            ref={topBarRef}
            className="absolute left-6 right-6 top-1/2 transform -translate-y-1/2 h-1 z-0"
          >
            <div
              className="absolute left-0 top-0 h-1 bg-green-500 rounded"
              style={{ width: `${Math.max(0, Math.min(100, computedProgressPercent))}%` }}
            />
          </div>
          <div className="relative z-10 flex items-center justify-between h-full px-4">
            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              const key = step.key;
              // Determine marker coloring solely from computedProgressPercent (scan-driven)
              const ranges = { shipped: [0,25], in_transit: [25,50], out_for_delivery: [50,75], delivered: [75,100] };
              const [sStart, sEnd] = ranges[key] || [25,50];
              let done = computedProgressPercent >= sEnd;
              let active = computedProgressPercent >= sStart && computedProgressPercent < sEnd;
              // Override for shipped stage: only show yellow when explicitly ready-to-ship, green when shipped/picked
              if (key === 'shipped') {
                done = hasShippedScan;
                active = !hasShippedScan && hasReadyToShip;
              }
              // Delivered marker should be green only when a delivered scan exists
              if (key === 'delivered') {
                done = hasDeliveredScan;
                active = false;
              }
              return (
                <div key={step.key} className="flex flex-col items-center text-center w-1/4">
                  <motion.div
                    initial={{ scale: 0.95 }}
                    animate={{ scale: active ? 1.05 : 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className={`w-10 h-10 rounded-full flex items-center justify-center shadow ${done ? 'bg-green-600 text-white' : (active ? 'bg-yellow-500 text-white' : 'bg-white text-gray-500 border border-gray-200')}`}
                    style={{ marginTop: '-6px' }}
                  >
                    <Icon className="w-5 h-5" />
                  </motion.div>
                  <div className={`mt-2 text-xs ${done ? 'text-green-800' : (active ? 'text-yellow-600' : 'text-gray-500')}`}>{step.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Single vertical timeline with expandable step nodes */}
      <div className="mt-4">
        <h3 className="text-sm font-semibold mb-3">Shipment Timeline</h3>
        {sortedDesc.length === 0 ? (
          <div className="text-xs text-gray-500">No tracking updates available yet.</div>
        ) : (
          <div className="relative grid grid-cols-[45px_1fr] gap-y-6" ref={containerRef}>
            {/* vertical background line spanning only marker area */}
            <div className="absolute left-6 w-px bg-gray-200 z-0" style={{ top: verticalDims.top, height: verticalDims.height }} />
            {/* vertical progress overlay (fills to last completed step) */}
            {(() => {
              return (
                <div className="absolute left-6 w-px bg-green-500 z-0" style={{ top: verticalDims.top, height: verticalDims.progressHeight }} />
              );
            })()}
                      {STEP_KEYS.map((key, idx) => {
                      const items = stepBuckets[key] || [];
                    const isOpen = !!openSteps[key];
                    const latest = items[0];
                    const label = STEPS.find(s => s.key === key)?.label || key;
                    const ranges = { shipped: [0,25], in_transit: [25,50], out_for_delivery: [50,75], delivered: [75,100] };
                    const [sStart, sEnd] = ranges[key] || [25,50];
                    let done = computedProgressPercent >= sEnd;
                    let active = computedProgressPercent >= sStart && computedProgressPercent < sEnd;
                    if (key === 'shipped') {
                      done = hasShippedScan;
                      active = !hasShippedScan && hasReadyToShip;
                    }
              return (
                <React.Fragment key={key}>
                  {/* left column: marker */}
                          <div className="flex items-start justify-center z-10">
                            <div
                                ref={el => markerRefs.current[idx] = el}
                                className={`w-3 h-3 rounded-full ${ done ? 'bg-green-600' : (active ? 'bg-yellow-500' : 'bg-gray-300')}`}
                              />
                          </div>
                  {/* right column: content */}
                  <div className="z-10 pl-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-sm text-gray-800">{label} <span className="text-xs text-gray-500">· {items.length} update{items.length>1?'s':''}</span></div>
                        {latest && <div className="text-xs text-gray-500 mt-1">{latest.activity || latest['sr-status-label'] || latest.status || ''} • {latest.date ? new Date(latest.date).toLocaleString() : ''}</div>}
                      </div>
                      <div>
                        {items.length > 0 && (
                          <button className="text-xs text-blue-600 hover:underline" onClick={() => toggleStep(key)}>{isOpen ? 'Hide details' : 'View details'}</button>
                        )}
                      </div>
                    </div>
                    {/* Expanded scans for this step */}
                    {isOpen && items.length > 0 && (
                      <div className="mt-3 space-y-2 pl-6">
                        {(() => {
                          const latestTimestamp = sortedAsc.length ? (Date.parse(sortedAsc[sortedAsc.length - 1].date) || 0) : 0;
                          return items.map((ev, i) => {
                            const evTs = ev && ev.date ? (Date.parse(ev.date) || 0) : 0;
                            const evDone = latestTimestamp > 0 ? (evTs <= latestTimestamp) : true;
                            return (
                              <div key={i} className="flex items-start gap-3 p-2 bg-white rounded border">
                                <div className={`w-3 h-3 rounded-full ${evDone ? 'bg-green-600' : 'bg-gray-300'} mt-1`} />
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-gray-800">{ev.activity || ev['sr-status-label'] || ev.status || 'Update'}</div>
                                  {ev.location && <div className="text-xs text-gray-500 mt-1">{ev.location}</div>}
                                </div>
                                <div className="text-xs text-gray-400 whitespace-nowrap">{ev.date ? new Date(ev.date).toLocaleString() : ''}</div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>
      </div>
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('ShipmentTracker render error', err);
    return (
      <div className="w-full mt-3 text-sm text-red-600">Shipment tracker failed to render.</div>
    );
  }
}
