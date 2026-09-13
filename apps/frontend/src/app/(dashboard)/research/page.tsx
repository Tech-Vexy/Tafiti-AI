import type { Metadata } from 'next';
import ResearchChat from './ResearchChat';

export const metadata: Metadata = {
  title: 'Research',
  description: 'Ask grounded questions of 200M+ academic papers with citations.',
};

export default function Page() {
  return <ResearchChat />;
}
