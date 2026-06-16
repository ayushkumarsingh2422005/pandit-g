"use client";

import { useLanguage } from "../i18n/LanguageProvider";

export default function LanguageToggle({ scrolled }: { scrolled: boolean }) {
  const { locale, setLocale } = useLanguage();

  return (
    <div
      className={`flex items-center rounded-full p-0.5 text-xs font-semibold ${
        scrolled ? "bg-gray-100" : "bg-white/15 backdrop-blur-sm"
      }`}
      role="group"
      aria-label="Language toggle"
    >
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={`rounded-full px-3 py-1.5 transition-colors ${
          locale === "en"
            ? scrolled
              ? "bg-coral text-white"
              : "bg-white text-gray-900"
            : scrolled
              ? "text-gray-600 hover:text-gray-900"
              : "text-white/80 hover:text-white"
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLocale("hi")}
        className={`rounded-full px-3 py-1.5 transition-colors ${
          locale === "hi"
            ? scrolled
              ? "bg-coral text-white"
              : "bg-white text-gray-900"
            : scrolled
              ? "text-gray-600 hover:text-gray-900"
              : "text-white/80 hover:text-white"
        }`}
      >
        हिं
      </button>
    </div>
  );
}
