import Image from "next/image";
import Link from "next/link";
import type { IconType } from "react-icons";
import {
  HiBriefcase,
  HiChartBarSquare,
  HiChatBubbleLeftRight,
  HiClock,
  HiHeart,
  HiSparkles,
  HiStar,
  HiUserGroup,
} from "react-icons/hi2";
import { FaRing, FaWhatsapp } from "react-icons/fa6";
import { GiCrystalBall, GiPrayerBeads } from "react-icons/gi";
import Header from "./components/Header";

const WHATSAPP_URL = "https://wa.me/919876543210";

const features: { icon: IconType; text: string }[] = [
  {
    icon: FaWhatsapp,
    text: "Chat with Pandit G directly on WhatsApp — no app download needed",
  },
  {
    icon: GiCrystalBall,
    text: "Ask about your Kundli, marriage, career, health, or future",
  },
  {
    icon: HiChatBubbleLeftRight,
    text: "Get instant, thoughtful answers powered by Pandit G's Vedic wisdom",
  },
  {
    icon: HiClock,
    text: "Simple pay-as-you-chat pricing — ₹151 per 3 min, 30 min window",
  },
];

const stats = [
  { value: "12,000+", label: "People Helped", icon: HiUserGroup },
  { value: "25+", label: "Years Experience", icon: GiPrayerBeads },
  { value: "8,500+", label: "WhatsApp Chats", icon: HiChatBubbleLeftRight },
  { value: "4.9", label: "Client Rating", icon: HiStar, isRating: true },
];

const topics: { icon: IconType; title: string; desc: string }[] = [
  {
    icon: HiChartBarSquare,
    title: "Kundli & Horoscope",
    desc: "Birth chart insights, planetary positions, and dasha predictions.",
  },
  {
    icon: FaRing,
    title: "Marriage & Love",
    desc: "Compatibility, relationship timing, and marriage guidance.",
  },
  {
    icon: HiBriefcase,
    title: "Career & Finance",
    desc: "Job changes, business decisions, and financial direction.",
  },
  {
    icon: HiHeart,
    title: "Health & Remedies",
    desc: "Planetary remedies, mantras, and gemstone suggestions.",
  },
];

const steps = [
  {
    step: "1",
    title: "Open WhatsApp",
    desc: "Tap the button below and send a message to Pandit G's chatbot.",
  },
  {
    step: "2",
    title: "Ask Your Question",
    desc: "Share your birth details and ask anything — kundli, career, marriage, and more.",
  },
  {
    step: "3",
    title: "Get Instant Answers",
    desc: "Receive guidance within your 30-minute chat window. Pay ₹151 per 3 minutes.",
  },
];

