import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
export const metadata: Metadata = { title: { default: "hutian · 协作工作台", template: "%s · hutian" }, description: "创建持续角色，一起完成真实项目。", icons: { icon: "/brand/hutian-mark.png" } };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark">
      <body>
        <a href="#main-content" className="skip-link">跳转到内容</a>
        {children}
        <Toaster theme="dark" position="top-center" richColors closeButton
          containerAriaLabel="通知" toastOptions={{ closeButtonAriaLabel: "关闭通知" }} />
      </body>
    </html>
  );
}
