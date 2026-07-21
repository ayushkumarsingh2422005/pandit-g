"use client";

import Image from "next/image";
import Link from "next/link";
import type { IconType } from "react-icons";
import {
  HiBanknotes,
  HiBriefcase,
  HiChatBubbleLeftRight,
  HiClock,
  HiHeart,
  HiSparkles,
  HiStar,
  HiUserGroup,
} from "react-icons/hi2";
import { FaRing, FaWhatsapp } from "react-icons/fa6";
import { GiCrystalBall, GiPrayerBeads, GiSunRadiations } from "react-icons/gi";
import { getPublicConsultationPricing } from "@/lib/config/consultation-pricing";
import { useLanguage } from "../i18n/LanguageProvider";
import Header from "./Header";

const WHATSAPP_URL = "https://wa.me/918815478644";

const featureIcons: IconType[] = [
  FaWhatsapp,
  GiCrystalBall,
  HiChatBubbleLeftRight,
  HiClock,
];

const statIcons: IconType[] = [
  HiUserGroup,
  GiPrayerBeads,
  HiChatBubbleLeftRight,
  HiStar,
];

const categoryIcons: IconType[] = [
  HiBriefcase,
  FaRing,
  HiBanknotes,
  HiHeart,
  HiUserGroup,
  GiSunRadiations,
];

const pricingIcons: IconType[] = [
  HiClock,
  HiChatBubbleLeftRight,
  GiCrystalBall,
  FaWhatsapp,
];

