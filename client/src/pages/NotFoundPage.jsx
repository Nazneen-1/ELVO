import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const ElvoLogo = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="22" fill="#1C1C1C"/>
    <path d="M68 24 C52 18 30 22 24 38 C20 48 26 55 30 57" stroke="#D8D8D8" strokeWidth="8.5" strokeLinecap="round"/>
    <path d="M30 56 C42 50 56 55 68 62" stroke="#D8D8D8" strokeWidth="5.5" strokeLinecap="round"/>
    <path d="M30 60 C24 68 20 76 28 84 C36 92 52 86 68 80" stroke="#D8D8D8" strokeWidth="8.5" strokeLinecap="round"/>
  </svg>
);

export const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen relative flex flex-col bg-[#EFEFEF] overflow-hidden text-[#2B2B2B]">
      {/* Background Illustration */}
      <div className="absolute inset-0 z-0">
        <img
          src="/elvo-404-bg.jpg"
          alt="Confused cat looking at map"
          className="w-full h-full object-cover object-right sm:object-center opacity-90"
        />
        {/* Subtle gradient to ensure text readability on the left */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#EAE9E4] via-[#EAE9E4]/60 to-transparent" />
      </div>

      {/* ═══ NAVBAR (Match Landing Page) ═══ */}
      <header className="relative z-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <ElvoLogo size={32} />
            <span className="text-xl tracking-[0.2em] font-medium text-[#2B2B2B]">ELVO</span>
          </Link>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-10">
            {['Features', 'Workflow', 'About', 'Pricing'].map((item) => (
              <Link
                key={item}
                to="/"
                className="text-sm font-medium text-[#565656] hover:text-[#2B2B2B] transition-colors"
              >
                {item}
              </Link>
            ))}
          </nav>

          {/* CTA */}
          <div className="flex items-center gap-3">
            <Link
              to="/register"
              className="px-6 py-2.5 bg-[#2B2B2B] text-white rounded-full text-sm font-medium flex items-center gap-2 hover:bg-[#1A1A1A] transition-colors"
            >
              Get Started <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* ═══ MAIN CONTENT ═══ */}
      <main className="relative z-10 flex-1 flex flex-col justify-center">
        <div className="max-w-7xl w-full mx-auto px-6 lg:px-8">
          <div className="max-w-md md:max-w-lg lg:max-w-xl pb-20">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#565656] mb-6">
              Page Not Found
            </p>
            
            <h1 className="text-8xl sm:text-[140px] font-light text-[#2B2B2B] leading-none tracking-tight mb-8">
              404
            </h1>
            
            <h2 className="text-3xl sm:text-4xl font-medium text-[#2B2B2B] leading-[1.2] tracking-tight mb-4">
              Looks like this page<br />took a wrong turn.
            </h2>
            
            <p className="text-[#565656] text-base leading-relaxed mb-10 max-w-sm">
              The page you're looking for doesn't exist or has been moved.
            </p>
            
            <div className="flex flex-wrap items-center gap-4">
              <Link
                to="/"
                className="px-6 py-3 bg-[#2B2B2B] text-white rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-[#1A1A1A] transition-colors shadow-lg shadow-black/10"
              >
                Go to Home <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                onClick={() => navigate(-1)}
                className="px-8 py-3 bg-transparent border border-[#565656]/30 text-[#2B2B2B] rounded-xl text-sm font-medium hover:bg-[#2B2B2B]/5 transition-colors"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
