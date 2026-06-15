"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FaWhatsapp } from "react-icons/fa6";

const WHATSAPP_URL = "https://wa.me/919876543210";

const navLinks = [
  { label: "How It Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "About", href: "#about" },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);

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
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <Link
          href="#"
          className={`text-xl font-bold tracking-tight transition-colors ${
            scrolled ? "text-gray-900" : "text-white"
          }`}
        >
          Pandit <span className="text-coral">G</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors hover:text-coral ${
                scrolled ? "text-gray-700" : "text-white/90"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Link
          href={WHATSAPP_URL}
          className="inline-flex items-center gap-2 rounded-full bg-coral px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-coral/90"
        >
          <FaWhatsapp className="size-4" />
          Chat Now
        </Link>
      </div>
    </header>
  );
}
