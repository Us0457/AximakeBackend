
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wruysjrqadlsljnkmnte.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndydXlzanJxYWRsc2xqbmttbnRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc4NzA1NzksImV4cCI6MjA2MzQ0NjU3OX0.E4oUnKQ87s5ZBQfE2cWt7R6SkNbMnRQW2wvj2oD91KM';

// Create client with default options; additional realtime/debug options can be passed here
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    // keep default behaviour but allow realtime params if needed
    realtime: {
        // no-op default; tuning can be applied here later
    },
});

// Attach safe logging and reconnect helpers for debug/diagnostics in browser
function tryAttachRealtimeDebug() {
    try {
        if (typeof window === 'undefined') return;
        // Online/offline handlers
        window.addEventListener('online', () => {
            console.info('[supabase] network online — attempting realtime reconnect');
            try {
                if (supabase && supabase.realtime && typeof supabase.realtime.connect === 'function') {
                    supabase.realtime.connect();
                }
            } catch (e) {
                console.warn('[supabase] realtime reconnect failed', e);
            }
        });
        window.addEventListener('offline', () => {
            console.warn('[supabase] network offline — realtime will be paused');
        });

        // Attach realtime lifecycle hooks if available (defensive checks)
        const rt = supabase && supabase.realtime;
        if (!rt) return;
        if (typeof rt.onOpen === 'function') rt.onOpen(() => console.info('[supabase] realtime open'));
        if (typeof rt.onClose === 'function') rt.onClose(() => console.warn('[supabase] realtime closed'));
        if (typeof rt.onError === 'function') rt.onError((err) => console.error('[supabase] realtime error', err));
        // Some builds expose an 'on' or 'onMessage' hook — attach cautiously
        if (typeof rt.on === 'function') {
            try {
                rt.on('*', (payload) => console.debug('[supabase] realtime payload', payload));
            } catch (e) {
                // ignore if not supported
            }
        }
    } catch (e) {
        // Don't let debug attach break the app
        // eslint-disable-next-line no-console
        console.warn('[supabase] failed to attach realtime debug hooks', e);
    }
}

tryAttachRealtimeDebug();

// Export a small helper to attempt a reconnect from other modules
export async function ensureRealtimeConnected() {
    try {
        if (typeof window === 'undefined') return false;
        if (supabase && supabase.realtime && typeof supabase.realtime.connect === 'function') {
            await supabase.realtime.connect();
            console.info('[supabase] ensureRealtimeConnected: connect invoked');
            return true;
        }
        console.info('[supabase] ensureRealtimeConnected: realtime connect not available');
        return false;
    } catch (e) {
        console.warn('[supabase] ensureRealtimeConnected failed', e);
        return false;
    }
}
