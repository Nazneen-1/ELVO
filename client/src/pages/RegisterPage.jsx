import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { Input } from '../components/common/Input.jsx';

const ElvoLogo = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="22" fill="#1C1C1C"/>
    <path d="M68 24 C52 18 30 22 24 38 C20 48 26 55 30 57" stroke="#D8D8D8" strokeWidth="8.5" strokeLinecap="round"/>
    <path d="M30 56 C42 50 56 55 68 62" stroke="#D8D8D8" strokeWidth="5.5" strokeLinecap="round"/>
    <path d="M30 60 C24 68 20 76 28 84 C36 92 52 86 68 80" stroke="#D8D8D8" strokeWidth="8.5" strokeLinecap="round"/>
  </svg>
);

export const RegisterPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!name || !email || !password) {
      setErrorMessage('Please fill in all fields.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    setIsSubmitting(true);
    const result = await register(name, email, password);
    setIsSubmitting(false);

    if (result.success) {
      navigate('/app/dashboard', { replace: true });
    } else {
      setErrorMessage(result.error || 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex bg-[#1A1A1A]">
      {/* Left Side - Image/Brand (Hidden on Mobile) */}
      <div className="hidden lg:flex w-1/2 relative flex-col justify-between overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src="/elvo-login-bg.jpg"
            alt="Interior architecture"
            className="w-full h-full object-cover opacity-80 mix-blend-luminosity scale-105"
          />
          {/* Dark gradient overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1A] via-transparent to-transparent opacity-80" />
        </div>

        <div className="relative z-10 p-12">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <ElvoLogo size={32} />
            <span className="text-xl font-bold tracking-tight text-white">ELVO</span>
          </Link>
        </div>

        <div className="relative z-10 p-12">
          <h1 className="text-5xl font-extrabold text-white leading-[1.1] mb-6">
            Join the<br />movement.
          </h1>
          <p className="text-[#B3B3B3] text-sm uppercase tracking-widest font-semibold">
            Plan. Organize. Focus.<br />
            Start your journey today.
          </p>

          <div className="mt-16 pt-8 border-t border-[#3A3A3A]/50 flex items-center justify-between">
             <div className="text-xs text-[#848484] tracking-widest uppercase">02</div>
             <div className="text-[10px] text-[#848484] uppercase tracking-[0.2em]">Elevate your workflow</div>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-[#2B2B2B] text-[#F5F5F5] relative shadow-[-20px_0_40px_rgba(0,0,0,0.3)] z-10">
        <div className="w-full max-w-sm">
          {/* Mobile Logo */}
          <div className="lg:hidden flex flex-col items-center mb-10">
            <Link to="/" className="inline-flex items-center gap-2.5">
              <ElvoLogo size={40} />
              <span className="text-2xl font-bold tracking-tight text-white">ELVO</span>
            </Link>
          </div>

          {/* Desktop Logo */}
          <div className="hidden lg:flex flex-col items-center mb-10">
              <ElvoLogo size={64} />
              <span className="text-xl font-bold tracking-[0.3em] text-[#E0E0E0] mt-4 ml-1">ELVO</span>
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">Create an account</h2>
          <p className="text-sm text-[#B3B3B3] mb-8">Get started with simple, calendar-first task scheduling.</p>

          {errorMessage && (
            <div className="mb-6 p-3 rounded-xl bg-red-950/40 border border-red-900/50 flex items-center gap-2.5 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
               <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#848484] mb-2">
                 Full Name
               </label>
               <input
                 type="text"
                 placeholder="Alex Smith"
                 value={name}
                 onChange={(e) => setName(e.target.value)}
                 className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-4 py-2.5 text-sm text-[#E0E0E0] placeholder-[#565656] focus:outline-none focus:border-[#848484] transition-colors"
                 required
                 autoFocus
               />
            </div>

            <div>
               <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#848484] mb-2">
                 Email Address
               </label>
               <input
                 type="email"
                 placeholder="you@example.com"
                 value={email}
                 onChange={(e) => setEmail(e.target.value)}
                 className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-4 py-2.5 text-sm text-[#E0E0E0] placeholder-[#565656] focus:outline-none focus:border-[#848484] transition-colors"
                 required
               />
            </div>

            <div>
               <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#848484] mb-2">
                 Password
               </label>
               <input
                 type="password"
                 placeholder="Minimum 6 characters"
                 value={password}
                 onChange={(e) => setPassword(e.target.value)}
                 className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg px-4 py-2.5 text-sm text-[#E0E0E0] placeholder-[#565656] focus:outline-none focus:border-[#848484] transition-colors"
                 required
               />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#E0E0E0] text-[#1A1A1A] hover:bg-white rounded-lg px-4 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-70 mt-6"
            >
              {isSubmitting ? 'Creating...' : 'Sign Up →'}
            </button>
          </form>

          <p className="text-xs text-[#848484] text-center mt-8">
            Already have an account?{' '}
            <Link to="/login" className="text-[#E0E0E0] font-semibold hover:underline">
              Sign in instead
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
