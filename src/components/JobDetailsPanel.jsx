import React from 'react';
import { trackEvent } from '../tracker';
import {
  X, ExternalLink, MapPin, DollarSign, Clock, Building2,
  CheckCircle2, AlertCircle, Bookmark, BookmarkCheck,
  Sparkles, Globe, TrendingUp, Shield, ShieldAlert, ShieldCheck,
} from 'lucide-react';

// ── Circular match arc ────────────────────────────────────────────────────────
function MatchArc({ pct }) {
  const color = pct >= 90 ? '#16a34a' : pct >= 80 ? '#2563eb' : '#d97706';
  const r = 28;
  const circumference = 2 * Math.PI * r;
  const dash = (pct / 100) * circumference;

  return (
    <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
      <svg width="72" height="72" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="6" />
        <circle
          cx="36" cy="36" r={r} fill="none" stroke="#fff" strokeWidth="6"
          strokeDasharray={`${dash} ${circumference}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 15, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{pct}%</span>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)', fontWeight: 700, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.4px' }}>match</span>
      </div>
    </div>
  );
}

// ── Trust panel ───────────────────────────────────────────────────────────────
function ScoreBar({ value, color }) {
  return (
    <div style={{ flex: 1, height: 5, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{
        width: `${Math.min(value, 100)}%`, height: '100%',
        background: color, borderRadius: 99,
        transition: 'width 0.6s ease',
      }} />
    </div>
  );
}

function TrustPanel({ job }) {
  const score = job.trustScore || 0;

  const ShieldIcon = score >= 88 ? ShieldCheck : score >= 55 ? Shield : ShieldAlert;
  const shieldColor = job.trustColor || '#2563eb';

  const categories = [
    { label: 'Freshness',      value: job.freshnessScore   ?? 45, color: job.freshnessColor || '#d97706', note: job.freshnessLabel },
    { label: 'Source',         value: job.sourceScore      ?? 65, color: '#6366f1',                       note: job.sourceLabel     },
    { label: 'Safety',         value: job.safetyScore      ?? 70, color: job.safetyScore >= 80 ? '#16a34a' : job.safetyScore >= 60 ? '#d97706' : '#dc2626', note: job.safetyScore >= 80 ? 'Low risk' : job.safetyScore >= 60 ? 'Moderate risk' : 'Caution' },
    { label: 'Company',        value: job.companyScore     ?? 68, color: '#0ea5e9',                       note: job.companyLabel    },
    { label: 'Transparency',   value: job.transparencyScore?? 50, color: '#8b5cf6',                       note: null                },
    { label: 'Description',    value: job.descQualityScore ?? 40, color: '#f59e0b',                       note: job.descQualityLabel},
  ];

  return (
    <div style={{ marginBottom: 16, border: '1px solid #e8edf5', borderRadius: 12, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${job.trustBg || '#eff6ff'}, #fff)`,
        padding: '10px 13px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid #f1f5f9',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ShieldIcon size={14} color={shieldColor} />
          <span style={{ fontSize: 11, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Trust Score
          </span>
        </div>
        <span style={{
          fontSize: 12, fontWeight: 800, color: shieldColor,
          background: job.trustBg, borderRadius: 6, padding: '2px 8px',
          border: `1px solid ${shieldColor}30`,
        }}>
          {job.trustBadge}
        </span>
      </div>

      {/* Score ring + categories */}
      <div style={{ padding: '12px 13px' }}>
        {/* Big score */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: `conic-gradient(${shieldColor} ${score * 3.6}deg, #f1f5f9 0deg)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 13, fontWeight: 900, color: shieldColor }}>{score}</span>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 3 }}>
              {score >= 88 ? 'Highly trusted posting' : score >= 72 ? 'Trusted posting' : score >= 55 ? 'Review before applying' : 'Apply with caution'}
            </div>
            {job.isKnownCompany && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle2 size={11} color="#16a34a" />
                <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>Recognized company</span>
              </div>
            )}
          </div>
        </div>

        {/* Category bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {categories.map(({ label, value, color, note }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', width: 74, flexShrink: 0 }}>{label}</span>
              <ScoreBar value={value} color={color} />
              <span style={{ fontSize: 10, color, fontWeight: 700, width: 24, textAlign: 'right', flexShrink: 0 }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Transparency signals */}
        {job.transparencySignals?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 10 }}>
            {job.transparencySignals.map(sig => (
              <span key={sig} style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                fontSize: 10, fontWeight: 600, color: '#16a34a',
                background: '#f0fdf4', border: '1px solid #bbf7d0',
                borderRadius: 5, padding: '2px 6px',
              }}>
                <CheckCircle2 size={9} color="#16a34a" /> {sig}
              </span>
            ))}
          </div>
        )}

        {/* Scam flags */}
        {job.scamFlags?.length > 0 && (
          <div style={{
            marginTop: 10, padding: '8px 10px',
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
              <AlertCircle size={11} color="#dc2626" />
              <span style={{ fontSize: 10.5, fontWeight: 800, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Risk signals detected
              </span>
            </div>
            {job.scamFlags.slice(0, 3).map(flag => (
              <div key={flag} style={{ fontSize: 10.5, color: '#991b1b', lineHeight: 1.5 }}>• {flag}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div style={{
      width: 292, flexShrink: 0, background: '#fff', borderRadius: 18,
      border: '2px dashed #e2e8f0',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '48px 24px', textAlign: 'center', gap: 12,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16,
        background: 'linear-gradient(135deg,#f0f4ff,#ede9fe)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Sparkles size={26} color="#a5b4fc" />
      </div>
      <div>
        <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: '#334155' }}>Select a job</p>
        <p style={{ margin: '5px 0 0', fontSize: 12.5, color: '#94a3b8', lineHeight: 1.5 }}>
          Click any card to see full<br />details and AI insights here
        </p>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
export default function JobDetailsPanel({ job, saved, onSave, onClose }) {
  if (!job) return <EmptyState />;

  const matchColor = job.match >= 90 ? '#16a34a' : job.match >= 80 ? '#2563eb' : '#d97706';

  return (
    <div style={{
      width: 292, flexShrink: 0, background: '#fff', borderRadius: 18,
      border: '1px solid #e8edf5', boxShadow: '0 4px 24px rgba(30,58,138,0.09)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      maxHeight: '100%', animation: 'fadeUp 0.2s ease',
    }}>

      {/* ── Gradient header ── */}
      <div style={{
        background: 'linear-gradient(135deg,#1e3a8a,#2563eb 55%,#7c3aed)',
        padding: '14px 14px 16px', flexShrink: 0,
      }}>
        {/* Close */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8,
              width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.28)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
            title="Close"
          >
            <X size={14} color="#fff" />
          </button>
        </div>

        {/* Logo + title + match ring */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14, flexShrink: 0,
            background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
          }}>
            {job.logo}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: '#fff', lineHeight: 1.35, marginBottom: 4 }}>
              {job.title}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Building2 size={12} color="rgba(255,255,255,0.65)" />
              <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>{job.company}</span>
            </div>
            {job.remote && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6,
                background: 'rgba(255,255,255,0.15)', borderRadius: 6, padding: '2px 8px',
                fontSize: 11, color: '#86efac', fontWeight: 700, border: '1px solid rgba(255,255,255,0.18)',
              }}>
                <Globe size={10} color="#86efac" /> Remote
              </span>
            )}
          </div>
          <MatchArc pct={job.match} />
        </div>

        {/* Source + date */}
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>
          {job.posted}
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px' }}>

        {/* Meta grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 16 }}>
          {[
            { icon: <MapPin size={12} color="#818cf8" />,        label: 'Location', value: job.location },
            { icon: <DollarSign size={12} color="#34d399" />,    label: 'Salary',   value: job.salary },
            { icon: <Clock size={12} color="#fbbf24" />,         label: 'Posted',   value: job.posted },
            { icon: <TrendingUp size={12} color={matchColor} />, label: 'Match',    value: `${job.match}%` },
          ].map(m => (
            <div key={m.label} style={{ background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: 10, padding: '9px 11px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                {m.icon}
                <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{m.label}</span>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', lineHeight: 1.3 }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Skills */}
        <div style={{ marginBottom: 16 }}>
          <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Skills</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {job.tags.length > 0
              ? job.tags.map(tag => (
                  <span key={tag} style={{ background: '#f5f3ff', color: '#6d28d9', borderRadius: 7, padding: '4px 9px', fontSize: 11.5, fontWeight: 600, border: '1px solid #ede9fe' }}>
                    {tag}
                  </span>
                ))
              : <span style={{ fontSize: 12.5, color: '#94a3b8' }}>No tags listed</span>
            }
          </div>
        </div>

        {/* Trust Panel */}
        <TrustPanel job={job} />

        {/* AI Reasoning */}
        {job.reasoning && (
          <div style={{ marginBottom: 14, background: 'linear-gradient(135deg,#f0f4ff,#faf0ff)', border: '1px solid #e0e7ff', borderRadius: 12, padding: '12px 13px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
              <Sparkles size={13} color="#6d28d9" />
              <span style={{ fontSize: 11, fontWeight: 800, color: '#4c1d95', textTransform: 'uppercase', letterSpacing: '0.5px' }}>AI Analysis</span>
            </div>
            <p style={{ margin: 0, fontSize: 12.5, color: '#3730a3', lineHeight: 1.6 }}>{job.reasoning}</p>
          </div>
        )}

        {/* Pros */}
        {job.pros?.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Strengths</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {job.pros.map((pro, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <CheckCircle2 size={14} color="#16a34a" style={{ flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: 12.5, color: '#374151', lineHeight: 1.5 }}>{pro}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cons */}
        {job.cons?.length > 0 && (
          <div style={{ marginBottom: 4 }}>
            <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Watch Out</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {job.cons.map((con, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <AlertCircle size={14} color="#d97706" style={{ flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: 12.5, color: '#374151', lineHeight: 1.5 }}>{con}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Placeholder description when no AI data available */}
        {!job.reasoning && !job.pros?.length && !job.cons?.length && (
          <div style={{ background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: 12, padding: '14px', textAlign: 'center' }}>
            <Sparkles size={18} color="#c7d2fe" style={{ marginBottom: 6 }} />
            <p style={{ margin: 0, fontSize: 12.5, color: '#94a3b8', lineHeight: 1.5 }}>
              Ask the AI to analyze this role for a detailed breakdown of fit, pros, and concerns.
            </p>
          </div>
        )}
      </div>

      {/* ── Footer actions ── */}
      <div style={{ padding: '12px 14px 14px', borderTop: '1px solid #f0f5ff', background: '#fafbff', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <a
          href={job.url} target="_blank" rel="noopener noreferrer"
          onClick={() => trackEvent('apply_click', 'engagement', job.title, { company: job.company, source: job.board, match: job.match, trustScore: job.trustScore, url: job.url })}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            background: 'linear-gradient(135deg,#2563eb,#7c3aed)', color: '#fff',
            borderRadius: 10, padding: '11px', textDecoration: 'none',
            fontSize: 13.5, fontWeight: 700, boxShadow: '0 4px 14px rgba(37,99,235,0.28)',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(37,99,235,0.4)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(37,99,235,0.28)'; }}
        >
          Apply Now <ExternalLink size={13} />
        </a>
        <button
          onClick={onSave}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            background: saved ? '#f0fdf4' : '#f8fafc',
            color: saved ? '#16a34a' : '#64748b',
            border: `1.5px solid ${saved ? '#bbf7d0' : '#e2e8f0'}`,
            borderRadius: 10, padding: '10px', cursor: 'pointer',
            fontSize: 13, fontWeight: 700, fontFamily: 'inherit', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { if (!saved) { e.currentTarget.style.borderColor = '#c7d2fe'; e.currentTarget.style.color = '#4f46e5'; } }}
          onMouseLeave={e => { if (!saved) { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; } }}
        >
          {saved
            ? <><BookmarkCheck size={14} /> Saved</>
            : <><Bookmark size={14} /> Save Job</>
          }
        </button>
      </div>
    </div>
  );
}
