import React from 'react';
import './JobCard.css';
import {
  MapPin, DollarSign, ExternalLink, Bookmark, BookmarkCheck,
  X, Sparkles, CheckCircle2, AlertCircle, ChevronDown, ChevronUp,
  Building2, Briefcase, Star,
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────
function getTrustLevel(score) {
  if (score >= 90) return { label: 'Verified Job',     icon: '✓', gradient: 'linear-gradient(135deg,#059669,#10b981)', color: '#059669' };
  if (score >= 75) return { label: 'Trusted Job',      icon: '✓', gradient: 'linear-gradient(135deg,#1d4ed8,#3b82f6)', color: '#1d4ed8' };
  if (score >= 60) return { label: 'Review Carefully', icon: '⚠', gradient: 'linear-gradient(135deg,#d97706,#f59e0b)', color: '#d97706' };
  return              { label: 'Exercise Caution',  icon: '⚠', gradient: 'linear-gradient(135deg,#dc2626,#ef4444)', color: '#dc2626' };
}

function getCompanyInitials(name) {
  if (!name) return '??';
  const words = name.trim().split(/\s+/);
  return words.length >= 2
    ? (words[0][0] + words[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function getMetricBarClass(color) {
  if (color === '#10b981' || color === '#059669') return 'metric-bar green';
  if (color === '#f59e0b' || color === '#d97706') return 'metric-bar yellow';
  if (color === '#dc2626' || color === '#ef4444') return 'metric-bar red';
  return 'metric-bar blue';
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function JobCard({ job, saved, onSave, onDiscard, expanded, onToggle }) {
  const score = job.trustScore || 0;
  const trust = getTrustLevel(score);

  const matchColor  = job.match >= 90 ? '#059669' : job.match >= 80 ? '#1d4ed8' : '#d97706';
  const matchBg     = job.match >= 90 ? '#ecfdf5' : job.match >= 80 ? '#eff6ff' : '#fffbeb';
  const matchBorder = job.match >= 90 ? '#6ee7b7' : job.match >= 80 ? '#93c5fd' : '#fcd34d';

  const metrics = [
    { label: 'Freshness',    value: job.freshnessScore    ?? 45, color: '#10b981', note: job.freshnessLabel  || ((job.freshnessScore ?? 45) >= 80 ? 'Fresh' : 'Aging') },
    { label: 'Source',       value: job.sourceScore       ?? 65, color: '#3b82f6', note: job.sourceLabel     || 'Reliable' },
    { label: 'Safety',       value: job.safetyScore       ?? 70, color: (job.safetyScore ?? 70) >= 80 ? '#10b981' : (job.safetyScore ?? 70) >= 60 ? '#f59e0b' : '#dc2626', note: (job.safetyScore ?? 70) >= 80 ? 'Low risk' : 'Moderate' },
    { label: 'Company',      value: job.companyScore      ?? 68, color: '#3b82f6', note: job.companyLabel    || (job.isKnownCompany ? 'Verified' : 'Unknown') },
    { label: 'Transparency', value: job.transparencyScore ?? 50, color: '#f59e0b', note: 'Disclosed' },
  ];

  const skillTags  = job.tags || [];
  const verifyTags = [
    ...(job.transparencySignals || []),
    ...(job.remote        ? ['🌍 Remote']            : []),
    ...(job.isKnownCompany ? ['✓ Verified Employer'] : []),
  ];

  return (
    <div className={`job-card${expanded ? ' expanded' : ''}`}>

      {/* ── Trust Score Header ── */}
      <div className="trust-header" style={{ background: trust.gradient }}>
        <div className="trust-badge">
          <div className="trust-score-circle" style={{ color: trust.color }}>
            <span>{score}</span>
            <span className="trust-score-sub">score</span>
          </div>
          <div className="trust-info">
            <div className="trust-title">{trust.icon} {trust.label}</div>
            <div className="trust-subtitle">Trust verified by Tulifo AI</div>
          </div>
        </div>
        <div className="trust-right">
          <div className="posted-time">{job.posted || 'Recently posted'}</div>
          <div className="header-actions">
            <button
              className="header-btn"
              onClick={e => { e.stopPropagation(); onSave(); }}
              title={saved ? 'Saved' : 'Save job'}
            >
              {saved
                ? <BookmarkCheck size={15} color="#fff" />
                : <Bookmark size={15} color="rgba(255,255,255,0.9)" />}
            </button>
            <button
              className="header-btn dismiss"
              onClick={e => { e.stopPropagation(); onDiscard(); }}
              title="Dismiss"
            >
              <X size={14} color="rgba(255,255,255,0.9)" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="job-content">

        {/* Scam warning */}
        {job.isSuspicious && (
          <div className="scam-warning">
            <AlertCircle size={14} color="#dc2626" />
            Verify before applying — this listing has unusual patterns.
          </div>
        )}

        {/* Company + Title */}
        <div className="company-section">
          <div className="company-logo">
            {job.logo
              ? <span style={{ fontSize: 30 }}>{job.logo}</span>
              : <span style={{ fontSize: 20, fontWeight: 800 }}>{getCompanyInitials(job.company)}</span>
            }
          </div>
          <div className="company-info">
            <div className="company-name">
              <Building2 size={13} color="#9ca3af" />
              <h3>{job.company}</h3>
              <span
                className="match-badge"
                style={{ background: matchBg, color: matchColor, borderColor: matchBorder }}
              >
                <Star size={10} fill={matchColor} color={matchColor} /> {job.match}% match
              </span>
            </div>
            <h2 className="job-title">{job.title}</h2>
            {job.board && <div className="job-board-tag">via {job.board}</div>}
          </div>
        </div>

        {/* Key details */}
        <div className="key-details">
          <div className="detail-item">
            <span className="detail-icon"><MapPin size={15} color="#818cf8" /></span>
            <span className="detail-value">{job.location}</span>
          </div>
          <div className="detail-item">
            <span className="detail-icon"><Briefcase size={15} color="#60a5fa" /></span>
            <span className="detail-value">{job.remote ? 'Remote' : 'On-site'}</span>
          </div>
          <div className="detail-item">
            <span className="salary-highlight">
              <DollarSign size={13} style={{ display: 'inline', verticalAlign: 'middle' }} />
              {job.salary}
            </span>
          </div>
        </div>

        {/* Skill tags */}
        {skillTags.length > 0 && (
          <div className="tags-section">
            {skillTags.map(tag => (
              <span key={tag} className="tag skill">{tag}</span>
            ))}
          </div>
        )}

        {/* AI Insight */}
        {job.reasoning && (
          <div className="ai-insight">
            <div className="ai-insight-header">
              <Sparkles size={12} color="#7c3aed" />
              AI MATCH ANALYSIS
            </div>
            <p className="ai-insight-text">{job.reasoning}</p>
          </div>
        )}

        {/* Trust Metrics */}
        <div className="trust-metrics">
          {metrics.map(({ label, value, color, note }) => (
            <div key={label} className="trust-metric">
              <div className="metric-label">{label}</div>
              <div className="metric-bar-container">
                <div
                  className={getMetricBarClass(color)}
                  style={{ width: `${Math.min(value, 100)}%` }}
                />
              </div>
              <div className="metric-score" style={{ color }}>{value} · {note}</div>
            </div>
          ))}
        </div>

        {/* Transparency / verify tags */}
        {verifyTags.length > 0 && (
          <div className="tags-section">
            {verifyTags.map(tag => (
              <span key={tag} className="tag verified">{tag}</span>
            ))}
          </div>
        )}

        {/* Strengths & Concerns */}
        {(job.pros?.length > 0 || job.cons?.length > 0) && (
          <div className="insights-grid">
            {job.pros?.length > 0 && (
              <div className="insight-box strengths">
                <div className="insight-title green">
                  <CheckCircle2 size={13} color="#059669" /> Strengths
                </div>
                <ul className="insight-list green">
                  {job.pros.map((p, i) => (
                    <li key={i}>
                      <CheckCircle2 size={11} color="#059669" style={{ flexShrink: 0, marginTop: 3 }} />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {job.cons?.length > 0 && (
              <div className="insight-box concerns">
                <div className="insight-title yellow">
                  <AlertCircle size={13} color="#d97706" /> Watch Out
                </div>
                <ul className="insight-list yellow">
                  {job.cons.map((c, i) => (
                    <li key={i}>
                      <AlertCircle size={11} color="#d97706" style={{ flexShrink: 0, marginTop: 3 }} />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Scam flags */}
        {job.scamFlags?.length > 0 && (
          <div className="scam-flags">
            <div className="scam-flags-title">
              <AlertCircle size={12} color="#dc2626" /> Risk signals detected
            </div>
            {job.scamFlags.slice(0, 3).map(f => (
              <div key={f} className="scam-flag-item">• {f}</div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="action-buttons">
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            onClick={e => e.stopPropagation()}
          >
            🚀 Apply Now <ExternalLink size={13} />
          </a>
          <button
            className={`btn btn-secondary${saved ? ' saved' : ''}`}
            onClick={e => { e.stopPropagation(); onSave(); }}
          >
            {saved
              ? <><BookmarkCheck size={14} /> Saved</>
              : <><Bookmark size={14} /> Save Job</>}
          </button>
          <button
            className={`btn btn-details${expanded ? ' active' : ''}`}
            onClick={e => { e.stopPropagation(); onToggle(); }}
          >
            <span className="chevron">
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </span>
            {expanded ? 'Less Info' : 'View Details'}
          </button>
        </div>

        {/* ── Expandable Job Description ── */}
        <div className={`job-description-section${expanded ? ' expanded' : ''}`}>
          <div className="job-description-content">

            <div className="jd-header">
              <div className="jd-icon">📋</div>
              <div>
                <div className="jd-title">Full Job Details</div>
                <div className="jd-subtitle">{job.company} · {job.location}</div>
              </div>
            </div>

            {/* Key Responsibilities */}
            {job.responsibilities?.length > 0 && (
              <div className="jd-section">
                <div className="jd-section-title">✅ Key Responsibilities</div>
                <ul className="jd-list">
                  {job.responsibilities.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}

            {/* Requirements */}
            {job.requirements?.length > 0 && (
              <div className="jd-section">
                <div className="jd-section-title">🎯 Requirements</div>
                <ul className="jd-list requirements-list">
                  {job.requirements.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}

            {/* Benefits */}
            {job.benefits?.length > 0 && (
              <div className="jd-section">
                <div className="jd-section-title">🌟 What We Offer</div>
                <ul className="jd-list benefits-list">
                  {job.benefits.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              </div>
            )}

            {/* Full Description */}
            {job.description ? (
              <div className="jd-section">
                <div className="jd-section-title">💼 Full Description</div>
                <p className="jd-text">{job.description}</p>
              </div>
            ) : (
              <div className="jd-section">
                <div className="jd-section-title">💼 About the Role</div>
                <p className="jd-text">
                  {job.company} is hiring a {job.title}
                  {job.location && job.location !== 'Not specified' ? ` in ${job.location}` : ''}.
                  {job.remote ? ' This is a fully remote position.' : ''}
                  {job.salary ? ` Offering ${job.salary}.` : ''}
                </p>
              </div>
            )}

            {/* Company Culture */}
            {job.company_culture && (
              <div className="jd-section">
                <div className="jd-section-title">💙 Company Culture</div>
                <div className="jd-highlight">
                  <div className="jd-highlight-title">Why Join {job.company}?</div>
                  <div className="jd-highlight-text">{job.company_culture}</div>
                </div>
              </div>
            )}

            {/* How to Apply */}
            <div className="jd-apply-box">
              <div className="jd-section-title">📧 How to Apply</div>
              <p className="jd-text">
                {job.how_to_apply || "Click Apply Now to go directly to the company's application page."}
              </p>
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-apply-full"
                onClick={e => e.stopPropagation()}
              >
                🚀 Apply Now — {job.title} <ExternalLink size={13} />
              </a>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