const testimonials = [
  {
    name: "Priya Sharma",
    text: "I asked about my career on WhatsApp and got a detailed, accurate response in minutes. So convenient!",
  },
  {
    name: "Rahul Mehta",
    text: "The chatbot answered all our marriage compatibility questions late at night. Worth every rupee.",
  },
  {
    name: "Anita Desai",
    text: "Simple pricing, no confusion. I chatted for 9 minutes, paid ₹453, and got exactly what I needed.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
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
              WhatsApp Astrology Chatbot
              <HiSparkles className="size-4" />
            </p>

            <h1 className="text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
              Ask Pandit G on{" "}
              <span className="text-coral">WhatsApp</span>
            </h1>

            <p className="text-lg text-white/80">
              Trusted Vedic astrology guidance, now just a WhatsApp message away.
              Ask your questions and get answers instantly.
            </p>

            <ul className="flex flex-col gap-3">
              {features.map((feature) => (
                <li
                  key={feature.text}
                  className="flex items-start gap-3 text-base text-white/90 sm:text-lg"
                >
                  <feature.icon className="mt-1 size-5 shrink-0 text-gold" />
                  <span>{feature.text}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-4 pt-2">
              <Link
                href={WHATSAPP_URL}
                className="inline-flex items-center gap-2 rounded-full bg-coral px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-coral/30 transition-all hover:bg-coral/90 hover:shadow-coral/50"
              >
                <FaWhatsapp className="size-5" />
                Start Chatting
              </Link>
              <Link
                href="#pricing"
                className="inline-flex items-center rounded-full border border-white/30 px-8 py-3.5 text-base font-semibold text-white transition-colors hover:bg-white/10"
              >
                View Pricing
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
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <stat.icon className="mx-auto mb-2 size-6 text-gold/70" />
              <p className="flex items-center justify-center gap-1 text-3xl font-bold text-coral sm:text-4xl">
                {stat.value}
                {"isRating" in stat && stat.isRating && (
                  <HiStar className="size-6 text-gold" />
                )}
              </p>
              <p className="mt-1 text-sm text-gray-400 sm:text-base">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12 text-center">
            <p className="text-sm font-medium text-coral">Simple & Fast</p>
            <h2 className="mt-2 text-3xl font-bold text-gray-900 sm:text-4xl">
              How It Works
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-gray-600">
              Three easy steps to get astrological guidance on WhatsApp.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((item) => (
              <div
                key={item.step}
                className="rounded-2xl border border-gray-100 bg-gray-50 p-8 text-center"
              >
                <span className="inline-flex size-12 items-center justify-center rounded-full bg-coral text-lg font-bold text-white">
                  {item.step}
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

      {/* Topics */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12 text-center">
            <p className="text-sm font-medium text-coral">Ask Anything</p>
            <h2 className="mt-2 text-3xl font-bold text-gray-900 sm:text-4xl">
              What You Can Ask
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-gray-600">
              Pandit G&apos;s WhatsApp chatbot covers all major areas of Vedic
              astrology.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {topics.map((topic) => (
              <div
                key={topic.title}
                className="rounded-2xl border border-gray-100 bg-white p-6 transition-shadow hover:shadow-md"
              >
                <topic.icon className="size-8 text-coral" />
                <h3 className="mt-3 text-lg font-semibold text-gray-900">
                  {topic.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  {topic.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12 text-center">
            <p className="text-sm font-medium text-coral">No Hidden Charges</p>
            <h2 className="mt-2 text-3xl font-bold text-gray-900 sm:text-4xl">
              Simple Pricing
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-gray-600">
              One straightforward rate. Pay only for the time you chat.
            </p>
          </div>

          <div className="mx-auto max-w-lg overflow-hidden rounded-3xl border-2 border-coral/20 bg-gray-50 shadow-lg">
            <div className="bg-coral px-8 py-6 text-center text-white">
              <FaWhatsapp className="mx-auto size-10" />
              <p className="mt-3 text-sm font-medium uppercase tracking-wide opacity-90">
                WhatsApp Consultation
              </p>
            </div>

            <div className="px-8 py-10 text-center">
              <p className="text-5xl font-bold text-gray-900">
                ₹151
                <span className="text-2xl font-medium text-gray-500"> / 3 min</span>
              </p>
              <p className="mt-3 text-lg text-gray-600">30-minute chat window</p>

              <ul className="mt-8 space-y-3 text-left text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <HiClock className="mt-0.5 size-4 shrink-0 text-coral" />
                  Each session lasts up to 30 minutes
                </li>
                <li className="flex items-start gap-2">
                  <HiChatBubbleLeftRight className="mt-0.5 size-4 shrink-0 text-coral" />
                  Charged at ₹151 for every 3 minutes of chat
                </li>
                <li className="flex items-start gap-2">
                  <GiCrystalBall className="mt-0.5 size-4 shrink-0 text-coral" />
                  Unlimited questions within your session
                </li>
                <li className="flex items-start gap-2">
                  <FaWhatsapp className="mt-0.5 size-4 shrink-0 text-coral" />
                  Start anytime — no appointment needed
                </li>
              </ul>

              <Link
                href={WHATSAPP_URL}
                className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-coral px-8 py-3.5 text-base font-semibold text-white transition-colors hover:bg-coral/90"
              >
                <FaWhatsapp className="size-5" />
                Chat on WhatsApp
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="relative overflow-hidden py-20">
        <Image
          src="/bg.jpeg"
          alt=""
          fill
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gray-950/85" />

        <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
          <p className="text-sm font-medium text-gold">About Pandit G</p>
          <h2 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
            25+ Years of Vedic Wisdom, Now on WhatsApp
          </h2>
          <p className="mt-6 leading-relaxed text-gray-300">
            Pandit G is a renowned Vedic astrologer who has guided thousands of
            families across India. His WhatsApp chatbot brings that same trusted
            knowledge to your fingertips — ask about your kundli, marriage,
            career, or remedies and get instant, thoughtful answers.
          </p>
          <p className="mt-4 leading-relaxed text-gray-300">
            No waiting, no complicated booking. Just open WhatsApp and start
            chatting.
          </p>

          <Link
            href={WHATSAPP_URL}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-coral px-8 py-3.5 text-base font-semibold text-white transition-colors hover:bg-coral/90"
          >
            <FaWhatsapp className="size-5" />
            Start Your Chat
          </Link>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12 text-center">
            <p className="text-sm font-medium text-coral">Testimonials</p>
            <h2 className="mt-2 text-3xl font-bold text-gray-900 sm:text-4xl">
              What People Say
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((t) => (
              <blockquote
                key={t.name}
                className="rounded-2xl border border-gray-100 bg-gray-50 p-6"
              >
                <HiSparkles className="mb-3 size-5 text-coral/60" />
                <p className="text-sm leading-relaxed text-gray-600">
                  &ldquo;{t.text}&rdquo;
                </p>
                <footer className="mt-4 text-sm font-semibold text-gray-900">
                  — {t.name}
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
            Ready to Ask Pandit G?
          </h2>
          <p className="mt-4 text-gray-400">
            Open WhatsApp, send a message, and get astrological guidance in
            minutes. ₹151 per 3 min · 30 min window.
          </p>
          <Link
            href={WHATSAPP_URL}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-coral px-10 py-3.5 text-base font-semibold text-white transition-colors hover:bg-coral/90"
          >
            <FaWhatsapp className="size-5" />
            Chat on WhatsApp
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-gray-950 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-6 text-center">
          <div className="flex w-full flex-col items-center justify-between gap-4 sm:flex-row sm:text-left">
            <p className="text-sm text-gray-500">
              © {new Date().getFullYear()} Pandit G. All rights reserved.
            </p>
            <p className="text-sm text-gray-500">
              Vedic Astrology on WhatsApp · Trusted since 1999
            </p>
          </div>
          <p className="text-sm text-gray-500">
            Designed and developed by{" "}
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
        </div>
      </footer>
    </div>
  );
}
