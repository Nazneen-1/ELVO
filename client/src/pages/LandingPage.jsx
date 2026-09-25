import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Footer } from '../components/layout/Footer.jsx';
import { ArrowRight, Calendar, CheckSquare, Users, Zap, Shield } from 'lucide-react';

// ELVO Logo as inline SVG
const ElvoLogo = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="22" fill="#1C1C1C"/>
    <path d="M68 24 C52 18 30 22 24 38 C20 48 26 55 30 57" stroke="#D8D8D8" strokeWidth="8.5" strokeLinecap="round"/>
    <path d="M30 56 C42 50 56 55 68 62" stroke="#D8D8D8" strokeWidth="5.5" strokeLinecap="round"/>
    <path d="M30 60 C24 68 20 76 28 84 C36 92 52 86 68 80" stroke="#D8D8D8" strokeWidth="8.5" strokeLinecap="round"/>
  </svg>
);

const FEATURES = [
  {
    icon: Calendar,
    title: 'Plan',
    desc: 'A clear view of your time.',
  },
  {
    icon: CheckSquare,
    title: 'Organize',
    desc: 'Turn plans into progress.',
  },
  {
    icon: Users,
    title: 'Collaborate',
    desc: 'Work together, effortlessly.',
  },
  {
    icon: Shield,
    title: 'Focus',
    desc: 'Protect your deep work.',
  },
  {
    icon: Zap,
    title: 'Personalize',
    desc: 'Make it truly yours.',
  },
];

const FEATURE_CARDS = [
  {
    title: 'Calendar',
    desc: 'See your day clearly and plan ahead.',
    items: ['Deep Work — 09:00', 'Team Meeting — 11:30', 'Project Work — 14:00'],
  },
  {
    title: 'Tasks',
    desc: 'Turn plans into real progress.',
    items: ['✓ Finish documentation', '✓ Review experiment results', '○ Plan tomorrow'],
  },
  {
    title: 'Collaboration',
    desc: 'Work together, stay aligned.',
    items: ['Project ELVO — 62%', 'Paper Writing — 40%'],
  },
  {
    title: 'Focus',
    desc: "Don't just manage time. Protect it.",
    badge: '42:18',
    badgeSub: 'Deep Work',
  },
];

