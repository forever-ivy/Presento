import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Presento | 课程项目答辩 AI 教练",
  description: "上传课程项目资料，对着 PPT 与 AI 老师实时训练答辩。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
