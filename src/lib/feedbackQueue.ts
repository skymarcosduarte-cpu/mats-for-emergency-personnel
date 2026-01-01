import { get, set } from 'idb-keyval';
import { supabase } from '@/integrations/supabase/client';

export interface QueuedFeedback {
  id: string;
  category: string;
  name: string;
  email: string;
  message: string;
  userId: string | null;
  createdAt: string;
}

const QUEUE_KEY = 'offline-feedback-queue';

export async function getQueue(): Promise<QueuedFeedback[]> {
  const queue = await get<QueuedFeedback[]>(QUEUE_KEY);
  return queue ?? [];
}

export async function addToQueue(feedback: Omit<QueuedFeedback, 'id' | 'createdAt'>): Promise<void> {
  const queue = await getQueue();
  const item: QueuedFeedback = {
    ...feedback,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  queue.push(item);
  await set(QUEUE_KEY, queue);
  console.log('[FeedbackQueue] Added to queue:', item.id);
}

export async function removeFromQueue(id: string): Promise<void> {
  const queue = await getQueue();
  const filtered = queue.filter((item) => item.id !== id);
  await set(QUEUE_KEY, filtered);
  console.log('[FeedbackQueue] Removed from queue:', id);
}

export async function processQueue(): Promise<{ sent: number; failed: number }> {
  const queue = await getQueue();
  if (queue.length === 0) {
    return { sent: 0, failed: 0 };
  }

  console.log('[FeedbackQueue] Processing queue, items:', queue.length);

  let sent = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      const { error } = await supabase.from('user_feedback').insert({
        user_id: item.userId,
        category: item.category,
        name: item.name,
        email: item.email,
        message: item.message,
      });

      if (error) {
        console.error('[FeedbackQueue] Failed to send:', item.id, error);
        failed++;
      } else {
        await removeFromQueue(item.id);
        sent++;
        console.log('[FeedbackQueue] Sent successfully:', item.id);
      }
    } catch (err) {
      console.error('[FeedbackQueue] Error processing item:', item.id, err);
      failed++;
    }
  }

  return { sent, failed };
}

export function getQueueLength(): Promise<number> {
  return getQueue().then((q) => q.length);
}
