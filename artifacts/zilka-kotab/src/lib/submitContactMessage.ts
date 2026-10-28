export type ContactMessageInput = {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  website?: string;
  consent: boolean;
};

function readCsrfToken() {
  const cookie = document.cookie.split('; ').find((item) => item.startsWith('zk_csrf='));
  const token = cookie?.slice('zk_csrf='.length);
  return token ? decodeURIComponent(token) : undefined;
}

export async function submitContactMessage(data: ContactMessageInput): Promise<void> {
  const csrf = readCsrfToken();
  const response = await fetch('/api/contact', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(csrf ? { 'x-csrf-token': csrf } : {}),
    },
    body: JSON.stringify(data),
  });
  const result = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) {
    const message = result.error === 'Invalid CSRF token.'
      ? 'Your security token expired. Refresh the page and try again.'
      : result.error || 'We could not send your message. Please try again.';
    throw new Error(message);
  }
}
