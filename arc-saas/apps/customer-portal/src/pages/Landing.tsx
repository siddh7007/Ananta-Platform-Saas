/**
 * Landing Page - Public entry point for unauthenticated users
 *
 * Shows product information, features, pricing, and CTA for login/signup.
 * Design aligned with ARC-SaaS admin portal landing page.
 */

import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  FileText,
  Shield,
  Zap,
  Users,
  ArrowRight,
  Check,
  Star,
  BarChart3,
  Search,
} from 'lucide-react';
import { env } from '@/config/env';
import { useEffect } from 'react';

export function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuth();

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = async () => {
    try {
      await login();
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleSignUp = () => {
    // Redirect to admin portal registration with return URL
    const signupUrl = env.adminPortal.url;
    // Use full URL including path (e.g., if user was on /invitations/xyz)
    const returnUrl = encodeURIComponent(window.location.href);
    if (signupUrl) {
      // Pass return_url so admin portal can redirect back after registration
      // Also store in localStorage (survives new tab) as backup
      localStorage.setItem('cbp_signup_return_url', window.location.href);
      window.location.href = `${signupUrl}/register?return_url=${returnUrl}`;
    } else {
      // Fallback to login if signup URL not configured
      handleLogin();
    }
  };

  // Don't render if authenticated (will redirect)
  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Navigation */}
      <nav className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white">{env.app.name}</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleLogin}
              className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={handleSignUp}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 rounded-full text-blue-400 text-sm mb-6">
          <Star className="w-4 h-4" />
          <span>BOM Intelligence Platform</span>
        </div>
        <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
          Manage Your BOM with
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
            Confidence & Intelligence
          </span>
        </h1>
        <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
          Upload, analyze, and optimize your Bill of Materials. Get real-time component
          intelligence, risk analysis, and supply chain insights powered by AI.
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={handleSignUp}
            className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-lg transition-all hover:shadow-lg hover:shadow-blue-500/25 flex items-center gap-2"
          >
            Start Free Trial
            <ArrowRight className="w-5 h-5" />
          </button>
          <a
            href="#features"
            className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold text-lg transition-colors"
          >
            Learn More
          </a>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-white mb-4">
            Everything You Need for BOM Management
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Built for hardware engineers and procurement teams who need accurate component
            data and supply chain visibility.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-blue-500/50 transition-colors">
            <div className="w-14 h-14 rounded-xl bg-blue-500/20 flex items-center justify-center mb-6">
              <FileText className="w-7 h-7 text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">
              BOM Upload & Parsing
            </h3>
            <p className="text-gray-400">
              Upload CSV, Excel, or other formats. Our AI-powered parser automatically
              maps columns and extracts component data.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-blue-500/50 transition-colors">
            <div className="w-14 h-14 rounded-xl bg-purple-500/20 flex items-center justify-center mb-6">
              <Zap className="w-7 h-7 text-purple-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">
              Component Enrichment
            </h3>
            <p className="text-gray-400">
              Automatically enrich your BOM with pricing, specifications, datasheets,
              and lifecycle status from trusted sources.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-blue-500/50 transition-colors">
            <div className="w-14 h-14 rounded-xl bg-green-500/20 flex items-center justify-center mb-6">
              <Shield className="w-7 h-7 text-green-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">
              Risk Analysis
            </h3>
            <p className="text-gray-400">
              Identify obsolescence risks, single-source dependencies, and supply chain
              vulnerabilities before they impact production.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-blue-500/50 transition-colors">
            <div className="w-14 h-14 rounded-xl bg-yellow-500/20 flex items-center justify-center mb-6">
              <BarChart3 className="w-7 h-7 text-yellow-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">
              Pricing Intelligence
            </h3>
            <p className="text-gray-400">
              Compare prices across distributors, track price trends, and optimize
              your procurement strategy with real-time data.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-blue-500/50 transition-colors">
            <div className="w-14 h-14 rounded-xl bg-pink-500/20 flex items-center justify-center mb-6">
              <Users className="w-7 h-7 text-pink-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">
              Team Collaboration
            </h3>
            <p className="text-gray-400">
              Invite team members, assign roles, and collaborate on BOMs with
              real-time updates and activity tracking.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-blue-500/50 transition-colors">
            <div className="w-14 h-14 rounded-xl bg-cyan-500/20 flex items-center justify-center mb-6">
              <Search className="w-7 h-7 text-cyan-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">
              Component Search
            </h3>
            <p className="text-gray-400">
              Search our extensive component database by part number, manufacturer,
              or specifications to find exact matches and alternates.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-white mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Start with our free tier and scale as you grow. No hidden fees.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* Basic */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
            <h3 className="text-lg font-semibold text-gray-400 mb-2">Basic</h3>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-bold text-white">$29</span>
              <span className="text-gray-400">/month</span>
            </div>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center gap-2 text-gray-300">
                <Check className="w-5 h-5 text-green-400" />
                Up to 5 BOMs
              </li>
              <li className="flex items-center gap-2 text-gray-300">
                <Check className="w-5 h-5 text-green-400" />
                1,000 components
              </li>
              <li className="flex items-center gap-2 text-gray-300">
                <Check className="w-5 h-5 text-green-400" />
                Basic enrichment
              </li>
              <li className="flex items-center gap-2 text-gray-300">
                <Check className="w-5 h-5 text-green-400" />
                Email support
              </li>
            </ul>
            <button
              onClick={handleSignUp}
              className="block w-full py-3 text-center bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors"
            >
              Get Started
            </button>
          </div>

          {/* Standard - Popular */}
          <div className="bg-gradient-to-b from-blue-600/20 to-purple-600/20 backdrop-blur-sm rounded-2xl p-8 border border-blue-500/50 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-600 text-white text-sm font-medium rounded-full">
              Popular
            </div>
            <h3 className="text-lg font-semibold text-gray-300 mb-2">Standard</h3>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-bold text-white">$79</span>
              <span className="text-gray-400">/month</span>
            </div>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center gap-2 text-gray-300">
                <Check className="w-5 h-5 text-green-400" />
                Up to 25 BOMs
              </li>
              <li className="flex items-center gap-2 text-gray-300">
                <Check className="w-5 h-5 text-green-400" />
                10,000 components
              </li>
              <li className="flex items-center gap-2 text-gray-300">
                <Check className="w-5 h-5 text-green-400" />
                Full enrichment + Risk
              </li>
              <li className="flex items-center gap-2 text-gray-300">
                <Check className="w-5 h-5 text-green-400" />
                Team collaboration
              </li>
              <li className="flex items-center gap-2 text-gray-300">
                <Check className="w-5 h-5 text-green-400" />
                Priority support
              </li>
            </ul>
            <button
              onClick={handleSignUp}
              className="block w-full py-3 text-center bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Get Started
            </button>
          </div>

          {/* Premium */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
            <h3 className="text-lg font-semibold text-gray-400 mb-2">Premium</h3>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-bold text-white">$199</span>
              <span className="text-gray-400">/month</span>
            </div>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center gap-2 text-gray-300">
                <Check className="w-5 h-5 text-green-400" />
                Unlimited BOMs
              </li>
              <li className="flex items-center gap-2 text-gray-300">
                <Check className="w-5 h-5 text-green-400" />
                Unlimited components
              </li>
              <li className="flex items-center gap-2 text-gray-300">
                <Check className="w-5 h-5 text-green-400" />
                API access
              </li>
              <li className="flex items-center gap-2 text-gray-300">
                <Check className="w-5 h-5 text-green-400" />
                Custom integrations
              </li>
              <li className="flex items-center gap-2 text-gray-300">
                <Check className="w-5 h-5 text-green-400" />
                24/7 support + SLA
              </li>
            </ul>
            <button
              onClick={handleSignUp}
              className="block w-full py-3 text-center bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors"
            >
              Get Started
            </button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl p-12 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Optimize Your BOM?
          </h2>
          <p className="text-blue-100 mb-8 max-w-xl mx-auto">
            Join thousands of engineers who trust our platform for their BOM
            management needs. Start your free trial today.
          </p>
          <button
            onClick={handleSignUp}
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-600 rounded-lg font-semibold text-lg hover:bg-gray-100 transition-colors"
          >
            Create Your Account
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-12 border-t border-white/10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-white">{env.app.name}</span>
          </div>
          <p className="text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} {env.app.name}. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">
              Privacy
            </a>
            <a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">
              Terms
            </a>
            <a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
