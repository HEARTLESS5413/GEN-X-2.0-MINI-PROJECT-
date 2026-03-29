'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';

const features = [
  { icon: '📸', title: 'Share Stories', desc: 'Post photos, videos, and stories that disappear in 24h' },
  { icon: '💬', title: 'Real-Time Chat', desc: 'Message friends instantly with typing indicators and vanishing mode' },
  { icon: '🎮', title: 'Play Together', desc: 'Challenge friends to Tic Tac Toe & Rock Paper Scissors' },
  { icon: '🎬', title: 'Watch Party', desc: 'Sync YouTube videos and watch together with live chat' },
  { icon: '🔍', title: 'Explore & Connect', desc: 'Discover new people and content from the community' },
  { icon: '🔔', title: 'Stay Updated', desc: 'Real-time notifications for likes, comments, and follows' },
];

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading, loadUser } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    loadUser();
    setMounted(true);
  }, [loadUser]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/feed');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !mounted) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div style={{ textAlign: 'center' }}>
          <h1 className="gradient-text" style={{ fontSize: 48, fontWeight: 800 }}>GenX</h1>
          <div className="spinner" style={{ margin: '24px auto' }}></div>
        </div>
      </div>
    );
  }

  if (isAuthenticated) return null;

  return (
    <div className="landing-page">
      {/* Animated Background */}
      <div className="landing-bg">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
        <div className="grid-overlay"></div>
      </div>

      {/* Navbar */}
      <nav className="landing-nav">
        <div className="landing-logo">G<span>X</span></div>
        <div className="landing-nav-links">
          <Link href="/login" className="btn btn-ghost">Sign In</Link>
          <Link href="/register" className="btn btn-primary">Get Started</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <div className="hero-badge animate-slideInUp">🚀 The Gen-Z Social Universe</div>
        <h1 className="hero-title animate-slideInUp" style={{ animationDelay: '0.1s' }}>
          Connect. Create.<br />
          <span className="gradient-text">Conquer.</span>
        </h1>
        <p className="hero-subtitle animate-slideInUp" style={{ animationDelay: '0.2s' }}>
          One platform that combines the best of social media, messaging, gaming, and watch parties.
          Built for the generation that demands more.
        </p>
        <div className="hero-actions animate-slideInUp" style={{ animationDelay: '0.3s' }}>
          <Link href="/register" className="btn btn-primary btn-lg" style={{ fontSize: 16, padding: '16px 40px' }}>
            🌟 Join GenX Free
          </Link>
          <Link href="/login" className="btn btn-secondary btn-lg" style={{ fontSize: 16, padding: '16px 32px' }}>
            Sign In →
          </Link>
        </div>

        {/* Stats */}
        <div className="hero-stats animate-slideInUp" style={{ animationDelay: '0.4s' }}>
          <div className="hero-stat">
            <strong>∞</strong>
            <span>Possibilities</span>
          </div>
          <div className="hero-stat">
            <strong>24/7</strong>
            <span>Real-Time</span>
          </div>
          <div className="hero-stat">
            <strong>100%</strong>
            <span>Free</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="landing-features">
        <h2 className="section-title">
          Everything You Need,<br />
          <span className="gradient-text">One Platform</span>
        </h2>
        <div className="features-grid">
          {features.map((f, i) => (
            <div key={i} className="feature-card glass-card" style={{ animationDelay: `${i * 0.1}s` }}>
              <span className="feature-icon">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="landing-cta">
        <div className="cta-card glass-card">
          <h2>Ready to Join the <span className="gradient-text">Revolution</span>?</h2>
          <p>Create your free account and start connecting with the community.</p>
          <Link href="/register" className="btn btn-primary btn-lg" style={{ fontSize: 16, padding: '16px 48px', marginTop: 16 }}>
            🚀 Get Started Now
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-logo" style={{ fontSize: 24 }}>G<span>X</span></div>
        <p>© 2026 GenX. The Gen-Z Social Universe.</p>
      </footer>

      <style jsx>{`
        .landing-page {
          min-height: 100vh;
          position: relative;
          overflow-x: hidden;
        }
        .landing-bg {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
        }
        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.4;
          animation: float 8s ease-in-out infinite;
        }
        .orb-1 {
          width: 400px; height: 400px;
          background: #8B5CF6;
          top: -100px; left: -100px;
          animation-delay: 0s;
        }
        .orb-2 {
          width: 350px; height: 350px;
          background: #EC4899;
          top: 40%; right: -80px;
          animation-delay: 2s;
        }
        .orb-3 {
          width: 300px; height: 300px;
          background: #3B82F6;
          bottom: -50px; left: 30%;
          animation-delay: 4s;
        }
        .grid-overlay {
          position: absolute;
          inset: 0;
          background-image: 
            linear-gradient(rgba(139,92,246,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139,92,246,0.03) 1px, transparent 1px);
          background-size: 60px 60px;
        }
        .landing-nav {
          position: relative;
          z-index: 10;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 48px;
          max-width: 1200px;
          margin: 0 auto;
        }
        .landing-logo {
          font-size: 32px;
          font-weight: 900;
          font-family: var(--font-primary);
          color: white;
        }
        .landing-logo span {
          background: var(--gradient-primary);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .landing-nav-links {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .landing-hero {
          position: relative;
          z-index: 10;
          text-align: center;
          padding: 80px 24px 60px;
          max-width: 800px;
          margin: 0 auto;
        }
        .hero-badge {
          display: inline-block;
          padding: 8px 20px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 600;
          background: rgba(139,92,246,0.12);
          border: 1px solid rgba(139,92,246,0.3);
          color: var(--accent-primary);
          margin-bottom: 28px;
        }
        .hero-title {
          font-size: clamp(40px, 7vw, 72px);
          font-weight: 900;
          line-height: 1.05;
          margin-bottom: 24px;
          letter-spacing: -2px;
        }
        .hero-subtitle {
          font-size: 18px;
          color: var(--text-secondary);
          line-height: 1.6;
          max-width: 560px;
          margin: 0 auto 36px;
        }
        .hero-actions {
          display: flex;
          gap: 14px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .hero-stats {
          display: flex;
          justify-content: center;
          gap: 48px;
          margin-top: 56px;
          padding-top: 32px;
          border-top: 1px solid var(--border-color);
        }
        .hero-stat {
          text-align: center;
        }
        .hero-stat strong {
          display: block;
          font-size: 28px;
          font-weight: 800;
          background: var(--gradient-primary);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .hero-stat span {
          font-size: 13px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .landing-features {
          position: relative;
          z-index: 10;
          max-width: 1100px;
          margin: 0 auto;
          padding: 60px 24px 80px;
        }
        .section-title {
          text-align: center;
          font-size: 36px;
          font-weight: 800;
          margin-bottom: 48px;
          line-height: 1.2;
        }
        .features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        .feature-card {
          padding: 28px 24px;
          text-align: center;
          animation: fadeIn 0.5s ease forwards;
          opacity: 0;
        }
        .feature-icon {
          font-size: 40px;
          display: block;
          margin-bottom: 14px;
        }
        .feature-card h3 {
          font-size: 17px;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .feature-card p {
          font-size: 13px;
          color: var(--text-muted);
          line-height: 1.5;
        }
        .landing-cta {
          position: relative;
          z-index: 10;
          max-width: 700px;
          margin: 0 auto;
          padding: 0 24px 80px;
        }
        .cta-card {
          text-align: center;
          padding: 48px 32px;
        }
        .cta-card h2 {
          font-size: 28px;
          font-weight: 800;
          margin-bottom: 12px;
        }
        .cta-card p {
          color: var(--text-muted);
          font-size: 15px;
        }
        .landing-footer {
          position: relative;
          z-index: 10;
          text-align: center;
          padding: 32px;
          border-top: 1px solid var(--border-color);
        }
        .landing-footer p {
          color: var(--text-muted);
          font-size: 13px;
          margin-top: 8px;
        }
        @media (max-width: 768px) {
          .landing-nav { padding: 16px 20px; }
          .landing-hero { padding: 48px 20px 40px; }
          .features-grid { grid-template-columns: 1fr; }
          .hero-stats { gap: 24px; }
          .hero-subtitle { font-size: 15px; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-30px) scale(1.05); }
        }
      `}</style>
    </div>
  );
}
