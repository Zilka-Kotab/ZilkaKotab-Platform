export type ContactMessageInput = {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  website?: string;
  consent: boolean;
};

export async function submitContactMessage(data: ContactMessageInput): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35_000);
  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      // This is an anonymous contact form, not a portal mutation.
      credentials: 'omit',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json().catch(() => null) as { success?: boolean; error?: string } | null;
    if (!response.ok || result?.success !== true) {
      throw new Error(result?.error || 'We could not confirm your message was sent. Your entries have been kept. Please try again later or call (408) 971-2573.');
    }
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('The send request timed out. We cannot confirm delivery. Your entries have been kept. Please call (408) 971-2573 rather than submitting repeatedly.');
    }
    if (error instanceof TypeError) {
      throw new Error('We could not reach the messaging service. Your entries have been kept. Please check your connection or call (408) 971-2573.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
