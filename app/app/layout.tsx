import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '共见塔罗',
  description: '微信群多人共用的塔罗抽牌与后续反馈记录工具',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
