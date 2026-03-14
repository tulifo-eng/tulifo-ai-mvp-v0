import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart3, Search, Globe, Shield, LogOut, RefreshCw,
  ArrowLeft, AlertTriangle, CheckCircle, XCircle, Clock,
  Activity, Zap, TrendingUp, Server, Key, Database, User, Users,
  MessageCircle, Star, ThumbsUp, Bug, Lightbulb,
  Eye, Bookmark, ExternalLink,
} from 'lucide-react';

const API_BASE = process.env.REACT_APP_API_URL || '';
const REFRESH_INTERVAL = 30000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatUptime(ms) {
  if (!ms || ms < 0) return '0m';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatMemMB(bytes) {
  return (bytes / 1024 / 1024).toFixed(1);
}

function formatTs(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function secondsAgo(ts) {
  return Math.floor((Date.now() - ts) / 1000);
}

const STATUS_COLORS = {
  active: '#22c55e',
  ready: '#3b82f6',
  restricted: '#f59e0b',
  'no-api': '#94a3b8',
  dead: '#ef4444',
};

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60 }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        border: '3px solid rgba(99,102,241,0.2)',
        borderTopColor: '#3b82f6',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, accent }) {
  return (
    <div style={{
      background: '#0f1629', border: '1px solid rgba(99,102,241,0.2)',
      borderRadius: 12, padding: '20px 24px',
      display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10,
        background: `${accent}20`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {React.cloneElement(icon, { size: 20, color: accent })}
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: accent, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || '#94a3b8';
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 999,
      background: `${color}20`, color, fontSize: 11, fontWeight: 600,
      border: `1px solid ${color}40`,
    }}>
      {status}
    </span>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ overview, searches }) {
  if (!overview) return <Spinner />;
  const {
    totalSearches, todaySearches, avgJobsPerSearch, avgDurationMs,
    topQueries = [],
  } = overview;

  const recentFive = searches ? searches.slice(0, 5) : [];
  const maxCount = topQueries.length ? topQueries[0].count : 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <StatCard icon={<Search />} label="Today's Searches" value={todaySearches.toLocaleString()} accent="#3b82f6" />
        <StatCard icon={<BarChart3 />} label="Total Searches" value={totalSearches.toLocaleString()} accent="#7c3aed" />
        <StatCard icon={<TrendingUp />} label="Avg Jobs / Search" value={avgJobsPerSearch.toLocaleString()} accent="#22c55e" />
        <StatCard icon={<Clock />} label="Avg Response Time" value={`${avgDurationMs.toLocaleString()} ms`} accent="#f59e0b" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Top Queries */}
        <div style={{ background: '#0f1629', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
            Top Queries
          </h3>
          {topQueries.length === 0
            ? <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, margin: 0 }}>No searches yet</p>
            : topQueries.map((q, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 500, textTransform: 'capitalize' }}>{q.query}</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{q.count}x</span>
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    background: 'linear-gradient(90deg,#3b82f6,#7c3aed)',
                    width: `${(q.count / maxCount) * 100}%`,
                    transition: 'width 0.4s ease',
                  }} />
                </div>
              </div>
            ))}
        </div>

        {/* Recent Searches */}
        <div style={{ background: '#0f1629', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
            Recent Searches
          </h3>
          {recentFive.length === 0
            ? <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, margin: 0 }}>No searches yet</p>
            : recentFive.map((s, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 0', borderBottom: i < recentFive.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              }}>
                <div>
                  <span style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>{s.query || '(empty)'}</span>
                  {s.location && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginLeft: 6 }}>in {s.location}</span>}
                </div>
                <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>{s.count} jobs</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// ── Searches Tab ──────────────────────────────────────────────────────────────

function SearchesTab({ searches }) {
  const [filter, setFilter] = useState('');
  const [showLimit, setShowLimit] = useState(20);

  const filtered = (searches || []).filter(s =>
    !filter || s.query?.toLowerCase().includes(filter.toLowerCase()) || s.location?.toLowerCase().includes(filter.toLowerCase())
  );
  const visible = filtered.slice(0, showLimit);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
          <Search size={14} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={filter}
            onChange={e => { setFilter(e.target.value); setShowLimit(20); }}
            placeholder="Filter by query or location..."
            style={{
              width: '100%', background: '#0f1629', border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: 8, padding: '8px 12px 8px 34px', color: '#fff', fontSize: 13,
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{filtered.length} results</span>
      </div>

      {/* Table */}
      <div style={{ background: '#0f1629', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1.4fr 1fr 80px 80px 1fr 90px',
          padding: '10px 16px', background: 'rgba(99,102,241,0.08)',
          fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          <span>Query</span><span>Location</span><span>Jobs</span><span>Ms</span><span>Sources</span><span>Time</span>
        </div>
        {visible.length === 0
          ? <div style={{ padding: '32px 16px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>No searches recorded yet</div>
          : visible.map((s, i) => (
            <div key={s.id} style={{
              display: 'grid', gridTemplateColumns: '1.4fr 1fr 80px 80px 1fr 90px',
              padding: '11px 16px', alignItems: 'center',
              background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
              borderTop: '1px solid rgba(255,255,255,0.04)',
              fontSize: 13,
            }}>
              <span style={{ color: '#fff', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.query || <span style={{ color: 'rgba(255,255,255,0.3)' }}>(empty)</span>}</span>
              <span style={{ color: 'rgba(255,255,255,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.location || '—'}</span>
              <span style={{ color: '#22c55e', fontWeight: 600 }}>{(s.count || 0).toLocaleString()}</span>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>{(s.durationMs || 0).toLocaleString()}</span>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(s.sources || []).join(', ') || '—'}</span>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{formatTs(s.ts)}</span>
            </div>
          ))}
      </div>

      {filtered.length > showLimit && (
        <button
          onClick={() => setShowLimit(l => l + 20)}
          style={{
            alignSelf: 'center', background: 'rgba(59,130,246,0.15)',
            border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8,
            color: '#3b82f6', padding: '8px 24px', cursor: 'pointer', fontSize: 13, fontWeight: 500,
          }}
        >
          Load more ({filtered.length - showLimit} remaining)
        </button>
      )}
    </div>
  );
}

// ── Sources Tab ───────────────────────────────────────────────────────────────

function SourcesTab({ sources, adminSecret, onRefresh }) {
  const [toggling, setToggling] = React.useState({});

  const handleToggle = async (key) => {
    setToggling(t => ({ ...t, [key]: true }));
    try {
      await fetch(`${API_BASE}/api/admin/sources/${key}/toggle`, {
        method: 'POST',
        headers: { 'X-Admin-Secret': adminSecret },
      });
      onRefresh();
    } finally {
      setToggling(t => ({ ...t, [key]: false }));
    }
  };

  if (!sources) return <Spinner />;

  const statusOrder = ['active', 'ready', 'restricted', 'no-api', 'dead'];
  const grouped = statusOrder.reduce((acc, s) => {
    acc[s] = sources.filter(src => src.status === s);
    return acc;
  }, {});

  const groupLabel = { active: 'Active', ready: 'Ready (needs credentials)', restricted: 'Restricted / Partner API', 'no-api': 'No Public API', dead: 'Shut Down' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {statusOrder.map(status => {
        const group = grouped[status];
        if (!group || group.length === 0) return null;
        const color = STATUS_COLORS[status];
        return (
          <div key={status}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{groupLabel[status]}</h3>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>({group.length})</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {group.map(src => (
                <div key={src.key} style={{
                  background: '#0f1629', border: '1px solid rgba(99,102,241,0.2)',
                  borderRadius: 12, padding: 16,
                  opacity: src.enabled ? 1 : 0.65,
                  transition: 'opacity 0.2s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 20 }}>{src.emoji}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{src.name}</span>
                    </div>
                    <StatusBadge status={src.status} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    {/* Toggle switch */}
                    <button
                      onClick={() => handleToggle(src.key)}
                      disabled={toggling[src.key]}
                      title={src.enabled ? 'Click to disable' : 'Click to enable'}
                      style={{
                        position: 'relative', width: 40, height: 22,
                        borderRadius: 11, border: 'none', cursor: toggling[src.key] ? 'wait' : 'pointer',
                        background: src.enabled ? '#22c55e' : 'rgba(255,255,255,0.15)',
                        transition: 'background 0.2s',
                        flexShrink: 0, padding: 0,
                      }}
                    >
                      <span style={{
                        position: 'absolute', top: 3,
                        left: src.enabled ? 21 : 3,
                        width: 16, height: 16, borderRadius: '50%',
                        background: '#fff',
                        transition: 'left 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                        display: 'block',
                      }} />
                    </button>
                    <span style={{
                      fontSize: 10, fontWeight: 600,
                      color: src.enabled ? '#22c55e' : 'rgba(255,255,255,0.3)',
                    }}>
                      {src.enabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                    <span style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 4,
                      background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)',
                      border: '1px solid rgba(255,255,255,0.08)', fontWeight: 500,
                    }}>{src.type}</span>
                  </div>
                  {src.stats && src.stats.calls > 0 && (
                    <div style={{ display: 'flex', gap: 16, marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#3b82f6' }}>{src.stats.calls.toLocaleString()}</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>calls</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#22c55e' }}>{src.stats.jobs.toLocaleString()}</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>jobs</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#f59e0b' }}>{src.stats.avgMs.toLocaleString()}</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>avg ms</div>
                      </div>
                    </div>
                  )}
                  {src.notes && (
                    <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>{src.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Health Tab ────────────────────────────────────────────────────────────────

function HealthTab({ health, errors }) {
  if (!health) return <Spinner />;
  const { ok, uptimeMs, env, memory, errorCount } = health;

  const envItems = [
    { label: 'Anthropic API Key (Claude)', ok: env?.hasAnthropicKey, key: 'ANTHROPIC_API_KEY' },
    { label: 'Adzuna App ID + Key', ok: env?.hasAdzunaKeys, key: 'ADZUNA_APP_ID / ADZUNA_APP_KEY' },
    { label: 'USAJobs API Key + Email', ok: env?.hasUSAJobsKey, key: 'USAJOBS_API_KEY / USAJOBS_EMAIL' },
  ];

  const recentErrors = (errors || []).slice(0, 20);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Status row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <StatCard icon={<Server />} label="Server Status" value={ok ? 'Healthy' : 'Error'} accent={ok ? '#22c55e' : '#ef4444'} />
        <StatCard icon={<Clock />} label="Uptime" value={formatUptime(uptimeMs)} accent="#3b82f6" />
        <StatCard icon={<Database />} label="Heap Used" value={`${formatMemMB(memory?.heapUsed || 0)} MB`} sub={`of ${formatMemMB(memory?.heapTotal || 0)} MB`} accent="#7c3aed" />
        <StatCard icon={<AlertTriangle />} label="Errors Recorded" value={errorCount.toLocaleString()} accent={errorCount > 0 ? '#ef4444' : '#22c55e'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* API Keys */}
        <div style={{ background: '#0f1629', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Key size={14} color="#7c3aed" /> API Key Status
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {envItems.map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 8,
                background: item.ok ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
                border: `1px solid ${item.ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}`,
              }}>
                {item.ok
                  ? <CheckCircle size={15} color="#22c55e" />
                  : <XCircle size={15} color="#ef4444" />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>{item.label}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1, fontFamily: 'monospace' }}>{item.key}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: item.ok ? '#22c55e' : '#ef4444' }}>
                  {item.ok ? 'set' : 'missing'}
                </span>
              </div>
            ))}
            <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Node Environment</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#7c3aed', fontFamily: 'monospace' }}>{env?.nodeEnv || '—'}</div>
            </div>
          </div>
        </div>

        {/* Memory details */}
        <div style={{ background: '#0f1629', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={14} color="#7c3aed" /> Memory Usage
          </h3>
          {memory
            ? Object.entries(memory).map(([key, bytes], i) => {
                const mb = formatMemMB(bytes);
                const labels = { rss: 'RSS Total', heapTotal: 'Heap Total', heapUsed: 'Heap Used', external: 'External', arrayBuffers: 'Array Buffers' };
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{labels[key] || key}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', fontFamily: 'monospace' }}>{mb} MB</span>
                  </div>
                );
              })
            : <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>No memory data</p>}
        </div>
      </div>

      {/* Recent errors */}
      <div style={{ background: '#0f1629', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: 20 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={14} color="#ef4444" /> Recent Errors
        </h3>
        {recentErrors.length === 0
          ? <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, margin: 0 }}>No errors recorded</p>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '160px 1fr 1fr',
                padding: '6px 12px', fontSize: 10, fontWeight: 600,
                color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                <span>Time</span><span>Endpoint</span><span>Message</span>
              </div>
              {recentErrors.map((e, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '160px 1fr 1fr',
                  padding: '10px 12px', fontSize: 12, borderTop: '1px solid rgba(255,255,255,0.04)',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(239,68,68,0.03)',
                }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', fontSize: 11 }}>{formatTs(e.ts)}</span>
                  <span style={{ color: '#f59e0b', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.endpoint}</span>
                  <span style={{ color: '#ef4444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.message}</span>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}

// ── Feedback Tab ──────────────────────────────────────────────────────────────

const TYPE_META = {
  praise:  { label: 'Praise',         icon: <ThumbsUp      size={11} />, color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  general: { label: 'General',        icon: <MessageCircle size={11} />, color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  feature: { label: 'Feature',        icon: <Lightbulb     size={11} />, color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  bug:     { label: 'Bug',            icon: <Bug           size={11} />, color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
};

function StarRating({ value }) {
  if (!value) return <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>—</span>;
  return (
    <span style={{ display: 'flex', gap: 1 }}>
      {[1,2,3,4,5].map(n => (
        <Star key={n} size={11} color={n <= value ? '#f59e0b' : 'rgba(255,255,255,0.15)'} fill={n <= value ? '#f59e0b' : 'none'} />
      ))}
    </span>
  );
}

function FeedbackTab({ feedback }) {
  const [typeFilter, setTypeFilter] = useState('all');

  if (!feedback) return <Spinner />;

  const { stats, items } = feedback;
  const filtered = typeFilter === 'all' ? items : items.filter(f => f.type === typeFilter);

  return (
    <div>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard icon={<MessageCircle />} label="Total Feedback"  value={stats.total}       accent="#3b82f6" />
        <StatCard icon={<Star />}          label="Avg Rating"      value={stats.avgRating ? `${stats.avgRating} / 5` : '—'} sub={stats.ratedCount ? `${stats.ratedCount} rated` : null} accent="#f59e0b" />
        <StatCard icon={<ThumbsUp />}      label="Praise"          value={stats.byType?.praise  || 0} accent="#22c55e" />
        <StatCard icon={<Bug />}           label="Bug Reports"     value={stats.byType?.bug     || 0} accent="#ef4444" />
        <StatCard icon={<Lightbulb />}     label="Feature Requests"value={stats.byType?.feature || 0} accent="#a78bfa" />
      </div>

      {/* Type filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['all', 'praise', 'general', 'feature', 'bug'].map(t => (
          <button key={t} onClick={() => setTypeFilter(t)} style={{
            padding: '5px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 12, fontWeight: 600, border: '1px solid',
            background: typeFilter === t ? 'rgba(59,130,246,0.15)' : 'transparent',
            color:      typeFilter === t ? '#3b82f6' : 'rgba(255,255,255,0.4)',
            borderColor:typeFilter === t ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.1)',
          }}>
            {t === 'all' ? `All (${stats.total})` : `${TYPE_META[t]?.label} (${stats.byType?.[t] || 0})`}
          </button>
        ))}
      </div>

      {/* Feedback list */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
          No feedback yet
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(f => {
            const meta = TYPE_META[f.type] || TYPE_META.general;
            return (
              <div key={f.id} style={{
                background: '#0f1629', border: '1px solid rgba(99,102,241,0.15)',
                borderRadius: 12, padding: '14px 18px',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  {/* Type badge */}
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
                    padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                    background: `${meta.color}20`, color: meta.color, border: `1px solid ${meta.color}40`,
                  }}>
                    {meta.icon} {meta.label}
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13.5, color: 'rgba(255,255,255,0.88)', lineHeight: 1.55, wordBreak: 'break-word' }}>
                      {f.message}
                    </p>
                    <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <StarRating value={f.rating} />
                      {f.email && (
                        <span style={{ fontSize: 11, color: '#3b82f6', fontFamily: 'monospace' }}>{f.email}</span>
                      )}
                      {f.page && (
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>{f.page}</span>
                      )}
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginLeft: 'auto' }}>
                        {formatTs(f.ts)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Trust Tab ─────────────────────────────────────────────────────────────────

const TRUST_LEVEL_COLORS = {
  verified: '#22c55e',
  trusted:  '#3b82f6',
  caution:  '#f59e0b',
  low:      '#ef4444',
};

function TrustTab({ trust }) {
  if (!trust) return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
      No trust data yet — data appears after the first job search.
    </div>
  );

  const { totalProcessed, totalBlocked, blockRate, avgScore, levelCounts, topScamFlags, sourceBreakdown } = trust;

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard icon={<Shield />}      label="Jobs Processed"   value={totalProcessed}        accent="#3b82f6" />
        <StatCard icon={<XCircle />}     label="Jobs Blocked"     value={totalBlocked}           sub={`Block rate: ${blockRate}`} accent="#ef4444" />
        <StatCard icon={<TrendingUp />}  label="Avg Trust Score"  value={avgScore ?? '—'}        sub="out of 100" accent="#22c55e" />
        <StatCard icon={<CheckCircle />} label="Verified"         value={levelCounts.verified}   accent="#22c55e" />
        <StatCard icon={<Activity />}    label="Trusted"          value={levelCounts.trusted}    accent="#3b82f6" />
        <StatCard icon={<AlertTriangle />} label="Caution"        value={levelCounts.caution}    accent="#f59e0b" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Trust level distribution */}
        <div style={{ background: '#0f1629', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: '18px 20px' }}>
          <p style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Trust Level Distribution</p>
          {Object.entries(levelCounts).map(([level, count]) => {
            const total = Object.values(levelCounts).reduce((a, b) => a + b, 0) || 1;
            const pct = Math.round((count / total) * 100);
            return (
              <div key={level} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: TRUST_LEVEL_COLORS[level], textTransform: 'capitalize' }}>{level}</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{count} ({pct}%)</span>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 99 }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: TRUST_LEVEL_COLORS[level], borderRadius: 99, transition: 'width 0.6s' }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Top scam flags */}
        <div style={{ background: '#0f1629', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: '18px 20px' }}>
          <p style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Top Scam Flags Detected</p>
          {topScamFlags.length === 0
            ? <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>None detected yet</p>
            : topScamFlags.map(({ flag, count }) => (
                <div key={flag} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace' }}>{flag}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>{count}×</span>
                </div>
              ))
          }
        </div>
      </div>

      {/* Source trust breakdown */}
      {sourceBreakdown.length > 0 && (
        <div style={{ background: '#0f1629', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: '18px 20px', marginTop: 16 }}>
          <p style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Average Trust Score by Source</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
            {sourceBreakdown.map(({ source, avgTrust, jobCount }) => {
              const color = avgTrust >= 80 ? '#22c55e' : avgTrust >= 65 ? '#3b82f6' : '#f59e0b';
              return (
                <div key={source} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{source}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color }}>{avgTrust}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{jobCount} jobs</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Engagement Tab ────────────────────────────────────────────────────────────

function EngagementTab({ engagement }) {
  if (!engagement) return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
      No engagement data yet — actions appear after users interact with jobs.
    </div>
  );

  const { counts, topApplied, topSavedSources, recentApplies } = engagement;

  return (
    <div>
      {/* Key metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard icon={<ExternalLink />} label="Apply Clicks"      value={counts.applyClicks}   sub="outbound conversions" accent="#22c55e" />
        <StatCard icon={<Bookmark />}    label="Jobs Saved"         value={counts.jobSaves}       accent="#3b82f6" />
        <StatCard icon={<Eye />}         label="Job Detail Views"   value={counts.jobViews}       accent="#8b5cf6" />
        <StatCard icon={<XCircle />}     label="Jobs Discarded"     value={counts.jobDiscards}    accent="#f59e0b" />
        <StatCard icon={<MessageCircle />} label="Feedback Opens"   value={counts.feedbackOpens}  accent="#ec4899" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Top applied companies */}
        <div style={{ background: '#0f1629', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: '18px 20px' }}>
          <p style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Top Applied Companies</p>
          {topApplied.length === 0
            ? <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>No apply clicks yet</p>
            : topApplied.map(({ company, count }, i) => (
                <div key={company} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.25)', width: 18 }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{company}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#22c55e' }}>{count} clicks</span>
                </div>
              ))
          }
        </div>

        {/* Top saved sources */}
        <div style={{ background: '#0f1629', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: '18px 20px' }}>
          <p style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Most Saved From Source</p>
          {topSavedSources.length === 0
            ? <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>No saves yet</p>
            : topSavedSources.map(({ source, count }, i) => (
                <div key={source} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.25)', width: 18 }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{source}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#3b82f6' }}>{count} saves</span>
                </div>
              ))
          }
        </div>
      </div>

      {/* Recent apply clicks */}
      {recentApplies?.length > 0 && (
        <div style={{ background: '#0f1629', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: '18px 20px', marginTop: 16 }}>
          <p style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recent Apply Clicks</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 80px 100px 120px', padding: '6px 10px', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span>Job Title</span><span>Company</span><span>Match</span><span>Source</span><span>Time</span>
          </div>
          {recentApplies.slice(0, 30).map((e, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 80px 100px 120px', padding: '9px 10px', fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
              <span style={{ color: 'rgba(255,255,255,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.label}</span>
              <span style={{ color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.metadata?.company || '—'}</span>
              <span style={{ color: '#22c55e', fontWeight: 700 }}>{e.metadata?.match ? `${e.metadata.match}%` : '—'}</span>
              <span style={{ color: '#6366f1' }}>{e.metadata?.source || '—'}</span>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', fontSize: 11 }}>{formatTs(e.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Admin Dashboard ───────────────────────────────────────────────────────────

function AdminDashboard({ adminSecret, onLogout, onExit }) {
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState({ overview: null, searches: null, sources: null, health: null, errors: null, users: null, perf: null, behavior: null, feedback: null, trust: null, engagement: null, apiKeys: null });
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const intervalRef = useRef(null);

  const fetchAll = useCallback(async () => {
    const headers = { 'X-Admin-Secret': adminSecret };
    try {
      const [ovRes, srRes, srcRes, hlRes, errRes, usersRes, perfRes, behaviorRes, fbRes, trustRes, engRes, akRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/overview`,    { headers }),
        fetch(`${API_BASE}/api/admin/searches?limit=100`, { headers }),
        fetch(`${API_BASE}/api/admin/sources`,     { headers }),
        fetch(`${API_BASE}/api/admin/health`,      { headers }),
        fetch(`${API_BASE}/api/admin/errors`,      { headers }),
        fetch(`${API_BASE}/api/admin/users`,       { headers }),
        fetch(`${API_BASE}/api/admin/performance`, { headers }),
        fetch(`${API_BASE}/api/admin/behavior`,    { headers }),
        fetch(`${API_BASE}/api/admin/feedback`,    { headers }),
        fetch(`${API_BASE}/api/admin/trust`,       { headers }),
        fetch(`${API_BASE}/api/admin/engagement`,  { headers }),
        fetch(`${API_BASE}/api/admin/apikeys`,     { headers }),
      ]);
      if (!ovRes.ok) throw new Error(`Server returned ${ovRes.status}`);
      const usersData    = usersRes.ok    ? await usersRes.json()    : null;
      const perfData     = perfRes.ok     ? await perfRes.json()     : null;
      const behaviorData = behaviorRes.ok ? await behaviorRes.json() : null;
      const feedbackData = fbRes.ok       ? await fbRes.json()       : null;
      const trustData    = trustRes.ok    ? await trustRes.json()    : null;
      const engData      = engRes.ok      ? await engRes.json()      : null;
      const apiKeysData  = akRes.ok       ? await akRes.json()       : null;
      const [overview, searches, sources, health, errors] = await Promise.all([
        ovRes.json(), srRes.json(), srcRes.json(), hlRes.json(), errRes.json(),
      ]);
      setData({ overview, searches, sources, health, errors, users: usersData, perf: perfData, behavior: behaviorData, feedback: feedbackData, trust: trustData, engagement: engData, apiKeys: apiKeysData });
      setFetchError(null);
      setLastUpdated(Date.now());
    } catch (err) {
      setFetchError(err.message);
    } finally {
      setLoading(false);
    }
  }, [adminSecret]);

  useEffect(() => {
    fetchAll();
    intervalRef.current = setInterval(fetchAll, REFRESH_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [fetchAll]);

  // Live "X seconds ago" counter
  const [secsAgo, setSecsAgo] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSecsAgo(lastUpdated ? secondsAgo(lastUpdated) : 0), 1000);
    return () => clearInterval(t);
  }, [lastUpdated]);

  const tabs = [
    { id: 'overview',  label: 'Overview',    icon: <BarChart3     size={15} /> },
    { id: 'searches',  label: 'Searches',    icon: <Search        size={15} /> },
    { id: 'sources',   label: 'Sources',     icon: <Globe         size={15} /> },
    { id: 'health',    label: 'Health',      icon: <Shield        size={15} /> },
    { id: 'users',     label: 'Users',       icon: <Users         size={15} /> },
    { id: 'perf',      label: 'Performance', icon: <Activity      size={15} /> },
    { id: 'feedback',   label: 'Feedback',   icon: <MessageCircle size={15} />, badge: data.feedback?.stats?.total || null },
    { id: 'trust',      label: 'Trust',      icon: <Shield        size={15} /> },
    { id: 'engagement', label: 'Engagement', icon: <TrendingUp    size={15} /> },
    { id: 'api-keys',   label: 'API Keys',   icon: <Key           size={15} />, badge: data.apiKeys ? data.apiKeys.filter(k => k.active && !k.isSet).length || null : null },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f1e', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#fff' }}>
      {/* Header */}
      <div style={{
        background: '#0f1629', borderBottom: '1px solid rgba(99,102,241,0.2)',
        padding: '0 24px', display: 'flex', alignItems: 'center', height: 58, gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#2563eb,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={14} color="#fff" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Tulifo Admin</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', background: 'rgba(99,102,241,0.15)', padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace' }}>v1.0</span>
        </div>

        <div style={{ flex: 1 }} />

        {lastUpdated && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: secsAgo < 5 ? 'pulse 1s ease-in-out' : 'none' }} />
            {secsAgo < 60 ? `${secsAgo}s ago` : `${Math.floor(secsAgo / 60)}m ago`}
          </div>
        )}

        <button
          onClick={fetchAll}
          disabled={loading}
          style={{
            background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
            borderRadius: 7, color: '#3b82f6', padding: '6px 12px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500,
          }}
        >
          <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>

        <button
          onClick={onExit}
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 7, color: 'rgba(255,255,255,0.6)', padding: '6px 12px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
          }}
        >
          <ArrowLeft size={12} /> Back to App
        </button>

        <button
          onClick={onLogout}
          style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 7, color: '#ef4444', padding: '6px 12px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
          }}
        >
          <LogOut size={12} /> Logout
        </button>
      </div>

      {/* Tab bar */}
      <div style={{ background: '#0f1629', borderBottom: '1px solid rgba(99,102,241,0.2)', padding: '0 24px', display: 'flex', gap: 4 }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 7,
              fontSize: 13, fontWeight: 500,
              color: tab === t.id ? '#3b82f6' : 'rgba(255,255,255,0.5)',
              borderBottom: `2px solid ${tab === t.id ? '#3b82f6' : 'transparent'}`,
              transition: 'all 0.15s',
            }}
          >
            {t.icon} {t.label}
            {t.badge > 0 && (
              <span style={{
                background: '#3b82f6', color: '#fff', borderRadius: 10,
                fontSize: 10, fontWeight: 700, padding: '1px 6px', lineHeight: '14px',
              }}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: 24, maxWidth: 1280, margin: '0 auto' }}>
        {fetchError && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 10, padding: '12px 16px', marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#ef4444',
          }}>
            <AlertTriangle size={15} /> Fetch error: {fetchError}
          </div>
        )}

        {loading && !data.overview
          ? <Spinner />
          : (
            <>
              {tab === 'overview' && <OverviewTab overview={data.overview} searches={data.searches} />}
              {tab === 'searches' && <SearchesTab searches={data.searches} />}
              {tab === 'sources' && <SourcesTab sources={data.sources} adminSecret={adminSecret} onRefresh={fetchAll} />}
              {tab === 'health' && <HealthTab health={data.health} errors={data.errors} />}
              {tab === 'users' && <UsersTab users={data.users} />}
              {tab === 'perf'     && <PerfTab     perf={data.perf} behavior={data.behavior} />}
              {tab === 'feedback'   && <FeedbackTab   feedback={data.feedback} />}
              {tab === 'trust'      && <TrustTab      trust={data.trust} />}
              {tab === 'engagement' && <EngagementTab engagement={data.engagement} />}
              {tab === 'api-keys'   && <ApiKeysTab    apiKeys={data.apiKeys} adminSecret={adminSecret} onRefresh={fetchAll} />}
            </>
          )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        * { box-sizing: border-box; }
        input::placeholder { color: rgba(255,255,255,0.3); }
        button:hover { opacity: 0.85; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); }
        ::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.3); border-radius: 3px; }
      `}</style>
    </div>
  );
}

// ── Perf Tab ──────────────────────────────────────────────────────────────────

function PerfTab({ perf, behavior }) {
  if (!perf) {
    return (
      <div style={{ background: '#0f1629', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: 32, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
        Performance data unavailable — restart the server to enable API tracking.
      </div>
    );
  }

  const api     = perf.api     || {};
  const vitals  = perf.vitals  || {};
  const recent  = perf.recent  || [];

  const errorRate   = api.errorRate ?? 0;
  const avgMs       = api.overallAvgMs ?? 0;
  const p95Ms       = api.overallP95Ms ?? 0;
  const totalCalls  = api.totalCalls ?? 0;
  const endpoints   = (api.endpoints || []).slice(0, 15);

  // Vital color helpers
  function vitalColor(metric, value) {
    const v = parseFloat(value) || 0;
    if (metric === 'fcp')  return v < 1800 ? '#22c55e' : v < 3000 ? '#f59e0b' : '#ef4444';
    if (metric === 'lcp')  return v < 2500 ? '#22c55e' : v < 4000 ? '#f59e0b' : '#ef4444';
    if (metric === 'ttfb') return v < 800  ? '#22c55e' : v < 1800 ? '#f59e0b' : '#ef4444';
    if (metric === 'cls')  return v < 0.1  ? '#22c55e' : v < 0.25 ? '#f59e0b' : '#ef4444';
    // domReady, pageLoad
    return v < 2000 ? '#22c55e' : v < 4000 ? '#f59e0b' : '#ef4444';
  }

  function p95Color(ms) {
    if (ms > 2000) return '#ef4444';
    if (ms > 1000) return '#f59e0b';
    return '#22c55e';
  }

  const vitalsItems = [
    { key: 'fcp',      label: 'FCP',       value: vitals.avgFCP      ? `${vitals.avgFCP}ms`      : '—', raw: vitals.avgFCP      || 0 },
    { key: 'lcp',      label: 'LCP',       value: vitals.avgLCP      ? `${vitals.avgLCP}ms`      : '—', raw: vitals.avgLCP      || 0 },
    { key: 'ttfb',     label: 'TTFB',      value: vitals.avgTTFB     ? `${vitals.avgTTFB}ms`     : '—', raw: vitals.avgTTFB     || 0 },
    { key: 'domReady', label: 'DOM Ready', value: vitals.avgDomReady ? `${vitals.avgDomReady}ms` : '—', raw: vitals.avgDomReady || 0 },
    { key: 'pageLoad', label: 'Page Load', value: vitals.avgPageLoad ? `${vitals.avgPageLoad}ms` : '—', raw: vitals.avgPageLoad || 0 },
    { key: 'cls',      label: 'CLS',       value: vitals.avgCLS      ? vitals.avgCLS             : '—', raw: parseFloat(vitals.avgCLS) || 0 },
  ];

  const rageClickEvents = behavior?.rageClickEvents || [];
  // Aggregate rage clicks by element
  const rageMap = {};
  for (const ev of rageClickEvents) {
    const el = ev.metadata?.element || ev.label || 'unknown';
    rageMap[el] = (rageMap[el] || 0) + 1;
  }
  const topRageClicks = Object.entries(rageMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Row 1 — API stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <StatCard icon={<Activity />} label="Avg Response Time" value={`${avgMs.toLocaleString()}ms`} accent="#3b82f6" />
        <StatCard icon={<TrendingUp />} label="P95 Response" value={`${p95Ms.toLocaleString()}ms`} accent="#7c3aed" />
        <StatCard icon={<Server />} label="Total API Calls" value={totalCalls.toLocaleString()} accent="#22c55e" />
        <StatCard icon={<AlertTriangle />} label="API Error Rate" value={`${errorRate}%`} accent={errorRate > 5 ? '#ef4444' : '#22c55e'} />
      </div>

      {/* Row 2 — Web Vitals strip */}
      <div style={{ background: '#0f1629', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: 20 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={14} color="#f59e0b" /> Web Vitals
          {vitals.count === 0 && (
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: 400, marginLeft: 8 }}>
              — Web Vitals will appear after users visit the app.
            </span>
          )}
          {vitals.count > 0 && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 400, marginLeft: 8 }}>
              ({vitals.count} samples)
            </span>
          )}
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {vitalsItems.map(item => {
            const color = item.raw > 0 ? vitalColor(item.key, item.raw) : 'rgba(255,255,255,0.25)';
            return (
              <div key={item.key} style={{
                flex: '1 1 120px', minWidth: 100,
                background: `${color}10`,
                border: `1px solid ${color}40`,
                borderLeft: `3px solid ${color}`,
                borderRadius: 8, padding: '12px 14px',
              }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: item.raw > 0 ? color : 'rgba(255,255,255,0.2)', lineHeight: 1 }}>
                  {item.value}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Row 3 — API Endpoints table */}
      <div style={{ background: '#0f1629', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(99,102,241,0.1)' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>API Endpoints</h3>
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: '2fr 70px 80px 70px 80px 80px 80px',
          padding: '8px 16px', background: 'rgba(99,102,241,0.08)',
          fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          <span>Endpoint</span>
          <span>Calls</span>
          <span>Avg</span>
          <span>P50</span>
          <span>P95</span>
          <span>Max</span>
          <span>Errors%</span>
        </div>
        {endpoints.length === 0
          ? <div style={{ padding: '28px 16px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>No API calls recorded yet</div>
          : endpoints.map((ep, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '2fr 70px 80px 70px 80px 80px 80px',
              padding: '10px 16px', alignItems: 'center',
              background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
              borderTop: '1px solid rgba(255,255,255,0.04)',
              fontSize: 12,
            }}>
              <span style={{ color: '#fff', fontFamily: 'monospace', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ep.endpoint}</span>
              <span style={{ color: '#3b82f6', fontWeight: 600 }}>{ep.count}</span>
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>{ep.avgMs}ms</span>
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>{ep.p50Ms}ms</span>
              <span style={{ color: p95Color(ep.p95Ms), fontWeight: 600 }}>{ep.p95Ms}ms</span>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>{ep.maxMs}ms</span>
              <span style={{ color: ep.errorRate > 0 ? '#ef4444' : 'rgba(255,255,255,0.4)', fontWeight: ep.errorRate > 0 ? 600 : 400 }}>{ep.errorRate}%</span>
            </div>
          ))}
      </div>

      {/* Row 4 — Rage Clicks */}
      <div style={{ background: '#0f1629', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: 20 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={14} color="#f59e0b" /> Rage Clicks
        </h3>
        {topRageClicks.length === 0 ? (
          <span style={{
            display: 'inline-block', padding: '4px 14px', borderRadius: 999,
            background: 'rgba(34,197,94,0.12)', color: '#22c55e',
            fontSize: 13, fontWeight: 500, border: '1px solid rgba(34,197,94,0.25)',
          }}>
            No rage clicks detected
          </span>
        ) : (
          <div style={{
            background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: 10, padding: 16,
          }}>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
              Users are repeatedly clicking these elements — consider improving UX or responsiveness.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {topRageClicks.map(([el, count], i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 12px', background: 'rgba(245,158,11,0.08)', borderRadius: 8,
                  border: '1px solid rgba(245,158,11,0.15)',
                }}>
                  <span style={{ fontSize: 13, color: '#fff', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{el}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', marginLeft: 16, flexShrink: 0 }}>{count} rage event{count !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Users Tab ─────────────────────────────────────────────────────────────────

function UsersTab({ users }) {
  if (!users) {
    return (
      <div style={{ background: '#0f1629', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: 32, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
        User tracking data unavailable
      </div>
    );
  }

  const { stats = {}, sessions = [] } = users;
  const {
    todayCount = 0, totalSessions = 0, returningCount = 0, loggedInCount = 0,
    topCountries = [], topBrowsers = [], deviceBreakdown = [],
  } = stats;

  const maxCountry = topCountries.length ? topCountries[0].count : 1;
  const maxBrowser = topBrowsers.length  ? topBrowsers[0].count  : 1;
  const totalDevices = deviceBreakdown.reduce((a, d) => a + d.count, 0) || 1;

  const deviceColors = { desktop: '#3b82f6', mobile: '#22c55e', tablet: '#f59e0b', unknown: '#94a3b8' };

  function fmtDuration(s) {
    if (!s || s < 60) return '< 1m';
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  }

  function fmtLocation(session) {
    const city        = session.geo?.city        || '';
    const countryCode = session.geo?.countryCode || '';
    if (!city && !countryCode) return '—';
    if (!city) return countryCode;
    if (!countryCode) return city;
    return `${city}, ${countryCode}`;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <StatCard icon={<Users />}     label="Today's Visitors"  value={todayCount.toLocaleString()}    accent="#3b82f6" />
        <StatCard icon={<BarChart3 />} label="Total Sessions"    value={totalSessions.toLocaleString()} accent="#7c3aed" />
        <StatCard icon={<TrendingUp />} label="Returning Users"  value={returningCount.toLocaleString()} accent="#22c55e" />
        <StatCard icon={<User />}      label="Logged In"         value={loggedInCount.toLocaleString()} accent="#f59e0b" />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        {/* Top Countries */}
        <div style={{ background: '#0f1629', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
            Top Countries
          </h3>
          {topCountries.length === 0
            ? <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, margin: 0 }}>No data yet</p>
            : topCountries.map((c, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>{c.name}</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{c.count}</span>
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    background: 'linear-gradient(90deg,#3b82f6,#7c3aed)',
                    width: `${(c.count / maxCountry) * 100}%`,
                    transition: 'width 0.4s ease',
                  }} />
                </div>
              </div>
            ))}
        </div>

        {/* Top Browsers */}
        <div style={{ background: '#0f1629', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
            Top Browsers
          </h3>
          {topBrowsers.length === 0
            ? <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, margin: 0 }}>No data yet</p>
            : topBrowsers.map((b, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>{b.name}</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{b.count}</span>
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    background: 'linear-gradient(90deg,#22c55e,#3b82f6)',
                    width: `${(b.count / maxBrowser) * 100}%`,
                    transition: 'width 0.4s ease',
                  }} />
                </div>
              </div>
            ))}
        </div>

        {/* Device Breakdown */}
        <div style={{ background: '#0f1629', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
            Device Breakdown
          </h3>
          {deviceBreakdown.length === 0
            ? <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, margin: 0 }}>No data yet</p>
            : deviceBreakdown.map((d, i) => {
              const color = deviceColors[d.type] || deviceColors.unknown;
              const pct   = Math.round((d.count / totalDevices) * 100);
              return (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 500, textTransform: 'capitalize' }}>{d.type}</span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{pct}%</span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                    <div style={{
                      height: '100%', borderRadius: 2,
                      background: color,
                      width: `${pct}%`,
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Sessions table */}
      <div style={{ background: '#0f1629', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(99,102,241,0.1)' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>Recent Sessions</h3>
        </div>
        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '140px 100px 140px 90px 90px 80px 60px 80px 90px',
          padding: '8px 16px', background: 'rgba(99,102,241,0.08)',
          fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          <span>First Seen</span>
          <span>IP</span>
          <span>Location</span>
          <span>Browser</span>
          <span>OS</span>
          <span>Device</span>
          <span>Pages</span>
          <span>Duration</span>
          <span>Status</span>
        </div>
        {sessions.length === 0
          ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
              No sessions recorded yet
            </div>
          )
          : sessions.map((s, i) => (
            <div key={s.sessionId || i} style={{
              display: 'grid',
              gridTemplateColumns: '140px 100px 140px 90px 90px 80px 60px 80px 90px',
              padding: '10px 16px', alignItems: 'center',
              background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
              borderTop: '1px solid rgba(255,255,255,0.04)',
              fontSize: 12,
            }}>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', fontSize: 11 }}>{formatTs(s.firstSeenAt)}</span>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.ip || '—'}</span>
              <span style={{ color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fmtLocation(s)}</span>
              <span style={{ color: 'rgba(255,255,255,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.browser?.name || '—'}</span>
              <span style={{ color: 'rgba(255,255,255,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.os?.name || '—'}</span>
              <span style={{ color: 'rgba(255,255,255,0.5)', textTransform: 'capitalize' }}>{s.device?.type || '—'}</span>
              <span style={{ color: '#3b82f6', fontWeight: 600 }}>{s.pageViews || 1}</span>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>{fmtDuration(s.durationSecs)}</span>
              <span>
                {s.isLoggedIn
                  ? (
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 999,
                      background: 'rgba(34,197,94,0.15)', color: '#22c55e',
                      fontSize: 10, fontWeight: 600, border: '1px solid rgba(34,197,94,0.3)',
                    }}>
                      logged in
                    </span>
                  )
                  : (
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 999,
                      background: 'rgba(148,163,184,0.1)', color: '#94a3b8',
                      fontSize: 10, fontWeight: 600, border: '1px solid rgba(148,163,184,0.2)',
                    }}>
                      guest
                    </span>
                  )}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

// ── API Keys Tab ──────────────────────────────────────────────────────────────

function ApiKeysTab({ apiKeys, adminSecret, onRefresh }) {
  const [editingKey, setEditingKey]   = useState(null); // envKey being edited
  const [editValue, setEditValue]     = useState('');
  const [saving, setSaving]           = useState(false);
  const [saveMsg, setSaveMsg]         = useState(null); // { type: 'ok'|'err', text }
  const [deleting, setDeleting]       = useState(null); // envKey being deleted
  const [confirmDel, setConfirmDel]   = useState(null); // envKey pending confirm

  const headers = { 'X-Admin-Secret': adminSecret, 'Content-Type': 'application/json' };

  async function handleSave(envKey) {
    if (!editValue.trim()) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/apikeys`, {
        method: 'POST', headers,
        body: JSON.stringify({ envKey, value: editValue.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setSaveMsg({ type: 'ok', text: 'Saved successfully' });
      setEditingKey(null);
      setEditValue('');
      onRefresh();
    } catch (err) {
      setSaveMsg({ type: 'err', text: err.message });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 3000);
    }
  }

  async function handleDelete(envKey) {
    setDeleting(envKey);
    setConfirmDel(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/apikeys/${encodeURIComponent(envKey)}`, {
        method: 'DELETE', headers,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setSaveMsg({ type: 'ok', text: `${envKey} cleared` });
      onRefresh();
    } catch (err) {
      setSaveMsg({ type: 'err', text: err.message });
    } finally {
      setDeleting(null);
      setTimeout(() => setSaveMsg(null), 3000);
    }
  }

  if (!apiKeys) return <Spinner />;

  // Group by source
  const grouped = {};
  for (const k of apiKeys) {
    if (!grouped[k.source]) grouped[k.source] = [];
    grouped[k.source].push(k);
  }

  const activeGroups  = Object.entries(grouped).filter(([, keys]) => keys.some(k => k.active));
  const inactiveGroups = Object.entries(grouped).filter(([, keys]) => keys.every(k => !k.active));

  function renderGroup(source, keys) {
    const allSet = keys.every(k => k.isSet);
    return (
      <div key={source} style={{
        background: '#0f1629', border: '1px solid rgba(99,102,241,0.2)',
        borderRadius: 12, overflow: 'hidden', marginBottom: 12,
      }}>
        {/* Group header */}
        <div style={{
          padding: '12px 20px', borderBottom: '1px solid rgba(99,102,241,0.1)',
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(99,102,241,0.06)',
        }}>
          <span style={{ fontSize: 18 }}>{keys[0].emoji}</span>
          <span style={{ fontWeight: 600, fontSize: 14, color: '#fff' }}>{source}</span>
          <span style={{
            marginLeft: 6, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
            background: allSet ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)',
            color: allSet ? '#22c55e' : '#ef4444',
            border: `1px solid ${allSet ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.25)'}`,
          }}>
            {allSet ? 'All Set' : 'Missing'}
          </span>
        </div>

        {/* Key rows */}
        {keys.map(k => (
          <div key={k.envKey} style={{
            padding: '14px 20px',
            borderTop: '1px solid rgba(255,255,255,0.04)',
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          }}>
            {/* Label + envKey */}
            <div style={{ minWidth: 200 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{k.label}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace', marginTop: 2 }}>{k.envKey}</div>
            </div>

            {/* Status + masked value */}
            <div style={{ flex: 1, minWidth: 160 }}>
              {k.isSet ? (
                <span style={{
                  fontSize: 12, fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)',
                  background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: 6,
                  letterSpacing: '0.05em',
                }}>
                  {k.masked}
                </span>
              ) : (
                <span style={{
                  fontSize: 12, color: '#ef4444', fontWeight: 500,
                  background: 'rgba(239,68,68,0.08)', padding: '4px 10px', borderRadius: 6,
                  border: '1px solid rgba(239,68,68,0.2)',
                }}>
                  Not set
                </span>
              )}
            </div>

            {/* Edit / Delete actions */}
            {editingKey === k.envKey ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: '0 0 auto' }}>
                <input
                  type="text"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  placeholder={`Enter ${k.label}`}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleSave(k.envKey); if (e.key === 'Escape') { setEditingKey(null); setEditValue(''); } }}
                  style={{
                    background: '#0a0f1e', border: '1px solid rgba(59,130,246,0.5)',
                    borderRadius: 7, padding: '7px 12px', color: '#fff', fontSize: 13,
                    outline: 'none', width: 260, fontFamily: 'monospace',
                  }}
                />
                <button
                  onClick={() => handleSave(k.envKey)}
                  disabled={saving || !editValue.trim()}
                  style={{
                    background: 'linear-gradient(135deg,#2563eb,#7c3aed)', border: 'none',
                    borderRadius: 7, color: '#fff', padding: '7px 14px', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => { setEditingKey(null); setEditValue(''); }}
                  style={{
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 7, color: 'rgba(255,255,255,0.6)', padding: '7px 12px',
                    cursor: 'pointer', fontSize: 12,
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, flex: '0 0 auto' }}>
                <button
                  onClick={() => { setEditingKey(k.envKey); setEditValue(''); }}
                  style={{
                    background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
                    borderRadius: 7, color: '#3b82f6', padding: '6px 14px', cursor: 'pointer',
                    fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <Key size={12} /> {k.isSet ? 'Update' : 'Set Key'}
                </button>
                {k.isSet && (
                  confirmDel === k.envKey ? (
                    <>
                      <button
                        onClick={() => handleDelete(k.envKey)}
                        disabled={deleting === k.envKey}
                        style={{
                          background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)',
                          borderRadius: 7, color: '#ef4444', padding: '6px 14px', cursor: 'pointer',
                          fontSize: 12, fontWeight: 600,
                        }}
                      >
                        {deleting === k.envKey ? 'Deleting…' : 'Confirm Clear'}
                      </button>
                      <button
                        onClick={() => setConfirmDel(null)}
                        style={{
                          background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: 7, color: 'rgba(255,255,255,0.5)', padding: '6px 10px',
                          cursor: 'pointer', fontSize: 12,
                        }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setConfirmDel(k.envKey)}
                      style={{
                        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                        borderRadius: 7, color: '#ef4444', padding: '6px 12px', cursor: 'pointer',
                        fontSize: 12,
                      }}
                    >
                      Clear
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Toast */}
      {saveMsg && (
        <div style={{
          padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
          background: saveMsg.type === 'ok' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
          border: `1px solid ${saveMsg.type === 'ok' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          color: saveMsg.type === 'ok' ? '#22c55e' : '#ef4444',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {saveMsg.type === 'ok' ? <CheckCircle size={14} /> : <XCircle size={14} />}
          {saveMsg.text}
        </div>
      )}

      {/* Info banner */}
      <div style={{
        background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
        borderRadius: 10, padding: '12px 16px', fontSize: 13, color: 'rgba(255,255,255,0.6)',
        display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        <Key size={14} color="#3b82f6" style={{ marginTop: 1, flexShrink: 0 }} />
        <span>
          Keys are stored in <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 4, fontFamily: 'monospace', fontSize: 12 }}>server/data/apiKeys.json</code> and applied to the running process immediately — no server restart needed.
          Values are masked here for security.
        </span>
      </div>

      {/* Active sources */}
      <div>
        <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Active Sources
        </h3>
        {activeGroups.map(([source, keys]) => renderGroup(source, keys))}
      </div>

      {/* Inactive / future sources */}
      {inactiveGroups.length > 0 && (
        <div>
          <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Future / Inactive Sources
          </h3>
          <div style={{ opacity: 0.6 }}>
            {inactiveGroups.map(([source, keys]) => renderGroup(source, keys))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Admin Login ───────────────────────────────────────────────────────────────

function AdminLogin({ onSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const inputStyle = (hasError) => ({
    width: '100%', background: '#0a0f1e',
    border: `1px solid ${hasError ? 'rgba(239,68,68,0.5)' : 'rgba(99,102,241,0.25)'}`,
    borderRadius: 10, padding: '11px 14px 11px 40px',
    color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.15s', fontFamily: 'inherit',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password: password.trim() }),
      });
      if (res.status === 401) {
        setError('Invalid username or password.');
      } else if (!res.ok) {
        setError(`Server error: ${res.status}`);
      } else {
        const { token } = await res.json();
        onSuccess(token);
      }
    } catch (err) {
      setError('Could not reach server. Is it running on port 3001?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#050d1e',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: 380, padding: '0 20px' }}>
        <div style={{
          background: '#0f1629', border: '1px solid rgba(99,102,241,0.25)',
          borderRadius: 16, padding: 36, textAlign: 'center',
        }}>
          {/* Logo */}
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg,#2563eb,#7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <Zap size={24} color="#fff" />
          </div>
          <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#fff' }}>Tulifo Admin</h1>
          <p style={{ margin: '0 0 28px', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Sign in to access the admin dashboard</p>

          <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
            {/* Username */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Username</label>
              <div style={{ position: 'relative' }}>
                <User size={15} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError(''); }}
                  placeholder="Username"
                  autoFocus
                  autoComplete="username"
                  style={inputStyle(!!error)}
                  onFocus={e => { e.target.style.borderColor = 'rgba(59,130,246,0.5)'; }}
                  onBlur={e => { e.target.style.borderColor = error ? 'rgba(239,68,68,0.5)' : 'rgba(99,102,241,0.25)'; }}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <Shield size={15} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  type="password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="Password"
                  autoComplete="current-password"
                  style={inputStyle(!!error)}
                  onFocus={e => { e.target.style.borderColor = 'rgba(59,130,246,0.5)'; }}
                  onBlur={e => { e.target.style.borderColor = error ? 'rgba(239,68,68,0.5)' : 'rgba(99,102,241,0.25)'; }}
                />
              </div>
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 8, padding: '9px 12px', marginBottom: 14,
                fontSize: 12, color: '#ef4444',
                display: 'flex', alignItems: 'flex-start', gap: 8,
              }}>
                <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username.trim() || !password.trim()}
              style={{
                width: '100%', background: 'linear-gradient(135deg,#2563eb,#7c3aed)',
                border: 'none', borderRadius: 10, color: '#fff',
                padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                opacity: (loading || !username.trim() || !password.trim()) ? 0.6 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'opacity 0.15s', fontFamily: 'inherit',
              }}
            >
              {loading ? (
                <>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />
                  Signing in...
                </>
              ) : 'Sign in to Dashboard'}
            </button>
          </form>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── AdminPanel (default export) ───────────────────────────────────────────────

export default function AdminPanel({ onExit }) {
  const [adminSecret, setAdminSecret] = useState(() => sessionStorage.getItem('tulifo_admin_secret') || '');

  const handleLogin = (secret) => {
    sessionStorage.setItem('tulifo_admin_secret', secret);
    setAdminSecret(secret);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('tulifo_admin_secret');
    setAdminSecret('');
  };

  if (!adminSecret) {
    return <AdminLogin onSuccess={handleLogin} />;
  }

  return (
    <AdminDashboard
      adminSecret={adminSecret}
      onLogout={handleLogout}
      onExit={onExit}
    />
  );
}
