import type { Metadata } from 'next';
import ResearchHistory from './ResearchHistory';

export const metadata: Metadata = {
  title: 'History',
  description: 'Past research investigations and conversations.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function Page() {
  return <ResearchHistory />;
}
