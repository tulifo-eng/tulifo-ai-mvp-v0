import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import JobCard from './components/JobCard';
import { supabase } from './supabase';
import AdminPanel from './AdminPanel';
import { initTracker, trackEvent, identifyUser, startHeartbeat } from './tracker';
import {
  Search, Bookmark, LogIn, User, Briefcase,
  MapPin, DollarSign, Zap, Send, X, Sparkles, Bot, ArrowRight,
  Filter, TrendingUp, Globe,
  ChevronRight, ChevronLeft, Star, CheckCircle2,
  MessageSquare, BarChart3, Layers, Shield, Cpu, MessageCircle,
  ThumbsUp, Bug, Lightbulb
} from 'lucide-react';

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useWindowWidth() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return w;
}

// ─── Backend job normalization ────────────────────────────────────────────────

function formatPostedAt(postedAt) {
  if (!postedAt) return 'Recently';
  const days = Math.floor((Date.now() - new Date(postedAt).getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days < 7)  return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return 'Older';
}

const SOURCE_LOGOS = {
  'JSearch':           '🌐',
  'Adzuna':            '🔍',
  'Remotive':          '🚀',
  'Remote OK':         '✅',
  'We Work Remotely':  '🏡',
  "HN Who's Hiring":   '🅨',
  'USAJobs':           '🏛️',
  'Greenhouse':        '🌿',
};

function normalizeJob(j) {
  const trust = j.trust || {};
  return {
    id:               j.id,
    title:            j.title     || 'Untitled',
    company:          j.company   || 'Unknown',
    location:         j.location  || 'Remote',
    salary:           j.salary    || 'Not listed',
    tags:             Array.isArray(j.tags) ? j.tags.filter(Boolean) : [],
    board:            j.source    || 'Job Board',
    url:              j.applyUrl  || (j.jobBoardUrls && j.jobBoardUrls.linkedin) || '#',
    logo:             SOURCE_LOGOS[j.source] || '💼',
    posted:           formatPostedAt(j.postedAt),
    remote:           /remote/i.test(j.location || ''),
    match:            typeof j.matchScore === 'number' ? j.matchScore : 70,
    reasoning:        j.reasoning         || '',
    pros:             j.pros              || [],
    cons:             j.cons              || [],
    description:      j.description       || '',
    responsibilities: j.responsibilities  || [],
    requirements:     j.requirements      || [],
    benefits:         j.benefits          || [],
    how_to_apply:     j.how_to_apply      || '',
    company_culture:  j.company_culture   || '',
    // Trust fields
    trustScore:            trust.trustScore            ?? 70,
    trustLevel:            trust.trustLevel            || 'trusted',
    trustBadge:            trust.trustBadge            || '✓ Trusted',
    trustColor:            trust.trustColor            || '#2563eb',
    trustBg:               trust.trustBg               || '#eff6ff',
    freshnessScore:        trust.freshnessScore        ?? 45,
    freshnessEmoji:        trust.freshnessEmoji        || '⚪',
    freshnessLabel:        trust.freshnessLabel        || 'Unknown',
    freshnessColor:        trust.freshnessColor        || '#94a3b8',
    sourceScore:           trust.sourceScore           ?? 65,
    sourceLabel:           trust.sourceLabel           || 'Aggregator',
    safetyScore:           trust.safetyScore           ?? 70,
    scamFlags:             trust.scamFlags             || [],
    isSuspicious:          trust.isSuspicious          || false,
    companyScore:          trust.companyScore          ?? 68,
    companyLabel:          trust.companyLabel          || 'Company listed',
    isKnownCompany:        trust.isKnownCompany        || false,
    transparencyScore:     trust.transparencyScore     ?? 50,
    transparencySignals:   trust.transparencySignals   || [],
    descQualityScore:      trust.descQualityScore      ?? 40,
    descQualityLabel:      trust.descQualityLabel      || 'Brief',
  };
}

// ─── Feedback Modal ───────────────────────────────────────────────────────────
const FEEDBACK_TYPES = [
  { id: 'praise',  label: 'Praise',          icon: <ThumbsUp  size={13} />, color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  { id: 'general', label: 'General',          icon: <MessageCircle size={13} />, color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  { id: 'feature', label: 'Feature Request',  icon: <Lightbulb size={13} />, color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  { id: 'bug',     label: 'Bug Report',       icon: <Bug       size={13} />, color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
];

function FeedbackModal({ onClose }) {
  const [type, setType]       = useState('general');
  const [rating, setRating]   = useState(0);
  const [hovered, setHovered] = useState(0);
  const [message, setMessage] = useState('');
  const [email, setEmail]     = useState('');
  const [status, setStatus]   = useState('idle'); // 'idle'|'sending'|'done'|'error'

  const send = async () => {
    if (!message.trim()) return;
    setStatus('sending');
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL || ''}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          rating: rating || null,
          message,
          email,
          page: window.location.pathname + window.location.hash,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      setStatus('done');
    } catch {
      setStatus('error');
    }
  };

  const activeType = FEEDBACK_TYPES.find(t => t.id === type);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(10,15,40,0.55)', backdropFilter: 'blur(4px)',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: '#fff', borderRadius: 20, boxShadow: '0 24px 80px rgba(30,58,138,0.22)',
        width: 420, maxWidth: '95vw', overflow: 'hidden', animation: 'fadeUp 0.2s ease',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg,#1e3a8a,#2563eb 55%,#7c3aed)',
          padding: '18px 20px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageCircle size={18} color="#fff" />
            <span style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>Send Feedback</span>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8,
            width: 28, height: 28, cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={14} color="#fff" />
          </button>
        </div>

        {status === 'done' ? (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: '#f0fdf4',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
            }}>
              <CheckCircle2 size={28} color="#16a34a" />
            </div>
            <p style={{ fontWeight: 800, fontSize: 16, color: '#0f172a', margin: '0 0 6px' }}>Thank you!</p>
            <p style={{ fontSize: 13.5, color: '#64748b', margin: 0 }}>Your feedback helps us improve Tulifo AI.</p>
            <button onClick={onClose} style={{
              marginTop: 20, padding: '10px 28px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg,#2563eb,#7c3aed)', color: '#fff',
              fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit',
            }}>Close</button>
          </div>
        ) : (
          <div style={{ padding: '18px 20px 20px' }}>
            {/* Type selector */}
            <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Type</p>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              {FEEDBACK_TYPES.map(t => (
                <button key={t.id} onClick={() => setType(t.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 11px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 12.5, fontWeight: 600, transition: 'all 0.15s',
                  background: type === t.id ? t.bg : '#f8fafc',
                  color: type === t.id ? t.color : '#64748b',
                  border: `1.5px solid ${type === t.id ? t.border : '#e2e8f0'}`,
                }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {/* Star rating */}
            <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Rating <span style={{ fontWeight: 400, textTransform: 'none', color: '#94a3b8' }}>(optional)</span>
            </p>
            <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n}
                  onClick={() => setRating(rating === n ? 0 : n)}
                  onMouseEnter={() => setHovered(n)}
                  onMouseLeave={() => setHovered(0)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                >
                  <Star size={22}
                    color={(hovered || rating) >= n ? '#f59e0b' : '#e2e8f0'}
                    fill={(hovered || rating) >= n ? '#f59e0b' : 'none'}
                  />
                </button>
              ))}
            </div>

            {/* Message */}
            <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Message</p>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={
                type === 'bug'     ? 'Describe what went wrong…' :
                type === 'feature' ? "Describe the feature you'd like…" :
                type === 'praise'  ? 'What did you love?' :
                'Tell us anything…'
              }
              rows={4}
              style={{
                width: '100%', borderRadius: 10, border: '1.5px solid #e2e8f0',
                padding: '10px 12px', fontSize: 13.5, fontFamily: 'inherit',
                resize: 'vertical', outline: 'none', color: '#0f172a',
                background: '#f8fafc', lineHeight: 1.55, boxSizing: 'border-box',
              }}
              onFocus={e => { e.target.style.borderColor = activeType.color; }}
              onBlur={e => { e.target.style.borderColor = '#e2e8f0'; }}
            />

            {/* Email */}
            <p style={{ margin: '10px 0 6px', fontSize: 11, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Email <span style={{ fontWeight: 400, textTransform: 'none', color: '#94a3b8' }}>(optional — for follow-up)</span>
            </p>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                width: '100%', borderRadius: 10, border: '1.5px solid #e2e8f0',
                padding: '9px 12px', fontSize: 13.5, fontFamily: 'inherit',
                outline: 'none', color: '#0f172a', background: '#f8fafc',
                boxSizing: 'border-box',
              }}
              onFocus={e => { e.target.style.borderColor = activeType.color; }}
              onBlur={e => { e.target.style.borderColor = '#e2e8f0'; }}
            />

            {status === 'error' && (
              <p style={{ margin: '8px 0 0', fontSize: 12.5, color: '#dc2626' }}>Something went wrong — please try again.</p>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={onClose} style={{
                flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid #e2e8f0',
                background: '#f8fafc', color: '#64748b', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600,
              }}>Cancel</button>
              <button onClick={send} disabled={!message.trim() || status === 'sending'} style={{
                flex: 2, padding: '10px', borderRadius: 10, border: 'none',
                background: message.trim() ? 'linear-gradient(135deg,#2563eb,#7c3aed)' : '#e9edf5',
                color: message.trim() ? '#fff' : '#94a3b8',
                cursor: message.trim() ? 'pointer' : 'default',
                fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}>
                {status === 'sending' ? 'Sending…' : <><Send size={13} /> Send Feedback</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const JOB_BOARDS = [
  { name: 'LinkedIn',          url: 'https://www.linkedin.com/jobs/',               color: '#0077b5', icon: '💼', category: 'General'  },
  { name: 'Indeed',            url: 'https://www.indeed.com',                       color: '#2164f3', icon: '🔍', category: 'General'  },
  { name: 'Glassdoor',         url: 'https://www.glassdoor.com/Job/',               color: '#0caa41', icon: '🚪', category: 'General'  },
  { name: 'ZipRecruiter',      url: 'https://www.ziprecruiter.com/jobs-search',     color: '#3b82f6', icon: '⚡', category: 'General'  },
  { name: 'Monster',           url: 'https://www.monster.com/jobs/search/',         color: '#6d28d9', icon: '👾', category: 'General'  },
  { name: 'CareerBuilder',     url: 'https://www.careerbuilder.com/jobs',           color: '#1e40af', icon: '🏢', category: 'General'  },
  { name: 'SimplyHired',       url: 'https://www.simplyhired.com',                  color: '#059669', icon: '🎯', category: 'General'  },
  { name: 'Snagajob',          url: 'https://www.snagajob.com',                     color: '#d97706', icon: '🤝', category: 'General'  },
  { name: 'Wellfound',         url: 'https://wellfound.com/jobs',                   color: '#fb6500', icon: '🌱', category: 'Tech'     },
  { name: 'Levels.fyi',        url: 'https://www.levels.fyi/jobs',                  color: '#7c3aed', icon: '📊', category: 'Tech'     },
  { name: "HN Who's Hiring",   url: 'https://news.ycombinator.com/jobs',            color: '#ff6600', icon: '🅨', category: 'Tech'     },
  { name: 'Dice',              url: 'https://www.dice.com/jobs',                    color: '#e11d48', icon: '🎲', category: 'Tech'     },
  { name: 'Stack Overflow',    url: 'https://stackoverflow.com/jobs',               color: '#f59e0b', icon: '📚', category: 'Tech'     },
  { name: 'GitHub Jobs',       url: 'https://jobs.github.com',                      color: '#0f172a', icon: '🐙', category: 'Tech'     },
  { name: 'Arc.dev',           url: 'https://arc.dev/remote-jobs',                  color: '#6366f1', icon: '🔷', category: 'Tech'     },
  { name: 'Otta',              url: 'https://app.otta.com',                         color: '#14b8a6', icon: '🟦', category: 'Tech'     },
  { name: 'Cord',              url: 'https://cord.co/jobs',                         color: '#8b5cf6', icon: '🔗', category: 'Tech'     },
  { name: 'Remote.co',         url: 'https://remote.co/remote-jobs/',               color: '#0ea5e9', icon: '🌍', category: 'Remote'   },
  { name: 'We Work Remotely',  url: 'https://weworkremotely.com',                   color: '#22c55e', icon: '🏡', category: 'Remote'   },
  { name: 'Remote OK',         url: 'https://remoteok.com',                         color: '#10b981', icon: '✅', category: 'Remote'   },
  { name: 'Remotive',          url: 'https://remotive.com/remote-jobs',             color: '#06b6d4', icon: '🚀', category: 'Remote'   },
  { name: 'FlexJobs',          url: 'https://www.flexjobs.com',                     color: '#7c3aed', icon: '🤸', category: 'Remote'   },
  { name: 'Jobspresso',        url: 'https://jobspresso.co',                        color: '#78350f', icon: '☕', category: 'Remote'   },
  { name: 'YC Jobs',           url: 'https://www.ycombinator.com/jobs',             color: '#f97316', icon: '🚀', category: 'Startup'  },
  { name: 'Startup Jobs',      url: 'https://startup.jobs',                         color: '#4f46e5', icon: '💡', category: 'Startup'  },
  { name: 'Pallet',            url: 'https://pallet.xyz/jobs',                      color: '#0891b2', icon: '🎨', category: 'Startup'  },
  { name: 'Founders Network',  url: 'https://foundersnetwork.com/jobs',             color: '#dc2626', icon: '🌐', category: 'Startup'  },
  { name: 'Blind',             url: 'https://www.teamblind.com/jobs',               color: '#374151', icon: '👁', category: 'Comp'     },
  { name: 'Comprehensive',     url: 'https://www.comprehensive.io',                 color: '#1d4ed8', icon: '💰', category: 'Comp'     },
  { name: 'Toptal',            url: 'https://www.toptal.com/jobs',                  color: '#3b82f6', icon: '🏅', category: 'Contract'    },
  { name: 'Upwork',            url: 'https://www.upwork.com/ab/jobs/search/',       color: '#14a800', icon: '💻', category: 'Contract'    },
  { name: 'Gun.io',            url: 'https://gun.io',                               color: '#7c3aed', icon: '🔫', category: 'Contract'    },
  { name: 'WayUp',             url: 'https://www.wayup.com',                        color: '#e11d48', icon: '🎯', category: 'Internships' },
  { name: 'Handshake',         url: 'https://www.joinhandshake.com',                color: '#e94f35', icon: '🤝', category: 'Internships' },
  { name: 'Chegg Internships', url: 'https://internships.chegg.com',                color: '#ff6b00', icon: '🎓', category: 'Internships' },
  { name: 'InternMatch',       url: 'https://www.internmatch.com',                  color: '#0ea5e9', icon: '🔎', category: 'Internships' },
  { name: 'Parker Dewey',      url: 'https://www.parkerdewey.com',                  color: '#7c3aed', icon: '📋', category: 'Internships' },
  { name: 'RippleMatch',       url: 'https://www.ripplematch.com',                  color: '#3b82f6', icon: '🌊', category: 'Internships' },
  { name: 'Internships.com',   url: 'https://www.internships.com',                  color: '#059669', icon: '🏫', category: 'Internships' },
  { name: 'College Recruiter', url: 'https://www.collegerecruiter.com',             color: '#d97706', icon: '🎒', category: 'Internships' },
  { name: 'The Forage',        url: 'https://www.theforage.com',                    color: '#16a34a', icon: '🌿', category: 'Internships' },
  { name: 'MLH',               url: 'https://mlh.io',                               color: '#e11d48', icon: '💻', category: 'Internships' },
  { name: 'CodePath',          url: 'https://www.codepath.org',                     color: '#4f46e5', icon: '🧑‍💻', category: 'Internships' },
  { name: 'Idealist',          url: 'https://www.idealist.org',                     color: '#059669', icon: '💡', category: 'Internships' },
  { name: 'USAJobs',           url: 'https://www.usajobs.gov',                      color: '#1e3a8a', icon: '🏛️', category: 'Internships' },
  { name: 'LookSharp',         url: 'https://www.looksharpcareers.com',             color: '#0891b2', icon: '🔬', category: 'Internships' },
  { name: 'AfterCollege',      url: 'https://www.aftercollege.com',                 color: '#7c3aed', icon: '🎓', category: 'Internships' },
  { name: 'AIESEC',            url: 'https://www.aiesec.org',                       color: '#2563eb', icon: '🌍', category: 'Internships' },
  { name: 'GoingGlobal',       url: 'https://www.goinglobal.com',                   color: '#0ea5e9', icon: '🗺️', category: 'Internships' },
  { name: 'Global Experiences',url: 'https://www.globalexperiences.com',            color: '#16a34a', icon: '✈️', category: 'Internships' },
  { name: 'GoAbroad',          url: 'https://www.goabroad.com',                     color: '#f59e0b', icon: '🌐', category: 'Internships' },
  { name: 'Eng Internships',   url: 'https://www.engineeringinternships.com',       color: '#374151', icon: '⚙️', category: 'Internships' },
  { name: 'Vault',             url: 'https://www.vault.com',                        color: '#1d4ed8', icon: '🏦', category: 'Finance'     },
  { name: 'eFinancialCareers', url: 'https://www.efinancialcareers.com',            color: '#0369a1', icon: '📈', category: 'Finance'     },
  { name: 'Mediabistro',       url: 'https://www.mediabistro.com',                  color: '#dc2626', icon: '📺', category: 'Creative'    },
  { name: 'Fashionworkie',     url: 'https://www.fashionworkie.com',                color: '#db2777', icon: '👗', category: 'Creative'    },
  { name: 'CharityJob',        url: 'https://www.charityjob.co.uk',                 color: '#059669', icon: '❤️', category: 'Nonprofit'   },
];


// ─── Slash command filter parser ──────────────────────────────────────────────
function parseFilterCommand(input) {
  const lower = input.toLowerCase().trim();
  if (lower.startsWith('/role')) {
    const role = input.replace(/\/role\s*/i, '').trim();
    return role ? { role } : null;
  }
  if (lower.startsWith('/location')) {
    const location = input.replace(/\/location\s*/i, '').trim();
    return location ? { location } : null;
  }
  if (lower.startsWith('/salary')) {
    const salary = input.replace(/\/salary\s*/i, '').trim();
    return salary ? { salary } : null;
  }
  return null;
}

// ─── Markdown renderer ────────────────────────────────────────────────────────
function MsgText({ text }) {
  return (
    <span>
      {text.split(/(\*\*[^*]+\*\*|`[^`]+`|\n)/g).map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**'))
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (part.startsWith('`') && part.endsWith('`'))
          return <code key={i} style={{ background: 'rgba(99,102,241,0.12)', borderRadius: 4, padding: '1px 6px', fontSize: 12.5, fontFamily: "'Menlo','Consolas',monospace", color: '#4f46e5' }}>{part.slice(1, -1)}</code>;
        if (part === '\n') return <br key={i} />;
        return part;
      })}
    </span>
  );
}

// ─── Landing Page ──────────────────────────────────────────────────────────────

function HeroJobCard({ logo, title, company, salary, match, delay }) {
  return (
    <div className="hero-job-card" style={{ animationDelay: delay }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, border: '1px solid rgba(255,255,255,0.1)' }}>{logo}</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#fff', lineHeight: 1.2 }}>{title}</div>
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{company}</div>
        </div>
        <div style={{ marginLeft: 'auto', background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, color: '#4ade80' }}>{match}%</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>{salary}</span>
        <span style={{ fontSize: 11, background: 'linear-gradient(135deg,rgba(37,99,235,0.4),rgba(124,58,237,0.4))', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 5, padding: '2px 8px', color: '#a5b4fc', fontWeight: 600 }}>Apply →</span>
      </div>
    </div>
  );
}

function StatBadge({ value, label, icon }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '20px 32px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, backdropFilter: 'blur(10px)', minWidth: 130 }}>
      <div style={{ color: '#60a5fa', marginBottom: 2 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: '-1px', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 500, textAlign: 'center', lineHeight: 1.4 }}>{label}</div>
    </div>
  );
}

function LandingPage({ onGetStarted }) {
  const isMobile = useWindowWidth() < 768;
  const [chatDemo, setChatDemo] = useState(0);
  const chatLines = [
    { role: 'user', text: '/role Senior React Engineer' },
    { role: 'ai',   text: 'Role set! Showing 12 matches…' },
    { role: 'user', text: '/salary $150k' },
    { role: 'ai',   text: '✓ 8 roles above $150k found.' },
  ];
  useEffect(() => {
    const t = setInterval(() => setChatDemo(p => (p + 1) % chatLines.length), 1800);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ minHeight: '100vh', background: '#050d1e', color: '#fff', fontFamily: 'inherit', overflowX: 'hidden', position: 'relative' }}>

      {/* Grid overlay */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'linear-gradient(rgba(37,99,235,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(37,99,235,0.04) 1px,transparent 1px)', backgroundSize: '48px 48px', pointerEvents: 'none', zIndex: 0 }} />

      {/* Ambient orbs */}
      <div className="landing-orb" style={{ width: 700, height: 700, background: 'radial-gradient(circle,rgba(37,99,235,0.18),transparent 65%)', top: -200, left: -180, animationDelay: '0s' }} />
      <div className="landing-orb" style={{ width: 550, height: 550, background: 'radial-gradient(circle,rgba(124,58,237,0.16),transparent 65%)', top: 50, right: -120, animationDelay: '5s' }} />
      <div className="landing-orb" style={{ width: 450, height: 450, background: 'radial-gradient(circle,rgba(59,130,246,0.12),transparent 65%)', bottom: 100, left: '35%', animationDelay: '10s' }} />

      {/* ── NAV ── */}
      <nav style={{ position: 'relative', zIndex: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isMobile ? '16px 20px' : '20px 60px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 11, background: 'linear-gradient(135deg,#3b82f6,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 28px rgba(59,130,246,0.55)' }}>
            <Zap size={19} color="#fff" />
          </div>
          <span style={{ fontSize: isMobile ? 18 : 21, fontWeight: 800, letterSpacing: '-0.5px' }}>
            Tulifo <span style={{ background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AI</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!isMobile && ['Features', 'Boards', 'Pricing'].map(l => (
            <button key={l} onClick={onGetStarted} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.55)', cursor: 'pointer', fontSize: 14, fontWeight: 500, fontFamily: 'inherit', padding: '8px 14px', borderRadius: 8, transition: 'color 0.15s' }}
              onMouseEnter={e => e.target.style.color = '#fff'}
              onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.55)'}
            >{l}</button>
          ))}
          {!isMobile && <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />}
          {!isMobile && <button onClick={onGetStarted} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 14, fontWeight: 500, fontFamily: 'inherit', padding: '8px 14px' }}>Sign in</button>}
          <button onClick={onGetStarted} className="cta-primary" style={{ padding: isMobile ? '8px 16px' : '9px 22px', fontSize: isMobile ? 13 : 14, borderRadius: 10 }}>
            {isMobile ? 'Get started' : 'Get started free'} {!isMobile && <ChevronRight size={15} />}
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', gap: isMobile ? 40 : 60, maxWidth: 1200, margin: '0 auto', padding: isMobile ? '40px 20px 36px' : '80px 60px 60px' }}>
        {/* Left: copy */}
        <div style={{ flex: isMobile ? 'none' : '0 0 540px', width: '100%' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)', borderRadius: 99, padding: '6px 16px', marginBottom: 28, fontSize: 12.5, color: '#93c5fd', backdropFilter: 'blur(8px)' }}>
            <Sparkles size={12} /> New · AI-powered job matching is here
          </div>

          <h1 style={{ fontSize: 'clamp(40px, 4.2vw, 62px)', fontWeight: 900, lineHeight: 1.06, margin: '0 0 22px', letterSpacing: '-2.5px' }}>
            Find your dream job<br />
            <span style={{ background: 'linear-gradient(90deg,#60a5fa 0%,#a78bfa 55%,#f472b6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              10× faster with AI
            </span>
          </h1>

          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.55)', lineHeight: 1.75, margin: '0 0 36px', maxWidth: 460 }}>
            Tulifo AI searches <strong style={{ color: 'rgba(255,255,255,0.8)' }}>{JOB_BOARDS.length}+ job boards</strong> simultaneously, scores every role against your profile, and coaches you through the application — all inside one chat.
          </p>

          <div style={{ display: 'flex', gap: 12, marginBottom: 40, flexWrap: 'wrap' }}>
            <button onClick={onGetStarted} className="cta-primary">
              Start for free <ArrowRight size={17} />
            </button>
            <button onClick={onGetStarted} className="cta-ghost" style={{ padding: '14px 26px', fontSize: 15 }}>
              See demo
            </button>
          </div>

          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {[
              'No credit card required',
              'Free forever plan',
              `${JOB_BOARDS.length} boards connected`,
            ].map(t => (
              <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
                <CheckCircle2 size={13} color="#4ade80" /> {t}
              </span>
            ))}
          </div>
        </div>

        {/* Right: floating UI preview */}
        {!isMobile && <div style={{ flex: 1, position: 'relative', minHeight: 420 }}>
          {/* Main card frame */}
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '14px', backdropFilter: 'blur(20px)', boxShadow: '0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)' }}>
            {/* Fake topbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '0 4px' }}>
              {['#ff5f57','#febc2e','#28c840'].map(c => <div key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />)}
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.07)', borderRadius: 6, height: 22, marginLeft: 8 }} />
            </div>
            {/* Job cards */}
            <HeroJobCard logo="💳" title="Senior Frontend Engineer" company="Stripe" salary="$160k–$220k" match={97} delay="0s" />
            <HeroJobCard logo="🤖" title="ML Engineer – NLP"        company="OpenAI" salary="$200k–$350k" match={94} delay="0.15s" />
            <HeroJobCard logo="🧠" title="AI Research Engineer"     company="Anthropic" salary="$250k–$400k" match={92} delay="0.3s" />
          </div>

          {/* Floating chat bubble */}
          <div style={{ position: 'absolute', bottom: -20, left: -30, background: 'rgba(15,25,60,0.9)', border: '1px solid rgba(99,102,241,0.35)', borderRadius: 16, padding: '12px 16px', backdropFilter: 'blur(20px)', boxShadow: '0 12px 40px rgba(0,0,0,0.4)', minWidth: 220 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
              <div style={{ width: 22, height: 22, borderRadius: 7, background: 'linear-gradient(135deg,#2563eb,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={12} color="#fff" />
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#a5b4fc' }}>Tulifo AI</span>
              <span className="status-dot" style={{ width: 6, height: 6, marginLeft: 'auto' }} />
            </div>
            {chatLines.slice(0, chatDemo + 1).map((l, i) => (
              <div key={i} style={{ fontSize: 12, lineHeight: 1.5, color: l.role === 'user' ? 'rgba(255,255,255,0.5)' : '#e0e7ff', padding: '3px 0', fontFamily: l.role === 'user' ? 'Menlo,monospace' : 'inherit' }}>
                {l.role === 'user' ? <span style={{ color: '#818cf8' }}>&gt; </span> : ''}
                {l.text}
              </div>
            ))}
          </div>

          {/* Floating match badge */}
          <div style={{ position: 'absolute', top: -16, right: -20, background: 'linear-gradient(135deg,#059669,#10b981)', borderRadius: 12, padding: '8px 14px', boxShadow: '0 8px 24px rgba(5,150,105,0.4)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Star size={13} color="#fff" fill="#fff" />
            <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>97% match</span>
          </div>
        </div>}
      </section>

      {/* ── STATS ── */}
      <section style={{ position: 'relative', zIndex: 10, maxWidth: 1200, margin: '0 auto', padding: isMobile ? '0 20px 48px' : '0 60px 70px' }}>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '32px 0', display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          <StatBadge value={`${JOB_BOARDS.length}+`} label="Job boards aggregated" icon={<Layers size={18} />} />
          <StatBadge value="15k+"  label="Live roles daily"       icon={<Briefcase size={18} />} />
          <StatBadge value="AI"    label="Powered matching engine" icon={<Cpu size={18} />} />
          <StatBadge value="97%"   label="Avg. match accuracy"    icon={<BarChart3 size={18} />} />
          <StatBadge value="Free"  label="Forever free plan"      icon={<Shield size={18} />} />
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ position: 'relative', zIndex: 10, maxWidth: 1100, margin: '0 auto', padding: isMobile ? '20px 20px 56px' : '20px 60px 80px' }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 99, padding: '5px 14px', marginBottom: 16, fontSize: 12, color: '#c4b5fd' }}>
            <Sparkles size={11} /> How it works
          </div>
          <h2 style={{ fontSize: 'clamp(26px,3vw,40px)', fontWeight: 900, letterSpacing: '-1.5px', margin: 0 }}>
            From sign-up to offer in<br />
            <span style={{ background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>three simple steps</span>
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 18 }}>
          {[
            { step: '01', icon: <MessageSquare size={22} />, title: 'Tell AI your goals', desc: 'Set your role, location, and salary in one chat message. Tulifo understands plain English and slash commands alike.', accent: '#3b82f6' },
            { step: '02', icon: <Search size={22} />,        title: 'AI searches everywhere', desc: `We scan ${JOB_BOARDS.length}+ boards simultaneously, score each role by match %, and surface only the best fits.`, accent: '#7c3aed' },
            { step: '03', icon: <CheckCircle2 size={22} />,  title: 'Apply with confidence', desc: 'Save roles, get AI coaching on your pitch, and track your pipeline — all without leaving the app.', accent: '#10b981' },
          ].map(s => (
            <div key={s.step} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: '28px', position: 'relative', overflow: 'hidden', transition: 'border-color 0.2s, transform 0.2s', cursor: 'default' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = `${s.accent}44`; e.currentTarget.style.transform = 'translateY(-4px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <div style={{ position: 'absolute', top: 20, right: 20, fontSize: 42, fontWeight: 900, color: 'rgba(255,255,255,0.04)', letterSpacing: '-2px', lineHeight: 1 }}>{s.step}</div>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: `${s.accent}22`, border: `1px solid ${s.accent}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, color: s.accent }}>
                {s.icon}
              </div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10, color: '#fff' }}>{s.title}</div>
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, lineHeight: 1.7 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{ position: 'relative', zIndex: 10, maxWidth: 1100, margin: '0 auto', padding: isMobile ? '0 20px 56px' : '0 60px 80px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontSize: 'clamp(24px,3vw,38px)', fontWeight: 900, letterSpacing: '-1.5px', margin: '0 0 12px' }}>
            Everything you need to land the role
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15.5, maxWidth: 480, margin: '0 auto' }}>
            Built for serious job seekers who want signal, not noise.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
          {[
            { icon: <Bot size={20} />,        title: 'AI Chat Agent',      desc: 'Natural language job search. Commands + free-form chat.', color: '#3b82f6' },
            { icon: <Globe size={20} />,       title: `${JOB_BOARDS.length} Boards`,       desc: 'LinkedIn, Indeed, YC Jobs, Remote OK & more unified.', color: '#8b5cf6' },
            { icon: <BarChart3 size={20} />,   title: 'Match Scoring',      desc: 'Every role gets a % match score against your profile.', color: '#06b6d4' },
            { icon: <Bookmark size={20} />,    title: 'Save & Pipeline',    desc: 'Bookmark roles, discard noise, track your pipeline.', color: '#10b981' },
            { icon: <TrendingUp size={20} />,  title: 'Salary Intel',       desc: 'Real salary data from Levels.fyi & Blind, in-card.', color: '#f59e0b' },
            { icon: <Shield size={20} />,      title: 'Privacy First',      desc: 'Your search is private. No data sold to recruiters.', color: '#ef4444' },
          ].map(f => (
            <div key={f.title} className="feat-card" style={{ padding: '22px' }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: `${f.color}1a`, border: `1px solid ${f.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, color: f.color }}>
                {f.icon}
              </div>
              <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 6, color: '#fff' }}>{f.title}</div>
              <div style={{ color: 'rgba(255,255,255,0.42)', fontSize: 13, lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section style={{ position: 'relative', zIndex: 10, maxWidth: 1100, margin: '0 auto', padding: isMobile ? '0 20px 56px' : '0 60px 80px' }}>
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <h2 style={{ fontSize: 'clamp(24px,3vw,36px)', fontWeight: 900, letterSpacing: '-1px', margin: '0 0 12px' }}>
            Loved by job seekers
          </h2>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 2, marginBottom: 6 }}>
            {[...Array(5)].map((_, i) => <Star key={i} size={18} fill="#fbbf24" color="#fbbf24" />)}
          </div>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>4.9 / 5 from early users</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14 }}>
          {[
            { name: 'Sarah K.', role: 'Software Engineer → Stripe', avatar: 'SK', text: '"Tulifo found the Stripe role in 3 minutes. The AI match score was exactly right — I\'d never have found it on my own across 32 boards."', stars: 5 },
            { name: 'Marcus T.', role: 'PM → Notion',               avatar: 'MT', text: '"The /salary command alone saved me hours of research. I set my floor at $140k and only saw roles worth applying to. Landed an offer in 2 weeks."', stars: 5 },
            { name: 'Priya N.', role: 'ML Engineer → Anthropic',    avatar: 'PN', text: '"Remote filtering + AI coaching on my cover letter. The AI knew exactly what Anthropic looks for. Game changer for senior roles."', stars: 5 },
          ].map(t => (
            <div key={t.name} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: '24px', transition: 'border-color 0.2s, transform 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.35)'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <div style={{ display: 'flex', gap: 2, marginBottom: 14 }}>
                {[...Array(t.stars)].map((_, i) => <Star key={i} size={13} fill="#fbbf24" color="#fbbf24" />)}
              </div>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, margin: '0 0 18px', fontStyle: 'italic' }}>{t.text}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#2563eb,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff' }}>{t.avatar}</div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── BOARDS TICKER ── */}
      <section style={{ position: 'relative', zIndex: 10, overflow: 'hidden', padding: '0 0 70px' }}>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '18px 0', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, animation: 'ticker 28s linear infinite', width: 'max-content' }}>
            {[...JOB_BOARDS, ...JOB_BOARDS].map((b, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '0 28px', fontSize: 13.5, color: 'rgba(255,255,255,0.3)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: 16 }}>{b.icon}</span> {b.name}
                <span style={{ color: 'rgba(255,255,255,0.1)', margin: '0 8px' }}>·</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section style={{ position: 'relative', zIndex: 10, maxWidth: 700, margin: '0 auto', padding: isMobile ? '0 20px 64px' : '0 48px 100px', textAlign: 'center' }}>
        <div style={{ background: 'linear-gradient(135deg,rgba(37,99,235,0.15),rgba(124,58,237,0.15))', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 28, padding: '56px 48px', backdropFilter: 'blur(20px)', boxShadow: '0 0 80px rgba(37,99,235,0.08)' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg,#2563eb,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 8px 28px rgba(37,99,235,0.45)' }}>
            <Zap size={26} color="#fff" />
          </div>
          <h2 style={{ fontSize: 'clamp(24px,3vw,38px)', fontWeight: 900, letterSpacing: '-1.5px', margin: '0 0 14px' }}>
            Ready to find your next role?
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 16, margin: '0 0 32px', lineHeight: 1.6 }}>
            Join thousands of engineers and PMs who use Tulifo AI to cut job search time in half.
          </p>
          <button onClick={onGetStarted} className="cta-primary" style={{ fontSize: 17, padding: '16px 44px', borderRadius: 14 }}>
            Get started — it's free <ArrowRight size={18} />
          </button>
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12.5, marginTop: 16 }}>No credit card · Free forever plan · Cancel anytime</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ position: 'relative', zIndex: 10, borderTop: '1px solid rgba(255,255,255,0.06)', padding: isMobile ? '20px' : '28px 60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, background: 'linear-gradient(135deg,#3b82f6,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={13} color="#fff" />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>Tulifo AI</span>
        </div>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)' }}>© {new Date().getFullYear()} Tulifo AI · Built for job seekers</span>
        <div style={{ display: 'flex', gap: 20 }}>
          {['Privacy', 'Terms', 'Contact'].map(l => (
            <button key={l} onClick={onGetStarted} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', transition: 'color 0.15s' }}
              onMouseEnter={e => e.target.style.color = '#fff'}
              onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.3)'}
            >{l}</button>
          ))}
        </div>
      </footer>
    </div>
  );
}

// ─── Auth Page ────────────────────────────────────────────────────────────────
function authInputStyle(isFocused) {
  return {
    width: '100%', padding: '13px 16px 13px 44px', borderRadius: 12,
    border: `1.5px solid ${isFocused ? '#2563eb' : '#e8edf5'}`,
    fontSize: 14.5, outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit', color: '#0f172a', background: isFocused ? '#fff' : '#fafbff',
    boxShadow: isFocused ? '0 0 0 4px rgba(37,99,235,0.08)' : 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s, background 0.2s',
  };
}

function AuthField({ field, icon, focused, setFocused, ...props }) {
  const isFocused = focused === field;
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: isFocused ? '#2563eb' : '#94a3b8', transition: 'color 0.2s' }}>
        {icon}
      </div>
      <input
        style={authInputStyle(isFocused)}
        onFocus={() => setFocused(field)}
        onBlur={() => setFocused('')}
        {...props}
      />
    </div>
  );
}

function AuthPage({ onLogin }) {
  const isMobile = useWindowWidth() < 768;
  const [email, setEmail]       = useState('');
  const [name, setName]         = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode]         = useState('login');
  const [focused, setFocused]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const switchMode = () => { setMode(m => m === 'login' ? 'signup' : 'login'); setEmail(''); setName(''); setPassword(''); setError(''); };

  const handleGoogle = async () => {
    if (!supabase) { setError('Supabase is not configured.'); return; }
    setLoading(true);
    setError('');
    const { error: authErr } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (authErr) { setError(authErr.message); setLoading(false); }
    // On success Supabase redirects the page — no further action needed here
  };

  const handleSubmit = async () => {
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    setLoading(true);
    setError('');
    try {
      if (!supabase) {
        onLogin({ name: name || email.split('@')[0] || 'User', email, guest: false, id: 'mock-' + Date.now() });
        return;
      }
      if (mode === 'login') {
        const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
        if (authErr) throw authErr;
        const u = data.user;
        onLogin({ id: u.id, name: u.user_metadata?.name || email.split('@')[0], email, guest: false });
      } else {
        const { data, error: authErr } = await supabase.auth.signUp({
          email, password, options: { data: { name: name || email.split('@')[0] } }
        });
        if (authErr) throw authErr;
        if (!data.session) {
          // Email confirmation required
          setError('Account created! Check your email to confirm your address, then sign in.');
          setMode('login');
          return;
        }
        const u = data.user;
        onLogin({ id: u.id, name: name || email.split('@')[0], email, guest: false });
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const pwStrength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const pwColors   = ['#e2e8f0', '#ef4444', '#f59e0b', '#22c55e'];
  const pwLabels   = ['', 'Weak', 'Fair', 'Strong'];

  const perks = [
    { icon: <Layers size={15} />,    text: `${JOB_BOARDS.length}+ job boards in one place` },
    { icon: <BarChart3 size={15} />, text: 'AI match scoring on every role' },
    { icon: <Shield size={15} />,    text: 'Private — your data is never sold' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: 'inherit' }}>

      {/* ── LEFT PANEL ── */}
      {!isMobile && <div style={{ flex: '0 0 46%', background: 'linear-gradient(145deg,#060d1f 0%,#0d1f50 50%,#1a0a38 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '48px 52px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(37,99,235,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(37,99,235,0.05) 1px,transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle,rgba(37,99,235,0.2),transparent 70%)', top: -80, left: -80, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle,rgba(124,58,237,0.18),transparent 70%)', bottom: 60, right: -60, pointerEvents: 'none' }} />

        {/* Logo */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 11, background: 'linear-gradient(135deg,#3b82f6,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 24px rgba(59,130,246,0.5)' }}>
            <Zap size={18} color="#fff" />
          </div>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
            Tulifo <span style={{ background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AI</span>
          </span>
        </div>

        {/* Center copy */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontSize: 'clamp(26px,2.8vw,38px)', fontWeight: 900, color: '#fff', lineHeight: 1.15, letterSpacing: '-1.5px', margin: '0 0 16px' }}>
            Your next role is<br />
            <span style={{ background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              one search away
            </span>
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 15, lineHeight: 1.7, margin: '0 0 32px', maxWidth: 320 }}>
            AI-powered job search across {JOB_BOARDS.length}+ boards. Set your role, location, and salary — let the AI do the rest.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {perks.map(p => (
              <div key={p.text} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a5b4fc', flexShrink: 0 }}>
                  {p.icon}
                </div>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>{p.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonial */}
        <div style={{ position: 'relative', zIndex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '18px 20px', backdropFilter: 'blur(12px)' }}>
          <div style={{ display: 'flex', gap: 2, marginBottom: 10 }}>
            {[...Array(5)].map((_, i) => <Star key={i} size={12} fill="#fbbf24" color="#fbbf24" />)}
          </div>
          <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.6)', lineHeight: 1.65, margin: '0 0 14px', fontStyle: 'italic' }}>
            "Landed a $180k offer at Vercel. Tulifo found it in under 4 minutes."
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg,#2563eb,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff' }}>AR</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Alex R.</div>
              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.35)' }}>Platform Eng. → Vercel</div>
            </div>
          </div>
        </div>
      </div>}

      {/* ── RIGHT PANEL ── */}
      <div style={{ flex: 1, background: '#f8faff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '32px 20px' : '48px 40px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 1px 1px,#dde5f0 1px,transparent 0)', backgroundSize: '28px 28px', opacity: 0.5, pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 400, animation: 'fadeUp 0.3s ease' }}>

          {/* Header */}
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.8px', margin: '0 0 6px' }}>
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p style={{ fontSize: 14.5, color: '#94a3b8', margin: 0 }}>
              {mode === 'login' ? 'Sign in to continue your job search.' : 'Join thousands of job seekers using Tulifo AI.'}
            </p>
          </div>

          {/* Mode tabs */}
          <div style={{ display: 'flex', background: '#eef2f9', borderRadius: 12, padding: 4, marginBottom: 24 }}>
            {[['login','Sign In'], ['signup','Create Account']].map(([v, label]) => (
              <button key={v} onClick={() => setMode(v)} style={{
                flex: 1, padding: '9px', borderRadius: 9, border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, transition: 'all 0.2s',
                background: mode === v ? '#fff' : 'transparent',
                color: mode === v ? '#1d4ed8' : '#94a3b8',
                boxShadow: mode === v ? '0 2px 8px rgba(30,58,138,0.1)' : 'none',
              }}>{label}</button>
            ))}
          </div>

          {/* Google */}
          <button className="google-btn" onClick={handleGoogle} disabled={loading}>
            <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Continue with Google
          </button>

          {/* Guest */}
          <button className="guest-btn" onClick={() => onLogin({ name: 'Guest', email: 'guest@tulifo.ai', guest: true })} style={{ marginTop: 10 }}>
            <User size={16} /> Continue as Guest — no account needed
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
            <div style={{ flex: 1, height: 1, background: '#e8edf5' }} />
            <span style={{ fontSize: 12, color: '#c8d0de', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>or with email</span>
            <div style={{ flex: 1, height: 1, background: '#e8edf5' }} />
          </div>

          {/* Fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {mode === 'signup' && (
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Full name</label>
                <AuthField field="name" icon={<User size={15} />} value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" focused={focused} setFocused={setFocused} />
              </div>
            )}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Email address</label>
              <AuthField field="email" icon={<Briefcase size={15} />} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" type="email" focused={focused} setFocused={setFocused} />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Password</label>
                {mode === 'login' && (
                  <button style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>Forgot password?</button>
                )}
              </div>
              <AuthField field="password" icon={<Zap size={15} />} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" type="password" focused={focused} setFocused={setFocused} />
              {mode === 'signup' && password.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                    {[1,2,3].map(i => (
                      <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= pwStrength ? pwColors[pwStrength] : '#e8edf5', transition: 'background 0.3s' }} />
                    ))}
                  </div>
                  <span style={{ fontSize: 11.5, color: pwColors[pwStrength], fontWeight: 600 }}>{pwLabels[pwStrength]} password</span>
                </div>
              )}
            </div>

            {error && (
              <p style={{ color: '#ef4444', fontSize: 13, fontWeight: 600, margin: 0, background: '#fef2f2', padding: '10px 14px', borderRadius: 10, border: '1px solid #fecaca' }}>{error}</p>
            )}
            <button className="sign-in-btn" style={{ marginTop: 2 }} onClick={handleSubmit} disabled={loading}>
              <LogIn size={16} /> {loading ? 'Please wait…' : mode === 'login' ? 'Sign in to Tulifo AI' : 'Create free account'}
            </button>
          </div>

          <p style={{ textAlign: 'center', fontSize: 13, color: '#94a3b8', marginTop: 20 }}>
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button onClick={switchMode} style={{ color: '#2563eb', fontWeight: 700, cursor: 'pointer', background: 'none', border: 'none', fontSize: 13, fontFamily: 'inherit' }}>
              {mode === 'login' ? 'Sign up free' : 'Sign in'}
            </button>
          </p>
          {mode === 'signup' && (
            <p style={{ textAlign: 'center', fontSize: 11.5, color: '#c8d0de', marginTop: 6 }}>
              By creating an account you agree to our Terms &amp; Privacy Policy.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}



const SUGGESTIONS = [
  { label: 'Remote roles only', cmd: '/location Remote' },
  { label: 'Set salary floor', cmd: '/salary $150k' },
  { label: 'Top AI/ML jobs', cmd: '/role ML Engineer' },
  { label: 'Startup equity', cmd: 'Show startup roles with equity' },
];

const JOB_TABS = ['All', 'Top Match', 'Remote', 'Recent'];

function Dashboard({ user, userProfile, setProfile, onLogout }) {
  const isMobile = useWindowWidth() < 768;
  const [mobilePanel, setMobilePanel]   = useState('jobs');
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, role: 'ai', text: `Hey${user.name ? ' ' + user.name : ''}! 👋 I'm Tulifo AI.\n\nTell me what kind of job you're looking for and where — I'll search **real job boards** and show matches in the Recommended section.\n\nExamples:\n• "software engineer jobs in New York"\n• "remote nursing jobs anywhere"\n• "I drive trucks, find me work in Texas"`, ts: new Date() }
  ]);
  const [input, setInput]             = useState('');
  const [jobs, setJobs]               = useState([]);
  const [savedIds, setSavedIds]       = useState(new Set());
  const [view, setView]               = useState('all');
  const [jobTab, setJobTab]           = useState('All');
  const [filters, setFilters]         = useState({
    role:     userProfile?.role     || '',
    location: userProfile?.location || '',
    salary:   userProfile?.salary_min ? `$${Number(userProfile.salary_min).toLocaleString()}` : '',
  });
  const [expandedJobId, setExpandedJobId] = useState(null);
  const [isTyping, setIsTyping]       = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [lastSearch, setLastSearch]   = useState(null); // { query, location, count, sources }
  const [searchQ, setSearchQ]         = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [matchScores, setMatchScores] = useState({});
  const chatEndRef  = useRef(null);
  const inputRef    = useRef(null);
  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Load persisted data from Supabase on mount
  useEffect(() => {
    if (!supabase || user.guest) return;
    const uid = user.id;

    // Load saved jobs
    supabase.from('saved_jobs').select('job_id').eq('user_id', uid).then(({ data }) => {
      if (data?.length) setSavedIds(new Set(data.map(r => r.job_id)));
    });

    // Load discarded jobs and filter them out
    supabase.from('discarded_jobs').select('job_id').eq('user_id', uid).then(({ data }) => {
      if (data?.length) {
        const discarded = new Set(data.map(r => r.job_id));
        setJobs(prev => prev.filter(j => !discarded.has(String(j.id))));
      }
    });

    // Load last 50 chat messages
    supabase.from('chat_messages').select('*').eq('user_id', uid)
      .order('created_at', { ascending: true }).limit(50).then(({ data }) => {
        if (data?.length) {
          setMessages(data.map(m => ({ id: m.id, role: m.role, text: m.content, ts: new Date(m.created_at) })));
        }
      });

    // Load cached match scores (used if user has previously scored jobs)
    supabase.from('job_matches').select('job_id,score').eq('user_id', uid).then(({ data }) => {
      if (data?.length) {
        const scores = {};
        data.forEach(r => { scores[r.job_id] = r.score; });
        setMatchScores(scores);
      }
    });
  }, [user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTyping]);

  const sendMessage = async (text = input.trim()) => {
    if (!text) return;
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', text, ts: new Date() }]);
    setInput('');
    setIsTyping(true);

    // Apply slash command filter updates immediately
    const filterUpdate = parseFilterCommand(text);
    if (filterUpdate) setFilters(prev => ({ ...prev, ...filterUpdate }));

    // Persist user message
    if (supabase && !user.guest) {
      supabase.from('chat_messages').insert({ user_id: user.id, role: 'user', content: text }).then(() => {});
    }

    try {
      setIsSearching(true);
      const res = await fetch(`${process.env.REACT_APP_API_URL || ''}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messagesRef.current.map(m => ({ role: m.role, content: m.text })),
          userProfile,
          text,
        }),
      });
      if (!res.ok) throw new Error('Server error');
      const data = await res.json();
      const { reply, jobs: foundJobs, jobCount, searchQuery, searchLocation } = data;

      // If backend returned real jobs, normalize and load them into the panel
      if (foundJobs && foundJobs.length > 0) {
        const normalized = foundJobs.map(normalizeJob);
        setJobs(normalized);
        setView('all');
        setJobTab('All');
        setLastSearch({
          query:    searchQuery,
          location: searchLocation,
          count:    jobCount || normalized.length,
          sources:  [...new Set(normalized.map(j => j.board))],
        });
      }

      const aiMsg = { id: Date.now() + 1, role: 'ai', text: reply, ts: new Date() };
      setMessages(prev => [...prev, aiMsg]);
      if (supabase && !user.guest) {
        supabase.from('chat_messages').insert({ user_id: user.id, role: 'ai', content: reply }).then(() => {});
      }
    } catch {
      const fallback = filterUpdate
        ? `Got it! Filter updated. The AI server isn't reachable right now — start it with \`cd server && npm start\`.`
        : `I couldn't reach the AI server. Start it with:\n\n\`cd server && npm start\`\n\nThen try again!`;
      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', text: fallback, ts: new Date() }]);
    } finally {
      setIsTyping(false);
      setIsSearching(false);
    }
  };

  const fmtTime = d => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const filteredByTab = (list) => {
    if (jobTab === 'Remote')    return list.filter(j => j.remote);
    if (jobTab === 'Top Match') return [...list].sort((a, b) => b.match - a.match).slice(0, 8);
    if (jobTab === 'Recent')    return list.filter(j => j.posted.includes('d ago') && parseInt(j.posted) <= 2);
    return list;
  };

  // Apply Claude match scores; normalize all ids to strings for consistent lookups
  const jobsWithScores = jobs.map(j => ({
    ...j,
    match: matchScores[String(j.id)] !== undefined ? matchScores[String(j.id)] : j.match,
  }));

  const baseJobs      = view === 'saved' ? jobsWithScores.filter(j => savedIds.has(String(j.id))) : jobsWithScores;
  const searchedJobs  = searchQ ? baseJobs.filter(j => `${j.title} ${j.company} ${j.tags.join(' ')}`.toLowerCase().includes(searchQ.toLowerCase())) : baseJobs;
  const displayedJobs = filteredByTab(searchedJobs);

  const toggleSave = (id) => {
    const sid = String(id);
    const job = jobs.find(j => String(j.id) === sid);
    setSavedIds(prev => {
      const s = new Set(prev);
      if (s.has(sid)) {
        s.delete(sid);
        trackEvent('job_unsave', 'engagement', job?.title || sid, { company: job?.company, source: job?.board });
        if (supabase && !user.guest) {
          supabase.from('saved_jobs').delete().match({ user_id: user.id, job_id: sid }).then(() => {});
        }
      } else {
        s.add(sid);
        trackEvent('job_save', 'engagement', job?.title || sid, { company: job?.company, source: job?.board, match: job?.match });
        if (supabase && !user.guest) {
          supabase.from('saved_jobs').upsert({ user_id: user.id, job_id: sid, job_data: job }).then(() => {});
        }
      }
      return s;
    });
  };
  const discardJob = (id) => {
    const job = jobs.find(j => j.id === id);
    trackEvent('job_discard', 'engagement', job?.title || String(id), { company: job?.company, source: job?.board });
    setJobs(prev => prev.filter(j => j.id !== id));
    if (supabase && !user.guest) {
      supabase.from('discarded_jobs').upsert({ user_id: user.id, job_id: String(id) }).then(() => {});
    }
  };
  const activeFilterCount = [filters.role, filters.location, filters.salary].filter(Boolean).length;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'inherit', background: '#f0f4fa' }}>

      {/* ═══ TOPBAR ═══ */}
      <header style={{ height: 56, background: '#fff', borderBottom: '1px solid #e8edf5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', flexShrink: 0, boxShadow: '0 1px 0 #e8edf5' }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: isMobile ? 100 : 160 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg,#2563eb,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(37,99,235,0.35)' }}>
            <Zap size={15} color="#fff" />
          </div>
          <span style={{ fontWeight: 800, fontSize: 16, color: '#0f172a', letterSpacing: '-0.3px' }}>
            Tulifo <span style={{ background: 'linear-gradient(90deg,#2563eb,#7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AI</span>
          </span>
        </div>

        {/* Center tabs */}
        {!isMobile && <div style={{ display: 'flex', gap: 2, background: '#f1f5f9', borderRadius: 10, padding: '3px' }}>
          {[['all', 'All Jobs'], ['saved', `Saved${savedIds.size ? ` · ${savedIds.size}` : ''}`]].map(([v, label]) => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '6px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, fontWeight: 700, transition: 'all 0.18s',
              background: view === v ? '#fff' : 'transparent',
              color: view === v ? '#1d4ed8' : '#94a3b8',
              boxShadow: view === v ? '0 1px 6px rgba(30,58,138,0.1)' : 'none',
            }}>{label}</button>
          ))}
        </div>}

        {/* Right: user */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: isMobile ? 80 : 160, justifyContent: 'flex-end' }}>
          {activeFilterCount > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 7, padding: '4px 10px' }}>
              <Filter size={11} /> {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''}
            </span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderRadius: 10, background: '#f8faff', border: '1px solid #e8edf5', cursor: 'default' }}>
            <div style={{ width: 26, height: 26, borderRadius: 8, background: 'linear-gradient(135deg,#2563eb,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px', flexShrink: 0 }}>
              {user.name?.[0]?.toUpperCase() || 'G'}
            </div>
            {!isMobile && <span style={{ fontSize: 13, fontWeight: 600, color: '#334155', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</span>}
          </div>
          <button onClick={onLogout} style={{ background: 'none', border: '1px solid #e8edf5', color: '#94a3b8', borderRadius: 8, padding: '5px 14px', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit', fontWeight: 600, transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.color = '#2563eb'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e8edf5'; e.currentTarget.style.color = '#94a3b8'; }}
          >Logout</button>
        </div>
      </header>

      {/* ═══ BODY ═══ */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── CHAT PANEL ── */}
        <div style={{
          width: isMobile ? '100%' : (chatCollapsed ? 48 : 368),
          minWidth: isMobile ? undefined : (chatCollapsed ? 48 : 300),
          display: (!isMobile || mobilePanel === 'chat') ? 'flex' : 'none',
          flexDirection: 'column',
          background: '#fff',
          borderRight: isMobile ? 'none' : '1px solid #e8edf5',
          flexShrink: 0,
          transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1), min-width 0.3s cubic-bezier(0.4,0,0.2,1)',
          overflow: 'hidden',
          position: 'relative',
        }}>

          {/* ── Collapsed strip (desktop only) ── */}
          {!isMobile && chatCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', gap: 16, flex: 1 }}>
              <button
                onClick={() => setChatCollapsed(false)}
                title="Expand chat"
                style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#2563eb,#7c3aed)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 3px 10px rgba(37,99,235,0.3)', flexShrink: 0 }}
              >
                <ChevronRight size={16} color="#fff" />
              </button>
              {messages.length > 1 && (
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg,#2563eb,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                  {Math.min(messages.length - 1, 9)}
                </div>
              )}
              <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.8px', textTransform: 'uppercase', marginTop: 4 }}>
                Tulifo AI
              </div>
            </div>
          )}

          {/* ── Full chat panel ── */}
          {(isMobile || !chatCollapsed) && <>

          {/* Chat header */}
          <div style={{ padding: '13px 16px', borderBottom: '1px solid #f0f4fb', display: 'flex', alignItems: 'center', gap: 10, background: 'linear-gradient(180deg,#f8faff 0%,#fff 100%)', flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#2563eb,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(37,99,235,0.35)' }}>
                <Bot size={19} color="#fff" />
              </div>
              <div style={{ position: 'absolute', bottom: -1, right: -1, width: 11, height: 11, borderRadius: '50%', background: '#22c55e', border: '2px solid #fff' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 13.5, color: '#0f172a', letterSpacing: '-0.2px' }}>Tulifo AI</div>
              <div style={{ fontSize: 11.5, color: '#22c55e', fontWeight: 600, marginTop: 1 }}>Active · Responds instantly</div>
            </div>
            {activeFilterCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'linear-gradient(135deg,#eff6ff,#eef2ff)', border: '1px solid #c7d2fe', borderRadius: 8, padding: '4px 10px' }}>
                <Filter size={11} color="#4f46e5" />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#4f46e5' }}>{activeFilterCount} active</span>
              </div>
            )}
            {/* Collapse button — desktop only */}
            {!isMobile && (
              <button
                onClick={() => setChatCollapsed(true)}
                title="Collapse chat"
                style={{ width: 30, height: 30, borderRadius: 8, background: '#f1f5f9', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'background 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; }}
              >
                <ChevronLeft size={15} color="#64748b" />
              </button>
            )}
          </div>

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f4fb', display: 'flex', flexWrap: 'wrap', gap: 5, background: '#fafbff' }}>
              {[
                filters.role     && { key: 'role', label: filters.role,     icon: <Briefcase size={10} />, clear: () => setFilters(p => ({...p, role: ''})),     bg: '#eff6ff', color: '#1d4ed8' },
                filters.location && { key: 'loc',  label: filters.location, icon: <MapPin size={10} />,     clear: () => setFilters(p => ({...p, location: ''})), bg: '#f0fdf4', color: '#16a34a' },
                filters.salary   && { key: 'sal',  label: filters.salary,   icon: <DollarSign size={10} />, clear: () => setFilters(p => ({...p, salary: ''})),   bg: '#fefce8', color: '#b45309' },
              ].filter(Boolean).map(f => (
                <span key={f.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: f.bg, color: f.color, borderRadius: 6, padding: '3px 8px', fontSize: 11.5, fontWeight: 700 }}>
                  {f.icon} {f.label}
                  <button onClick={f.clear} style={{ background: 'none', border: 'none', cursor: 'pointer', color: f.color, padding: '0 0 0 2px', lineHeight: 1, display: 'flex' }}><X size={10} /></button>
                </span>
              ))}
            </div>
          )}

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map((msg, idx) => (
              <div key={msg.id}>
                {/* Timestamp separator */}
                {(idx === 0 || msg.ts - messages[idx-1].ts > 60000) && (
                  <div style={{ textAlign: 'center', margin: '4px 0 10px' }}>
                    <span style={{ fontSize: 11, color: '#cbd5e1', background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: 99, padding: '2px 10px' }}>{fmtTime(msg.ts)}</span>
                  </div>
                )}
                <div className="msg-bubble" style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 8, alignItems: 'flex-end' }}>
                  {msg.role === 'ai' && (
                    <div style={{ width: 26, height: 26, borderRadius: 8, background: 'linear-gradient(135deg,#2563eb,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(37,99,235,0.2)' }}>
                      <Bot size={12} color="#fff" />
                    </div>
                  )}
                  <div style={{
                    maxWidth: '82%',
                    padding: '10px 13px',
                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
                    background: msg.role === 'user' ? 'linear-gradient(135deg,#2563eb,#7c3aed)' : '#f5f7ff',
                    color: msg.role === 'user' ? '#fff' : '#1e293b',
                    fontSize: 13.5, lineHeight: 1.65,
                    boxShadow: msg.role === 'user' ? '0 3px 12px rgba(37,99,235,0.22)' : '0 1px 4px rgba(30,58,138,0.05)',
                    border: msg.role === 'ai' ? '1px solid #eaefff' : 'none',
                  }}>
                    <MsgText text={msg.text} />
                  </div>
                  {msg.role === 'user' && (
                    <div style={{ width: 26, height: 26, borderRadius: 8, background: 'linear-gradient(135deg,#60a5fa,#a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, fontWeight: 800, color: '#fff' }}>
                      {user.name?.[0]?.toUpperCase() || 'U'}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing */}
            {isTyping && (
              <div className="msg-bubble" style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: 8, background: 'linear-gradient(135deg,#2563eb,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(37,99,235,0.2)' }}>
                  <Bot size={12} color="#fff" />
                </div>
                <div style={{ background: '#f5f7ff', border: '1px solid #eaefff', borderRadius: '4px 16px 16px 16px', padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {[0,1,2].map(i => (
                      <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'linear-gradient(135deg,#818cf8,#a78bfa)', display: 'inline-block', animation: `bounce 1.1s ${i*0.16}s ease-in-out infinite` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Suggestions (only after first AI message, no user messages yet) */}
            {messages.length === 1 && !isTyping && (
              <div style={{ padding: '4px 0', animation: 'fadeUp 0.3s 0.2s ease both' }}>
                <p style={{ fontSize: 11.5, color: '#94a3b8', fontWeight: 600, margin: '0 0 8px 34px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Suggestions</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 34 }}>
                  {SUGGESTIONS.map(s => (
                    <button key={s.cmd} onClick={() => sendMessage(s.cmd)} style={{ textAlign: 'left', background: '#f5f7ff', border: '1px solid #e8edf5', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: '#334155', fontWeight: 500, transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#eff2ff'; e.currentTarget.style.borderColor = '#c7d2fe'; e.currentTarget.style.color = '#1d4ed8'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#f5f7ff'; e.currentTarget.style.borderColor = '#e8edf5'; e.currentTarget.style.color = '#334155'; }}
                    >
                      <span>{s.label}</span>
                      <ChevronRight size={13} color="#c7d2fe" />
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Command chips */}
          <div style={{ padding: '8px 12px 6px', borderTop: '1px solid #f0f4fb', display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', background: 'linear-gradient(180deg,#fff 0%,#fafbff 100%)' }}>
            {['/role', '/location', '/salary', '/help'].map(cmd => (
              <button key={cmd} className="cmd-chip" onClick={() => { setInput(cmd + ' '); inputRef.current?.focus(); }}>
                {cmd}
              </button>
            ))}
          </div>

          {/* Input */}
          <div style={{ padding: '8px 12px 14px', background: '#fff' }}>
            <div className="input-wrap" style={{ display: 'flex', gap: 8, background: '#f5f7ff', borderRadius: 14, border: '1.5px solid #e4e9f2', padding: '8px 8px 8px 14px', transition: 'all 0.2s' }}>
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Message Tulifo AI…"
                style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 13.5, outline: 'none', color: '#0f172a', fontFamily: 'inherit' }}
              />
              <button className="send-btn" onClick={() => sendMessage()} disabled={!input.trim()} style={{
                background: input.trim() ? 'linear-gradient(135deg,#2563eb,#7c3aed)' : '#e9edf5',
                cursor: input.trim() ? 'pointer' : 'default',
              }}>
                <Send size={14} color={input.trim() ? '#fff' : '#94a3b8'} />
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 }}>
              <p style={{ fontSize: 11, color: '#c8d0de', margin: 0 }}>Enter to send · Shift+Enter for new line</p>
              <button onClick={() => { setShowFeedback(true); trackEvent('feedback_open', 'engagement', 'feedback_modal'); }} style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 11, color: '#94a3b8', fontFamily: 'inherit',
              }}>
                <MessageCircle size={11} /> Feedback
              </button>
            </div>
          </div>
          </> }
        </div>

        {/* ── JOBS PANEL ── */}
        <div style={{ flex: 1, display: (!isMobile || mobilePanel === 'jobs') ? 'flex' : 'none', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Jobs toolbar */}
          <div style={{ background: '#fff', borderBottom: '1px solid #e8edf5', flexShrink: 0 }}>
            {/* Top row: title + search */}
            <div style={{ padding: '12px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>
                  {view === 'saved' ? 'Saved Jobs' : 'Recommended Jobs'}
                </h2>
                {isSearching ? (
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#2563eb', fontWeight: 600 }}>
                    ⏳ Searching real job boards…
                  </p>
                ) : lastSearch ? (
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>
                    <span style={{ fontWeight: 700, color: '#2563eb' }}>{displayedJobs.length}</span> results for <strong style={{ color: '#334155' }}>{lastSearch.query}</strong>{lastSearch.location ? ` · ${lastSearch.location}` : ''}
                  </p>
                ) : (
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>
                    <span style={{ fontWeight: 700, color: '#2563eb' }}>{displayedJobs.length}</span> {view === 'saved' ? 'saved' : jobTab === 'All' ? 'matching' : jobTab.toLowerCase()} positions
                  </p>
                )}
              </div>
              {/* Search */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8faff', border: '1.5px solid #e8edf5', borderRadius: 10, padding: '7px 12px', flex: '0 0 220px', transition: 'border-color 0.2s' }}
                onFocus={() => {}} onBlur={() => {}}
              >
                <Search size={14} color="#94a3b8" />
                <input
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                  placeholder="Search title, company, skill…"
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: '#0f172a', fontFamily: 'inherit', width: '100%' }}
                />
                {searchQ && <button onClick={() => setSearchQ('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, display: 'flex' }}><X size={13} /></button>}
              </div>
            </div>
            {/* Tab row */}
            <div style={{ display: 'flex', gap: 0, padding: '8px 20px 0', borderTop: '0' }}>
              {JOB_TABS.map(tab => (
                <button key={tab} onClick={() => setJobTab(tab)} style={{
                  padding: '7px 16px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 13, fontWeight: 700, background: 'transparent', transition: 'all 0.15s',
                  color: jobTab === tab ? '#1d4ed8' : '#94a3b8',
                  borderBottom: `2px solid ${jobTab === tab ? '#2563eb' : 'transparent'}`,
                  marginBottom: -1,
                }}>
                  {tab}
                  {tab === 'Remote' && <span style={{ marginLeft: 5, fontSize: 10, background: '#eff6ff', color: '#3b82f6', borderRadius: 99, padding: '1px 6px', fontWeight: 700 }}>{jobs.filter(j => j.remote).length}</span>}
                  {tab === 'Top Match' && <span style={{ marginLeft: 5, fontSize: 10, background: '#f0fdf4', color: '#16a34a', borderRadius: 99, padding: '1px 6px', fontWeight: 700 }}>AI</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Jobs list + sidebar */}
          <div style={{ flex: 1, overflow: 'hidden', padding: '14px 16px', display: 'flex', gap: 14 }}>
            <div style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
              {displayedJobs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px 0', animation: 'fadeIn 0.3s ease' }}>
                  <div style={{ width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(135deg,#f0f4ff,#ede9fe)', border: '1px solid #dde5ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    {view === 'saved' ? <Bookmark size={28} color="#a5b4fc" /> : <Search size={28} color="#a5b4fc" />}
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 800, color: '#334155', margin: 0 }}>
                    {view === 'saved' ? 'No saved jobs yet' : searchQ ? 'No results found' : 'Tell the AI what you\'re looking for'}
                  </p>
                  <p style={{ fontSize: 13, color: '#94a3b8', margin: '6px 0 0' }}>
                    {view === 'saved' ? 'Bookmark a role to see it here.' : searchQ ? 'Try a different search term.' : 'Type a job request in the chat — e.g. "software engineer jobs in New York"'}
                  </p>
                </div>
              ) : (
                displayedJobs.map(job => (
                  <JobCard
                    key={job.id} job={job}
                    saved={savedIds.has(String(job.id))}
                    onSave={() => toggleSave(job.id)}
                    onDiscard={() => discardJob(job.id)}
                    expanded={expandedJobId === job.id}
                    onToggle={() => {
                      const newId = expandedJobId === job.id ? null : job.id;
                      setExpandedJobId(newId);
                      if (newId) trackEvent('job_view', 'engagement', job.title, { company: job.company, source: job.board, match: job.match, trustScore: job.trustScore });
                    }}
                  />
                ))
              )}
            </div>

          </div>
        </div>
      </div>

      {/* ── MOBILE BOTTOM NAV ── */}
      {isMobile && (
        <div style={{ flexShrink: 0, height: 60, background: '#fff', borderTop: '1px solid #e8edf5', display: 'flex', boxShadow: '0 -2px 12px rgba(30,58,138,0.06)' }}>
          {[
            { id: 'jobs',  label: 'Jobs',  icon: <Briefcase size={20} /> },
            { id: 'chat',  label: 'Chat',  icon: <MessageSquare size={20} /> },
          ].map(tab => (
            <button key={tab.id} onClick={() => setMobilePanel(tab.id)} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
              border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', position: 'relative',
              color: mobilePanel === tab.id ? '#2563eb' : '#94a3b8', transition: 'color 0.15s',
            }}>
              {tab.icon}
              <span style={{ fontSize: 10.5, fontWeight: 700 }}>{tab.label}</span>
              {mobilePanel === tab.id && <div style={{ position: 'absolute', top: 0, left: '25%', right: '25%', height: 2, background: 'linear-gradient(90deg,#2563eb,#7c3aed)', borderRadius: '0 0 2px 2px' }} />}
            </button>
          ))}
        </div>
      )}

      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
    </div>
  );
}

// ─── App Root ──────────────────────────────────────────────────────────────────
export default function App() {
  const isAdminHash = window.location.hash === '#admin';
  const [view, setView]             = useState(isAdminHash ? 'admin' : 'landing');
  const [user, setUser]             = useState(null);
  const [userProfile, setProfile]   = useState(null);
  const [sessionLoading, setLoading] = useState(!!supabase && !isAdminHash);

  // Restore session on mount
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const u = {
          id:    session.user.id,
          email: session.user.email,
          name:  session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email.split('@')[0],
          guest: false,
        };
        setUser(u);
        identifyUser(u.id, true);
        const { data } = await supabase.from('profiles').select('*').eq('id', u.id).maybeSingle();
        if (data) setProfile(data);
        setView('dashboard');
      }
      setLoading(false);
      if (window.location.hash === '#admin') setView('admin');
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) { setUser(null); setProfile(null); if (window.location.hash !== '#admin') setView('landing'); }
    });
    return () => listener.subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const h = (e) => { if (e.ctrlKey && e.shiftKey && e.key === 'A') setView('admin'); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // Initialize tracker on mount
  useEffect(() => {
    initTracker().then(() => startHeartbeat());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogin = async (u) => {
    setUser(u);
    identifyUser(u.id || u.email, true);
    trackEvent('login', 'auth', u.guest ? 'guest' : 'email');
    if (u.guest) { setView('dashboard'); return; }
    if (supabase) {
      const { data } = await supabase.from('profiles').select('*').eq('id', u.id).maybeSingle();
      if (data) setProfile(data);
      setView('dashboard');
    } else {
      setView('dashboard');
    }
  };

  const handleLogout = async () => {
    if (supabase && user && !user.guest) await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    trackEvent('logout', 'auth', '');
    setView('landing');
  };

  if (sessionLoading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050d1e', fontFamily: 'inherit' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'rgba(255,255,255,0.6)', fontSize: 15 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#2563eb,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Zap size={14} color="#fff" />
        </div>
        Loading Tulifo AI…
      </div>
    </div>
  );

  if (view === 'landing') return <LandingPage onGetStarted={() => setView('auth')} />;
  if (view === 'auth')    return <AuthPage onLogin={handleLogin} />;
  if (view === 'dashboard' && user)
    return <Dashboard user={user} userProfile={userProfile} setProfile={setProfile} onLogout={handleLogout} />;
  if (view === 'admin') return <AdminPanel onExit={() => { window.location.hash = ''; setView(user ? 'dashboard' : 'landing'); }} />;
  return null;
}