export const LandingPage = () => {
  const heroRef = useRef(null);

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F5F5] text-[#2B2B2B]">
      {/* ═══ NAVBAR ═══ */}
      <header className="sticky top-0 z-50 bg-[#F5F5F5]/90 backdrop-blur-md border-b border-[#E0E0E0]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <ElvoLogo size={32} />
            <span className="text-lg font-bold tracking-tight text-[#2B2B2B]">ELVO</span>
          </Link>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-8">
            {['Features', 'Workflow', 'About', 'Pricing'].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="text-sm font-medium text-[#565656] hover:text-[#2B2B2B] transition-colors"
              >
                {item}
              </a>
            ))}
          </nav>

          {/* CTA */}
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="hidden sm:block text-sm font-medium text-[#565656] hover:text-[#2B2B2B] transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="btn-elvo text-sm"
            >
              Get Started <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ═══ HERO SECTION ═══ */}
        <section ref={heroRef} className="relative pt-16 pb-0 lg:pt-20 overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Left: Text */}
              <div className="animate-fade-up">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#2B2B2B]/8 border border-[#B3B3B3]/40 text-xs font-semibold uppercase tracking-widest text-[#565656] mb-8">
                  A smarter way to plan
                </div>

                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-[#2B2B2B] leading-[1.05] mb-6">
                  Elevate<br />
                  your everyday.
                </h1>

                <p className="text-lg text-[#565656] leading-relaxed mb-10 max-w-md">
                  Plan your time. Organize your work.<br />
                  Stay focused on what matters.
                </p>

                <div className="flex flex-wrap items-center gap-4 mb-10">
                  <Link to="/register" className="btn-elvo">
                    Get Started <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link to="/login" className="inline-flex items-center justify-center px-6 py-3 rounded-xl border border-[#2B2B2B] text-[#2B2B2B] text-sm font-semibold hover:bg-[#2B2B2B]/5 transition-colors">
                    Explore ELVO
                  </Link>
                </div>

                {/* Trust line */}
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {['#848484', '#565656', '#2B2B2B'].map((bg, i) => (
                      <div
                        key={i}
                        className="w-8 h-8 rounded-full border-2 border-[#F5F5F5] flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ background: bg }}
                      >
                        {['S', 'A', 'M'][i]}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-[#848484] font-medium">
                    Trusted by students, creators<br />and teams.
                  </p>
                </div>
              </div>

              {/* Right: App Mockup */}
              <div className="relative animate-fade-up delay-200 hidden lg:block">
                <div className="relative rounded-2xl overflow-hidden shadow-elvo-lg border border-[#E0E0E0]">
                  <img
                    src="/elvo-hero.jpg"
                    alt="ELVO dashboard"
                    className="w-full object-cover"
                  />
                </div>
                {/* Floating accent */}
                <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-[#2B2B2B] rounded-2xl opacity-5 blur-2xl" />
              </div>
            </div>
          </div>

          {/* Decorative bottom strip */}
          <div className="mt-16 bg-[#E0E0E0] h-px w-full" />
        </section>

        {/* ═══ WHY ELVO SECTION ═══ */}
        <section id="features" className="py-20 lg:py-28 bg-[#F5F5F5]">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
              {/* Left */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[#848484] mb-4">Why ELVO</p>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#2B2B2B] leading-tight mb-8">
                  Your day shouldn't<br />feel scattered.
                </h2>
                <p className="text-[#565656] text-base leading-relaxed max-w-sm">
                  Tasks in one place. Meetings somewhere else.
                  Notes somewhere else. Reminders everywhere.
                  <br /><br />
                  <strong className="text-[#2B2B2B]">ELVO brings your day together.</strong>
                </p>
              </div>

              {/* Right: Feature Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {FEATURES.map((f, i) => {
                  const Icon = f.icon;
                  return (
                    <div
                      key={f.title}
                      className="group p-5 rounded-2xl border border-[#E0E0E0] bg-white hover:border-[#B3B3B3] hover:shadow-card transition-all duration-200 cursor-default"
                      style={{ animationDelay: `${i * 80}ms` }}
                    >
                      <div className="w-9 h-9 rounded-xl bg-[#F5F5F5] border border-[#E0E0E0] flex items-center justify-center mb-3 group-hover:bg-[#2B2B2B] group-hover:border-[#2B2B2B] transition-colors">
                        <Icon className="w-4 h-4 text-[#565656] group-hover:text-white transition-colors" />
                      </div>
                      <p className="text-sm font-bold text-[#2B2B2B]">{f.title}</p>
                      <p className="text-xs text-[#848484] mt-1 leading-snug">{f.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ═══ DARK FEATURES SECTION ═══ */}
        <section id="workflow" className="py-20 lg:py-28 bg-[#2B2B2B] text-white">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
              {/* Left */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[#848484] mb-4">Features</p>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight mb-6">
                  Everything<br />your day needs.
                </h2>
                <p className="text-[#B3B3B3] text-base leading-relaxed mb-8 max-w-sm">
                  From planning and tasks to focus, collaboration
                  and customization — ELVO gives you the tools
                  to build a more intentional day.
                </p>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-[#565656] text-[#E0E0E0] text-sm font-semibold hover:bg-[#565656]/20 transition-colors"
                >
                  Explore Features <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {/* Right: Feature Cards Grid */}
              <div className="grid grid-cols-2 gap-4">
                {FEATURE_CARDS.map((card) => (
                  <div
                    key={card.title}
                    className="p-5 rounded-2xl bg-[#1A1A1A] border border-[#3A3A3A] hover:border-[#565656] transition-all duration-200 group"
                  >
                    <p className="text-sm font-bold text-white mb-1">{card.title}</p>
                    <p className="text-xs text-[#848484] mb-4">{card.desc}</p>
                    {card.items && (
                      <div className="space-y-2">
                        {card.items.map((item, i) => (
                          <div
                            key={i}
                            className="text-[11px] text-[#B3B3B3] bg-[#2B2B2B] rounded-lg px-3 py-2 font-medium"
                          >
                            {item}
                          </div>
                        ))}
                      </div>
                    )}
                    {card.badge && (
                      <div className="flex items-center justify-center flex-col mt-2">
                        <div className="text-3xl font-extrabold text-white font-mono">{card.badge}</div>
                        <div className="text-xs text-[#848484] mt-1">{card.badgeSub}</div>
                      </div>
                    )}
                    <div className="mt-4 flex">
                      <div className="w-7 h-7 rounded-full border border-[#3A3A3A] flex items-center justify-center group-hover:border-[#565656] transition-colors">
                        <ArrowRight className="w-3.5 h-3.5 text-[#565656]" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ═══ CUSTOMIZATION SECTION ═══ */}
        <section id="about" className="py-20 lg:py-28 bg-[#F5F5F5]">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Left: UI Mockup Placeholder */}
              <div className="relative">
                <div className="rounded-2xl overflow-hidden border border-[#E0E0E0] bg-white shadow-card p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <ElvoLogo size={28} />
                    <div>
                      <p className="text-xs font-bold text-[#2B2B2B]">Appearance</p>
                      <p className="text-[10px] text-[#848484]">Choose a theme that fits your flow</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {['Light', 'Dark'].map((t, i) => (
                      <div
                        key={t}
                        className={`rounded-lg p-2 border text-center ${i === 1 ? 'border-[#2B2B2B] bg-[#2B2B2B]' : 'border-[#E0E0E0] bg-[#F5F5F5]'}`}
                      >
                        <div className={`w-full h-8 rounded-md mb-1.5 ${['bg-white', 'bg-[#1A1A1A]'][i]}`} />
                        <p className={`text-[9px] font-semibold ${i === 1 ? 'text-white' : 'text-[#565656]'}`}>{t}</p>
                      </div>
                    ))}
                  </div>
                  {/* Nav items */}
                  <div className="space-y-1">
                    {['Appearance', 'Themes', 'Layout', 'Notifications'].map((item, i) => (
                      <div
                        key={item}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium ${i === 0 ? 'bg-[#F5F5F5] text-[#2B2B2B]' : 'text-[#848484]'}`}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-[#2B2B2B]' : 'bg-[#E0E0E0]'}`} />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: Text */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[#848484] mb-4">Make it yours</p>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#2B2B2B] leading-tight mb-6">
                  A workspace<br />that adapts to you.
                </h2>
                <p className="text-[#565656] text-base leading-relaxed mb-8 max-w-sm">
                  Choose your theme, customize your layout,
                  set your preferences and make ELVO feel like home.
                </p>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#2B2B2B] text-white text-sm font-semibold hover:bg-[#1A1A1A] transition-colors"
                >
                  Explore Customization <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ CTA SECTION ═══ */}
        <section id="pricing" className="py-20 lg:py-28 bg-[#2B2B2B] text-white text-center">
          <div className="max-w-3xl mx-auto px-6 lg:px-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#848484] mb-5">Ready to begin?</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-6">
              Ready to elevate<br />your everyday?
            </h2>
            <p className="text-[#B3B3B3] text-lg mb-10">
              Start organizing, focusing and achieving — all in one place.
            </p>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-8 py-4 bg-[#E0E0E0] text-[#2B2B2B] rounded-xl text-sm font-bold hover:bg-white transition-colors shadow-lg"
            >
              Get Started — It's Free <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      {/* ═══ FOOTER ═══ */}
      <Footer />
    </div>
  );
};
