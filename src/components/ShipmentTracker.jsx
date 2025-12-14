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
  if (s.includes('ship') || s.includes('shipped') || s.includes('ready')) return 'shipped';
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
  const [showAll, setShowAll] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({});

  // Defensive normalization for events array and sorting
  const safeEvents = Array.isArray(events)
    ? events.map(e => (typeof e === 'string' ? { activity: e } : e)).filter(Boolean)
    : [];

  // Sort events by date desc (latest first). If no date, keep at end.
  const sorted = safeEvents.slice().sort((a, b) => {
    const da = a && a.date ? Date.parse(a.date) || 0 : 0;
    const db = b && b.date ? Date.parse(b.date) || 0 : 0;
    return db - da;
  });

  // Derive status from latest scan when available, otherwise fall back to `status` prop
  const latestEvent = sorted.length > 0 ? sorted[0] : null;
  const eventText = latestEvent ? (latestEvent['sr-status-label'] || latestEvent.sr_status_label || latestEvent.activity || latestEvent.status || '') : '';
  const eventDerived = eventText ? normalizeStatus(eventText) : null;
  const effectiveStatus = eventDerived || normalizeStatus(status);
  const activeIndex = effectiveStatus ? STEPS.findIndex(s => s.key === effectiveStatus) : -1;
  const isDelivered = effectiveStatus === 'delivered';
  // If delivered, consider the final step completed; otherwise completed steps are those before the activeIndex.
  const filledIndex = isDelivered ? activeIndex : (activeIndex > 0 ? (activeIndex - 1) : -1);
  // Progress should represent completed steps only (not include the active step). When delivered, include final step.
  const progressPercent = filledIndex === -1 ? 0 : ((filledIndex + 1) / (STEPS.length - 1)) * 100;

  // Map each scan to one of the canonical steps so we can render a single vertical timeline
  function stepKeyForEvent(ev) {
    const txt = (ev && (ev['sr-status-label'] || ev.sr_status_label || ev.activity || ev.status || '') + '').toLowerCase();
    if (!txt) return 'in_transit';
    const ns = normalizeStatus(txt);
    if (ns) return ns;
    if (txt.includes('manifest')) return 'shipped';
    if (txt.includes('out for delivery') || txt.includes('ofd')) return 'out_for_delivery';
    if (txt.includes('deliver') || txt.includes('delivered') || txt.includes('dlv')) return 'delivered';
    if (txt.includes('pick') || txt.includes('bag') || txt.includes('facility') || txt.includes('trip') || txt.includes('in transit')) return 'in_transit';
    return 'in_transit';
  }

  const STEP_KEYS = ['shipped', 'in_transit', 'out_for_delivery', 'delivered'];
  const stepBuckets = STEP_KEYS.reduce((acc, k) => { acc[k] = []; return acc; }, {});
  sorted.forEach(ev => {
    const key = stepKeyForEvent(ev) || 'in_transit';
    stepBuckets[key] = stepBuckets[key] || [];
    stepBuckets[key].push(ev);
  });

  // Per-step expand state
  const [openSteps, setOpenSteps] = useState({});
  function toggleStep(k) { setOpenSteps(s => ({ ...s, [k]: !s[k] })); }
  // Refs for measuring marker positions so the vertical line exactly spans markers
  const containerRef = useRef(null);
  const markerRefs = useRef([]);
  const [verticalDims, setVerticalDims] = useState({ top: 0, height: 0, progressHeight: 0 });

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
      // progressHeight: from first center to last completed marker center
      const completedIndex = Math.min(Math.max(filledIndex, -1), markers.length - 1);
      const progressHeight = completedIndex === -1 ? 0 : ((markers[completedIndex].getBoundingClientRect().top - first.top) + (markerSize / 2));
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
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('resize', scheduleCompute);
    };
  }, [sorted.length, filledIndex, STEP_KEYS.length, JSON.stringify(openSteps)]);

  return (
    <div className="w-full mt-3">
      {/* Single top-level progress bar (fixed height, does not push content) */}
      <div className="w-full">
        <div className="relative w-full h-20 px-6 py-3 overflow-hidden">
          {/* Background rail centered vertically */}
          <div className="absolute left-6 right-6 top-1/2 transform -translate-y-1/2 h-1 bg-gray-200 rounded z-0" />
          {/* Filled progress (width based on completed steps) */}
          <div
            className="absolute left-6 top-1/2 transform -translate-y-1/2 h-1 bg-green-500 rounded z-0"
            style={{ width: `calc(${progressPercent}% - 0px)` }}
          />
          <div className="relative z-10 flex items-center justify-between h-full px-4">
            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              const done = isDelivered ? idx <= activeIndex : (activeIndex > idx && activeIndex !== -1);
              const active = !isDelivered && activeIndex === idx;
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
        {sorted.length === 0 ? (
          <div className="text-xs text-gray-500">No tracking updates available yet.</div>
        ) : (
          <div className="relative grid grid-cols-[48px_1fr] gap-y-6" ref={containerRef}>
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
              return (
                <React.Fragment key={key}>
                  {/* left column: marker */}
                          <div className="flex items-start justify-center z-10">
                            <div
                              ref={el => markerRefs.current[idx] = el}
                              className={`w-3 h-3 rounded-full ${ (isDelivered ? idx <= activeIndex : idx < activeIndex) ? 'bg-green-600' : (idx === activeIndex && !isDelivered ? 'bg-yellow-500' : 'bg-gray-300')}`}
                            />
                          </div>
                  {/* right column: content */}
                  <div className="z-10 pl-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-800">{label} <span className="text-xs text-gray-500">· {items.length} update{items.length>1?'s':''}</span></div>
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
                        {items.map((ev, i) => (
                          <div key={i} className="flex items-start gap-3 p-2 bg-white rounded border">
                            <div className="w-3 h-3 rounded-full bg-gray-300 mt-1" />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-800">{ev.activity || ev['sr-status-label'] || ev.status || 'Update'}</div>
                              {ev.location && <div className="text-xs text-gray-500 mt-1">{ev.location}</div>}
                            </div>
                            <div className="text-xs text-gray-400 whitespace-nowrap">{ev.date ? new Date(ev.date).toLocaleString() : ''}</div>
                          </div>
                        ))}
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
}
