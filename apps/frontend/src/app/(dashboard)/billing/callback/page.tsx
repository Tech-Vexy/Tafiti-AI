'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/app/api/client';

export default function BillingCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState('Verifying your payment...');

  useEffect(() => {
    const reference = searchParams.get('reference') || searchParams.get('trxref');
    if (!reference) {
      setMessage('No payment reference was provided.');
      return;
    }

    let cancelled = false;
    api.get(`/billing/verify/${encodeURIComponent(reference)}`)
      .then(({ data }) => {
        if (!cancelled) {
          setMessage(data?.status === 'success' ? 'Payment confirmed. Your subscription is active.' : 'Payment is still processing.');
        }
      })
      .catch(() => {
        if (!cancelled) setMessage('We could not verify this payment. Please contact support.');
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-2xl font-semibold">Payment status</h1>
      <p>{message}</p>
      <button
        type="button"
        className="rounded-md border px-4 py-2"
        onClick={() => router.push('/billing')}
      >
        Return to billing
      </button>
    </main>
  );
}
