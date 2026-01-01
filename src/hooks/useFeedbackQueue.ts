import { useEffect, useCallback, useRef } from 'react';
import { processQueue, getQueueLength } from '@/lib/feedbackQueue';
import { toast } from '@/hooks/use-toast';

/**
 * Hook that monitors online status and processes the offline feedback queue
 * when the connection is restored.
 */
export function useFeedbackQueue() {
  const processingRef = useRef(false);

  const tryProcessQueue = useCallback(async () => {
    if (processingRef.current) return;
    if (!navigator.onLine) return;

    const length = await getQueueLength();
    if (length === 0) return;

    processingRef.current = true;
    console.log('[useFeedbackQueue] Connection restored, processing queue...');

    try {
      const { sent, failed } = await processQueue();

      if (sent > 0) {
        toast({
          title: 'Feedback enviado',
          description: `${sent} mensaje(s) pendiente(s) enviado(s) correctamente.`,
        });
      }

      if (failed > 0) {
        console.warn('[useFeedbackQueue] Some items failed, will retry later');
      }
    } catch (err) {
      console.error('[useFeedbackQueue] Error processing queue:', err);
    } finally {
      processingRef.current = false;
    }
  }, []);

  useEffect(() => {
    // Process queue on mount if online
    void tryProcessQueue();

    const handleOnline = () => {
      console.log('[useFeedbackQueue] Online event detected');
      void tryProcessQueue();
    };

    window.addEventListener('online', handleOnline);

    // Also check periodically (every 30 seconds) in case events are missed
    const interval = setInterval(() => {
      if (navigator.onLine) {
        void tryProcessQueue();
      }
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      clearInterval(interval);
    };
  }, [tryProcessQueue]);

  return { processQueue: tryProcessQueue };
}

export default useFeedbackQueue;
