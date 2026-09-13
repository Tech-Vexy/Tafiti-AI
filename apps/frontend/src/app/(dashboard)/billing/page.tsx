import type { Metadata } from 'next';
import BillingPanel from './BillingPanel';

export const metadata: Metadata = {
  title: 'Billing & Plan',
  description: 'Manage your Tafiti AI subscription and invoices.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function Page() {
  return <BillingPanel />;
}
