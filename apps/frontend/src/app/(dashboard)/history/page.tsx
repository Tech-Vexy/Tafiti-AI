import type { Metadata } from 'next';
import ResearchHistory from './ResearchHistory';

export const metadata: Metadata = {
  title: 'History',
  description: 'Past research investigations and conversations.',
};

export default function Page() {
  return <ResearchHistory />;
}
