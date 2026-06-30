import type { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = {
  title: "Admin — Pandit G",
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="admin-wa h-screen overflow-hidden bg-[#111b21] text-[#e9edef]">
      {children}
    </div>
  );
}
