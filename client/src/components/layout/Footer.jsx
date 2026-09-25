import React from 'react';
import { Link } from 'react-router-dom';
import { Github, Linkedin, Instagram } from 'lucide-react';

const ElvoLogo = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="22" fill="#1C1C1C"/>
    <path d="M68 24 C52 18 30 22 24 38 C20 48 26 55 30 57" stroke="#D8D8D8" strokeWidth="8.5" strokeLinecap="round"/>
    <path d="M30 56 C42 50 56 55 68 62" stroke="#D8D8D8" strokeWidth="5.5" strokeLinecap="round"/>
    <path d="M30 60 C24 68 20 76 28 84 C36 92 52 86 68 80" stroke="#D8D8D8" strokeWidth="8.5" strokeLinecap="round"/>
  </svg>
);

export const Footer = () => {
  const links = {
    Product: ['Features', 'Pricing', 'Changelog'],
    Company: ['About', 'Privacy', 'Contact'],
  };

  return (
    <footer className="bg-[#1A1A1A] text-[#B3B3B3] py-12">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-8 mb-10">
          {/* Brand */}
          <div className="flex-shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <ElvoLogo size={28} />
              <span className="text-white font-bold text-base tracking-tight">ELVO</span>
            </div>
            <p className="text-xs text-[#565656] max-w-[180px] leading-relaxed">
              Elevate Your Everyday.
            </p>
          </div>

          {/* Links */}
          <div className="flex gap-12 sm:gap-16">
            {Object.entries(links).map(([group, items]) => (
              <div key={group}>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[#565656] mb-3">{group}</p>
                <ul className="space-y-2">
                  {items.map((item) => (
                    <li key={item}>
                      <a
                        href="#"
                        className="text-sm text-[#848484] hover:text-[#E0E0E0] transition-colors"
                      >
                        {item}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Social */}
          <div className="flex items-center gap-3">
            {[Github, Linkedin, Instagram].map((Icon, i) => (
              <a
                key={i}
                href="#"
                className="w-8 h-8 rounded-lg bg-[#2B2B2B] flex items-center justify-center text-[#848484] hover:text-[#E0E0E0] hover:bg-[#3A3A3A] transition-all"
              >
                <Icon className="w-3.5 h-3.5" />
              </a>
            ))}
          </div>
        </div>

        <div className="border-t border-[#2B2B2B] pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-[#565656]">© {new Date().getFullYear()} ELVO. All rights reserved.</p>
          <p className="text-xs text-[#565656]">Elevate Your Everyday.</p>
        </div>
      </div>
    </footer>
  );
};
