"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FaWhatsapp } from "react-icons/fa6";
import { useLanguage } from "../i18n/LanguageProvider";
import LanguageToggle from "./LanguageToggle";

const WHATSAPP_URL = "https://wa.me/919876543210";

const navHrefs = [
  { key: "howItWorks" as const, href: "#how-it-works" },
  { key: "problems" as const, href: "#samasyaen" },
  { key: "pricing" as const, href: "#pricing" },
  { key: "about" as const, href: "#about" },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 right-0 left-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-white shadow-md" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:gap-4 sm:px-6">
        <Link
          href="#"
          className={`shrink-0 text-xl font-bold tracking-tight transition-colors ${
            scrolled ? "text-gray-900" : "text-white"
          }`}
        >
          Pandit <span className="text-coral">G</span>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex xl:gap-8">
          {navHrefs.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors hover:text-coral ${
                scrolled ? "text-gray-700" : "text-white/90"
              }`}
            >
              {t.nav[link.key]}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageToggle scrolled={scrolled} />
          <Link
            href={WHATSAPP_URL}
            className="inline-flex items-center gap-1.5 rounded-full bg-coral px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-coral/90 sm:gap-2 sm:px-5"
          >
            <FaWhatsapp className="size-4 shrink-0" />
            <span className="hidden sm:inline">{t.nav.chatNow}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
