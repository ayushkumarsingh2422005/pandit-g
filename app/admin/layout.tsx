import type { Metadata, Viewport } from "next";
import "./admin.css";

export const metadata: Metadata = {
  title: "Admin — Pandit G",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="admin-wa admin-shell overflow-hidden bg-[#111b21] text-[#e9edef]">
      {children}
    </div>
  );
}
