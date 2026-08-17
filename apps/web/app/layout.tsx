import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SayClear',
  description: '读完不算数，说清才算懂。',
  ...(process.env.NEXT_PUBLIC_WAFFO_VERIFY_CONTENT
    ? {
        other: {
          'waffo-verify': process.env.NEXT_PUBLIC_WAFFO_VERIFY_CONTENT,
        },
      }
    : {}),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
