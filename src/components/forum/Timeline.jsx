import React from 'react';

const Timeline = ({ entries = [] }) => {
  function scrollToId(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return (
    <aside className="w-48 hidden lg:block">
      <div className="sticky top-28">
        <div className="text-sm font-semibold mb-3">Activity</div>
        <div className="space-y-3">
          {entries.map((e, i) => (
            <button key={i} onClick={() => scrollToId(e.targetId)} className="w-full text-left flex items-start gap-2 p-2 rounded hover:bg-slate-50 transition text-sm">
              <div className="w-2 h-2 rounded-full mt-1 bg-sky-600" />
              <div>
                <div className="font-medium text-slate-900">{e.title}</div>
                <div className="text-xs text-muted-foreground">{e.time}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
};

export default Timeline;
