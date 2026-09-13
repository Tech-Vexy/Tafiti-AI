import type { Metadata } from 'next';
import ProfilePanel from './ProfilePanel';

export const metadata: Metadata = {
  title: 'Profile',
  description: 'Your Tafiti AI account, preferences, and researcher profile.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function Page() {
  return <ProfilePanel />;
}