export default function HomePage() {
  const { locale, t } = useLanguage();
  const isHindi = locale === "hi";
  const pricing = getPublicConsultationPricing();

  const statLabels = [
    t.stats.peopleHelped,
    t.stats.yearsExperience,
    t.stats.whatsappChats,
    t.stats.clientRating,
  ];

  const statValues = ["12,000+", "25+", "8,500+", "4.9"];
  const statRatings = [false, false, false, true];

  return (
    <div className={`flex min-h-screen flex-col ${isHindi ? "font-hindi" : ""}`}>
      <Header />

      {/* Hero */}
      <section className="relative flex min-h-screen items-center overflow-hidden">
        <Image
          src="/bg.jpeg"
          alt=""
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-black/40" />

        <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-12 px-6 pt-24 pb-16 lg:grid-cols-2 lg:gap-8 lg:py-24">
          <div className="flex flex-col gap-6">
            <p className="flex items-center gap-2 text-sm font-medium text-gold">
              <HiSparkles className="size-4" />
              {t.hero.tagline}
              <HiSparkles className="size-4" />
            </p>

            <h1 className="text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
              {t.hero.title}{" "}
              <span className="text-coral">{t.hero.titleHighlight}</span>
            </h1>

            {/* <p className="text-lg text-white/80">{t.hero.subtitle}</p> */}

            <ul className="flex flex-col gap-3">
              {t.hero.features.map((text, i) => {
                const Icon = featureIcons[i];
                return (
                  <li
                    key={text}
                    className="flex items-start gap-3 text-base text-white/90 sm:text-lg"
                  >
                    <Icon className="mt-1 size-5 shrink-0 text-gold" />
                    <span>{text}</span>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-wrap gap-4 pt-2">
              <Link
                href={WHATSAPP_URL}
                className="inline-flex items-center gap-2 rounded-full bg-coral px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-coral/30 transition-all hover:bg-coral/90 hover:shadow-coral/50"
              >
                <FaWhatsapp className="size-5" />
                {t.hero.ctaPrimary}
              </Link>
              <Link
                href="#pricing"
                className="inline-flex items-center rounded-full border border-white/30 px-8 py-3.5 text-base font-semibold text-white transition-colors hover:bg-white/10"
              >
                {t.hero.ctaSecondary}
              </Link>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div className="relative aspect-square w-full max-w-md lg:max-w-lg xl:max-w-xl">
              <div className="animate-spin-slow relative h-full w-full">
                <Image
                  src="/circle.png"
                  alt="Zodiac wheel"
                  fill
                  priority
                  className="object-contain drop-shadow-[0_0_60px_rgba(80,160,255,0.4)]"
                  sizes="(max-width: 1024px) 80vw, 40vw"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-gray-950 py-14">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-6 md:grid-cols-4">
          {statLabels.map((label, i) => {
            const Icon = statIcons[i];
            return (
              <div key={label} className="text-center">
                <Icon className="mx-auto mb-2 size-6 text-gold/70" />
                <p className="flex items-center justify-center gap-1 text-3xl font-bold text-coral sm:text-4xl">
                  {statValues[i]}
                  {statRatings[i] && <HiStar className="size-6 text-gold" />}
                </p>
                <p className="mt-1 text-sm text-gray-400 sm:text-base">{label}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12 text-center">
            <p className="text-sm font-medium text-coral">{t.howItWorks.eyebrow}</p>
            <h2 className="mt-2 text-3xl font-bold text-gray-900 sm:text-4xl">
              {t.howItWorks.title}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-gray-600">
              {t.howItWorks.subtitle}
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {t.howItWorks.steps.map((item, i) => (
              <div
                key={item.title}
                className="rounded-2xl border border-gray-100 bg-gray-50 p-8 text-center"
              >
                <span className="inline-flex size-12 items-center justify-center rounded-full bg-coral text-lg font-bold text-white">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Problems */}
      <section id="samasyaen" className="bg-gray-50 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12 text-center">
            <p className="text-sm font-medium text-coral">{t.problems.eyebrow}</p>
            <h2 className="mt-2 text-3xl font-bold text-gray-900 sm:text-4xl">
              {t.problems.title}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-gray-600">
              {t.problems.subtitle}
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            {t.problems.categories.map((category, i) => {
              const Icon = categoryIcons[i];
              return (
                <article
                  key={category.title}
                  className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-coral/10">
                      <Icon className="size-6 text-coral" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold tracking-wide text-coral uppercase">
                        {i + 1}. {category.subtitle}
                      </p>
                      <h3 className="mt-1 text-xl font-bold text-gray-900">
                        {category.title}
                      </h3>
                    </div>
                  </div>

                  {"intro" in category && category.intro && (
                    <p className="mt-4 text-sm leading-relaxed text-gray-600">
                      {category.intro}
                    </p>
                  )}

                  <ul className="mt-5 space-y-4">
                    {category.items.map((problem) => (
                      <li key={problem.title} className="flex gap-3">
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-coral" />
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {problem.title}
                          </p>
                          <p className="mt-0.5 text-sm leading-relaxed text-gray-600">
                            {problem.desc}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>

          <div className="mt-12 text-center">
            <p className="text-gray-600">{t.problems.ctaText}</p>
            <Link
              href={WHATSAPP_URL}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-coral px-8 py-3.5 text-base font-semibold text-white transition-colors hover:bg-coral/90"
            >
              <FaWhatsapp className="size-5" />
              {t.problems.ctaButton}
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12 text-center">
            <p className="text-sm font-medium text-coral">{t.pricing.eyebrow}</p>
            <h2 className="mt-2 text-3xl font-bold text-gray-900 sm:text-4xl">
              {t.pricing.title}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-gray-600">
              {t.pricing.subtitle}
            </p>
          </div>

          <div className="mx-auto max-w-lg overflow-hidden rounded-3xl border-2 border-coral/20 bg-gray-50 shadow-lg">
            <div className="bg-coral px-8 py-6 text-center text-white">
              <FaWhatsapp className="mx-auto size-10" />
              <p className="mt-3 text-sm font-medium uppercase tracking-wide opacity-90">
                {t.pricing.cardTitle}
              </p>
            </div>

            <div className="px-8 py-10 text-center">
              <p className="text-5xl font-bold text-gray-900">
                {pricing.priceInrFormatted}
                <span className="text-2xl font-medium text-gray-500">
                  {" "}
                  / {pricing.sessionMinutes} {isHindi ? "मिनट" : "min"}
                </span>
              </p>
              <p className="mt-3 text-lg text-gray-600">
                {isHindi ? pricing.offerLineHi : pricing.offerLineEn}
              </p>

              <ul className="mt-8 space-y-3 text-left text-sm text-gray-600">
                {t.pricing.bullets.map((bullet, i) => {
                  const Icon = pricingIcons[i];
                  return (
                    <li key={bullet} className="flex items-start gap-2">
                      <Icon className="mt-0.5 size-4 shrink-0 text-coral" />
                      {bullet}
                    </li>
                  );
                })}
              </ul>

              <Link
                href={WHATSAPP_URL}
                className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-coral px-8 py-3.5 text-base font-semibold text-white transition-colors hover:bg-coral/90"
              >
                <FaWhatsapp className="size-5" />
                {t.pricing.cta}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="relative overflow-hidden py-20">
        <Image src="/bg.jpeg" alt="" fill className="object-cover" sizes="100vw" />
        <div className="absolute inset-0 bg-gray-950/85" />

        <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
          <p className="text-sm font-medium text-gold">{t.about.eyebrow}</p>
          <h2 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
            {t.about.title}
          </h2>
          <p className="mt-6 leading-relaxed text-gray-300">{t.about.p1}</p>
          <p className="mt-4 leading-relaxed text-gray-300">{t.about.p2}</p>

          <Link
            href={WHATSAPP_URL}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-coral px-8 py-3.5 text-base font-semibold text-white transition-colors hover:bg-coral/90"
          >
            <FaWhatsapp className="size-5" />
            {t.about.cta}
          </Link>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12 text-center">
            <p className="text-sm font-medium text-coral">{t.testimonials.eyebrow}</p>
            <h2 className="mt-2 text-3xl font-bold text-gray-900 sm:text-4xl">
              {t.testimonials.title}
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {t.testimonials.items.map((item) => (
              <blockquote
                key={item.name}
                className="rounded-2xl border border-gray-100 bg-gray-50 p-6"
              >
                <HiSparkles className="mb-3 size-5 text-coral/60" />
                <p className="text-sm leading-relaxed text-gray-600">
                  &ldquo;{item.text}&rdquo;
                </p>
                <footer className="mt-4 text-sm font-semibold text-gray-900">
                  — {item.name}
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="bg-gray-950 py-16">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <FaWhatsapp className="mx-auto size-12 text-coral" />
          <h2 className="mt-4 text-3xl font-bold text-white sm:text-4xl">
            {t.footerCta.title}
          </h2>
          <p className="mt-4 text-gray-400">{t.footerCta.subtitle}</p>
          <Link
            href={WHATSAPP_URL}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-coral px-10 py-3.5 text-base font-semibold text-white transition-colors hover:bg-coral/90"
          >
            <FaWhatsapp className="size-5" />
            {t.footerCta.cta}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-gray-950 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-6 text-center">
          <div className="flex w-full flex-col items-center justify-between gap-4 sm:flex-row sm:text-left">
            <p className="text-sm text-gray-500">
              © {new Date().getFullYear()} Pandit G. {t.footer.rights}
            </p>
            <p className="text-sm text-gray-500">{t.footer.tagline}</p>
          </div>
          <p className="text-sm text-gray-500">
            {t.footer.designedBy}{" "}
            <Link
              href="https://digicraft.one"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 transition-colors hover:text-coral"
            >
              DigiCraft
            </Link>{" "}
            (Digicraft.one)
          </p>
          <Link
            href="/privacy"
            className="text-sm text-gray-500 transition-colors hover:text-coral"
          >
            Privacy Policy
          </Link>
        </div>
      </footer>
    </div>
  );
}
