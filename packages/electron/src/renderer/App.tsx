import { useEffect } from 'react';
import { useInsightStore } from './store';
import { Header } from './components/Header';
import { EventStream } from './components/EventStream';
import { EventDetail } from './components/EventDetail';

export function App() {
  const addEvents = useInsightStore(s => s.addEvents);
  const clearEvents = useInsightStore(s => s.clearEvents);
  const addSession = useInsightStore(s => s.addSession);
  const endSession = useInsightStore(s => s.endSession);

  useEffect(() => {
    if (!window.insightAPI) return;

    const unsubs = [
      window.insightAPI.onNewEvents((events) => {
        addEvents(events);
      }),
      window.insightAPI.onEventsCleared(() => {
        clearEvents();
      }),
      window.insightAPI.onSessionStarted((session) => {
        addSession(session);
      }),
      window.insightAPI.onSessionEnded((sessionId) => {
        endSession(sessionId);
      }),
    ];

    return () => { unsubs.forEach(fn => fn()); };
  }, [addEvents, clearEvents, addSession, endSession]);

  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="flex min-h-0 flex-1">
        <EventStream />
        <EventDetail />
      </div>
    </div>
  );
}
