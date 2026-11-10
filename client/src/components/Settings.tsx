import { setLanguage, t, useLanguage, type Language } from '../i18n'
import { useState } from 'react'
import { RATE_LIMIT_LABELS } from '../../../shared/catalog'
import type { AccountStatus, AutoReviewRule, Conversation, McpServerDef, Routine, Team, TeamSettings, UsageSummary, UsageTotals } from '../../../shared/types'
import { deleteMcpServer, putMcpServer, putSettings, refreshAccount } from '../api'
import { formatCost, formatRelative, formatTokens, modelLabel } from '../format'
import { MARKETPLACE, type MarketplaceItem } from '../marketplace'
import { conversationTitle, personFor } from '../people'
import { Avatar } from './Avatar'
import { Providers } from './Providers'
import { Routines } from './Routines'
import { Skills } from './Skills'
import { exportAgentUrl, importAgent } from '../api'

export type SettingsSection = 'general' | 'team' | 'providers' | 'marketplace' | 'routines' | 'skills' | 'usage' | 'account'

interface SettingsProps {
  team: Team
  routines: Routine[]
  conversations: Conversation[]
  usage: UsageSummary
  account: AccountStatus
  section: SettingsSection
  onSection: (s: SettingsSection) => void
  onClose: () => void
  onEditAgent: (id: string | null) => void
}

const NAV: { id: SettingsSection; label: string; icon: string }[] = [
  { id: 'general', label: 'General', icon: '⚙️' },
  { id: 'team', label: 'Team', icon: '👥' },
  { id: 'providers', label: 'Providers', icon: '🔌' },
  { id: 'marketplace', label: 'Marketplace', icon: '🧩' },
  { id: 'routines', label: 'Routines', icon: '⏰' },
  { id: 'skills', label: 'Skills', icon: '🎯' },
  { id: 'usage', label: 'Usage', icon: '📊' },
  { id: 'account', label: 'Claude account', icon: '🔑' },
]

export function Settings(props: SettingsProps) {
  const { section, onSection, onClose } = props
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal settings" role="dialog" aria-label={t('Settings')}>
        <nav className="settings-nav">
          {NAV.map((n) => (
            <button key={n.id} type="button" className={section === n.id ? 'is-active' : ''} onClick={() => onSection(n.id)}>
              <span className="settings-nav-icon">{n.icon}</span>
              {t(n.label)}
            </button>
          ))}
        </nav>
        <div className="settings-body">
          <button type="button" className="icon-button modal-close" onClick={onClose} aria-label={t('Close')}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
          {section === 'general' && <General {...props} />}
          {section === 'team' && <TeamSection {...props} />}
          {section === 'providers' && <Providers team={props.team} />}
          {section === 'marketplace' && <Marketplace {...props} />}
          {section === 'routines' && <Routines team={props.team} conversations={props.conversations} routines={props.routines} />}
          {section === 'skills' && <Skills team={props.team} />}
          {section === 'usage' && <Usage {...props} />}
          {section === 'account' && <AccountSection {...props} />}
        </div>
      </div>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="card">{children}</div>
}

function Row({ title, hint, children }: { title: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="row">
      <div className="row-text">
        <div className="row-title">{title}</div>
        {hint && <div className="row-hint">{hint}</div>}
      </div>
      <div className="row-control">{children}</div>
    </div>
  )
}

/* ---------- General ---------- */

function General({ team }: SettingsProps) {
  const language = useLanguage()
  const [company, setCompany] = useState(team.company)
  const [ownerName, setOwnerName] = useState(team.owner.name)
  const [ownerTitle, setOwnerTitle] = useState(team.owner.title)
  const [workspace, setWorkspace] = useState(team.workspace)
  const [settings, setSettings] = useState(team.settings)
  const [status, setStatus] = useState<string | null>(null)

  const save = async () => {
    setStatus('Saving…')
    try {
      await putSettings({ company, ownerName, ownerTitle, workspace, settings })
      setStatus('Saved')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <>
      <h1>{t('General')}</h1>
      <h4>{t('Appearance')}</h4>
      <Card>
        <Row title={t('Interface language')} hint={t('Applies immediately and is saved on this device.')}>
          <select aria-label={t('Interface language')} value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
            <option value="en">English</option>
            <option value="zh-CN">简体中文</option>
          </select>
        </Row>
      </Card>
      <h4>{t('Company')}</h4>
      <Card>
        <Row title={t('Company name')}>
          <input value={company} onChange={(e) => setCompany(e.target.value)} />
        </Row>
        <Row title={t('Your name')} hint={t('How employees address you.')}>
          <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
        </Row>
        <Row title={t('Your title')}>
          <input value={ownerTitle} onChange={(e) => setOwnerTitle(e.target.value)} />
        </Row>
        <Row title={t('Workspace folder')} hint={t('Default working directory for employees\' tools.')}>
          <input value={workspace} onChange={(e) => setWorkspace(e.target.value)} className="wide" />
        </Row>
      </Card>
      <h4>{t('Conversation rules')}</h4>
      <Card>
        <Row title={t('When I post in a group without mentioning anyone')} hint={t('Smart: a fast dispatcher picks the 1-3 employees whose job it is (a build request goes to one builder). Everyone: all unmuted members reply in order. Mentions only: just the first member replies and pulls others in.')}>
          <select value={settings.groupMode} onChange={(e) => setSettings({ ...settings, groupMode: e.target.value as TeamSettings['groupMode'] })}>
            <option value="smart">{t('Smart routing (recommended)')}</option>
            <option value="everyone">{t('Everyone replies')}</option>
            <option value="mentions-only">{t('Mentions only')}</option>
          </select>
        </Row>
        <Row title={t('Employees reply in')} hint={t('Auto mirrors whatever language you write in.')}>
          <select value={settings.language} onChange={(e) => setSettings({ ...settings, language: e.target.value as TeamSettings['language'] })}>
            <option value="auto">{t('Auto (match me)')}</option>
            <option value="ar">{t('Egyptian Arabic')}</option>
            <option value="en">{t('English')}</option>
          </select>
        </Row>
        <Row title={t('Desktop notifications')} hint={t('Notify when an employee finishes a reply while you are looking elsewhere.')}>
          <input type="checkbox" className="toggle" checked={settings.notifications} onChange={(e) => setSettings({ ...settings, notifications: e.target.checked })} />
        </Row>
        <Row title={t('Max employee messages per round')} hint={t('After you post in the group, at most this many replies before the floor returns to you.')}>
          <input type="number" min={1} max={30} value={settings.maxMessagesPerRound} onChange={(e) => setSettings({ ...settings, maxMessagesPerRound: Number(e.target.value) })} />
        </Row>
        <Row title={t('Max turns per employee per round')} hint={t('Stops two colleagues ping-ponging forever.')}>
          <input type="number" min={1} max={10} value={settings.maxTurnsPerAgentPerRound} onChange={(e) => setSettings({ ...settings, maxTurnsPerAgentPerRound: Number(e.target.value) })} />
        </Row>
        <Row title={t('Max tool steps inside one reply')} hint={t('How long an employee may work with tools before answering.')}>
          <input type="number" min={1} max={200} value={settings.maxTurnsPerReply} onChange={(e) => setSettings({ ...settings, maxTurnsPerReply: Number(e.target.value) })} />
        </Row>
      </Card>
      <h4>{t('Auto-review rules')}</h4>
      <p className="lead">{t('Employees whose profile says "ask before dangerous tools" stop in the chat for Allow / Deny. Rules decide automatically: "require" wins over "allow". "Always allow" on an approval card adds a rule here.')}</p>
      <Card>
        {settings.autoReview.length === 0 && (
          <Row title={t('No rules yet')} hint={t('Example: allow Bash when the command contains \'git status\'; require approval for Write when the path contains \'production\'.')} />
        )}
        {settings.autoReview.map((r) => (
          <Row key={r.id} title={`${r.action === 'allow' ? t('Always allow') : t('Require approval for')} ${r.tool}`} hint={r.match ? t('when the input contains "{match}"', { match: r.match }) : t('for every call')}>
            <button type="button" className="btn btn-danger-ghost" onClick={() => setSettings({ ...settings, autoReview: settings.autoReview.filter((x) => x.id !== r.id) })}>
              {t('Remove')}
            </button>
          </Row>
        ))}
        <RuleAdder onAdd={(rule) => setSettings({ ...settings, autoReview: [...settings.autoReview, rule] })} />
      </Card>
      <div className="actions">
        <span className="status">{status && t(status)}</span>
        <button type="button" className="btn btn-primary" onClick={() => void save()}>
          {t('Save')}
        </button>
      </div>
    </>
  )
}

/* ---------- Team ---------- */

function TeamSection({ team, usage, onEditAgent }: SettingsProps) {
  return (
    <>
      <h1>{t('Team')}</h1>
      <p className="lead">{t('Every employee is an agent with its own persona, provider (Claude, Codex, Gemini or an API), model, effort, tools and memory. Click one to edit.')}</p>
      <Card>
        {team.agents.map((a) => {
          const p = personFor(team, a.id)
          const u = usage.byAgent[a.id]
          return (
            <div key={a.id} className="row row-button" onClick={() => onEditAgent(a.id)} role="button" tabIndex={0}>
              <Avatar person={p} size={36} />
              <div className="row-text">
                <div className="row-title">
                  {p.label}
                  {a.department && <span className="badge">{a.department}</span>}
                </div>
                <div className="row-hint">
                  {team.providers[a.provider]?.label ?? a.provider} · {modelLabel(a.model)} · {t('{effort} effort', { effort: t(a.effort) })} · {a.tools.length ? a.tools.join(', ') : t('chat only')}{a.muted ? t(' · muted') : ''}
                  {a.mcpServers.length > 0 && ` · MCP: ${a.mcpServers.join(', ')}`}
                </div>
              </div>
              <div className="row-control muted">
                {u ? t('{count} tokens · {cost}', { count: formatTokens(u.inputTokens + u.outputTokens + u.cacheReadTokens + u.cacheCreationTokens), cost: formatCost(u.costUsd) }) : t('no usage yet')}
                <a className="btn" href={exportAgentUrl(a.id)} download onClick={(e) => e.stopPropagation()} title={t('Download this employee as a shareable JSON file')}>
                  {t('Export')}
                </a>
              </div>
            </div>
          )
        })}
      </Card>
      <div className="actions">
        <ImportButton />
        <button type="button" className="btn btn-primary" onClick={() => onEditAgent(null)}>
          {t('+ New employee')}
        </button>
      </div>
    </>
  )
}

/* ---------- Marketplace ---------- */

function Marketplace({ team }: SettingsProps) {
  const [q, setQ] = useState('')
  const [category, setCategory] = useState<string>('All')
  const [adding, setAdding] = useState<MarketplaceItem | null>(null)
  const [custom, setCustom] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const installed = Object.keys(team.mcpServers)
  const categories = ['All', ...new Set(MARKETPLACE.map((m) => m.category))]
  const items = MARKETPLACE.filter((m) => (category === 'All' || m.category === category) && `${m.name} ${m.description} ${t(m.description)}`.toLowerCase().includes(q.toLowerCase()))

  const remove = async (name: string) => {
    setError(null)
    try {
      await deleteMcpServer(name)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <>
      <div className="marketplace-head">
        <h1>{t('Marketplace')}</h1>
        <button type="button" className="btn" onClick={() => setCustom(true)}>
          {t('+ Custom MCP server')}
        </button>
      </div>
      <p className="lead">
        {t('MCP servers give employees new abilities: GitHub, a browser, databases, Notion… They run locally on this computer through Claude Code. After adding one, enable it per employee in their profile.')}
      </p>
      {installed.length > 0 && (
        <>
          <h4>{t('{count} installed', { count: installed.length })}</h4>
          <Card>
            {installed.map((name) => {
              const def = team.mcpServers[name]
              const users = team.agents.filter((a) => a.mcpServers.includes(name)).map((a) => a.name)
              return (
                <Row key={name} title={name} hint={`${def?.type === 'stdio' ? `${def.command} ${(def.args ?? []).join(' ')}` : def?.url ?? ''}${users.length ? t(' · used by {users}', { users: users.join(', ') }) : t(' · not enabled for anyone yet')}`}>
                  <button type="button" className="btn btn-danger-ghost" onClick={() => void remove(name)}>
                    {t('Remove')}
                  </button>
                </Row>
              )
            })}
          </Card>
        </>
      )}
      {error && <div className="form-error">{error}</div>}
      <label className="search search-wide">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search servers')} />
      </label>
      <div className="chips">
        {categories.map((c) => (
          <button key={c} type="button" className={`chip${category === c ? ' is-active' : ''}`} onClick={() => setCategory(c)}>
            {t(c)}
          </button>
        ))}
      </div>
      <div className="market-grid">
        {items.map((m) => (
          <div key={m.id} className="market-item">
            <span className="market-icon">{m.icon}</span>
            <div className="market-text">
              <div className="row-title">{m.name}</div>
              <div className="row-hint">{t(m.description)}</div>
            </div>
            {installed.includes(m.id) ? (
              <span className="muted">{t('Added')}</span>
            ) : (
              <button type="button" className="btn btn-pill" onClick={() => setAdding(m)}>
                {t('Add')}
              </button>
            )}
          </div>
        ))}
      </div>
      {adding && <AddServer item={adding} onDone={() => setAdding(null)} />}
      {custom && <AddServer item={null} onDone={() => setCustom(false)} />}
    </>
  )
}

function AddServer({ item, onDone }: { item: MarketplaceItem | null; onDone: () => void }) {
  const [name, setName] = useState(item?.id ?? '')
  const [type, setType] = useState<McpServerDef['type']>(item?.def.type ?? 'stdio')
  const [command, setCommand] = useState(item?.def.type === 'stdio' ? item.def.command : 'npx')
  const [args, setArgs] = useState(item?.def.type === 'stdio' ? (item.def.args ?? []).join(' ') : '')
  const [url, setUrl] = useState(item && item.def.type !== 'stdio' ? item.def.url : '')
  const [secrets, setSecrets] = useState<Record<string, string>>({})
  const [envText, setEnvText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const env: Record<string, string> = { ...secrets }
      for (const line of envText.split('\n')) {
        const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
        if (m && m[1] && m[2] !== undefined) env[m[1]] = m[2]
      }
      for (const s of item?.secrets ?? []) if (!env[s.key]) throw new Error(t('{label} is required.', { label: t(s.label) }))
      const def: McpServerDef =
        type === 'stdio'
          ? { type: 'stdio', command: command.trim(), ...(args.trim() ? { args: args.trim().split(/\s+/) } : {}), ...(Object.keys(env).length ? { env } : {}) }
          : { type, url: url.trim(), ...(Object.keys(env).length ? { headers: env } : {}) }
      await putMcpServer(name.trim(), def)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop nested" onMouseDown={(e) => e.target === e.currentTarget && onDone()}>
      <div className="modal sheet" role="dialog">
        <h2>{item ? t('Add {name}', { name: item.name }) : t('Custom MCP server')}</h2>
        {error && <div className="form-error">{error}</div>}
        <label className="field">
          <span>{t('Name')}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="github" disabled={item !== null} />
        </label>
        {!item && (
          <label className="field">
            <span>{t('Transport')}</span>
            <select value={type} onChange={(e) => setType(e.target.value as McpServerDef['type'])}>
              <option value="stdio">{t('Local command (stdio)')}</option>
              <option value="http">{t('Remote HTTP')}</option>
              <option value="sse">{t('Remote SSE')}</option>
            </select>
          </label>
        )}
        {type === 'stdio' ? (
          <>
            <label className="field">
              <span>{t('Command')}</span>
              <input value={command} onChange={(e) => setCommand(e.target.value)} />
            </label>
            <label className="field">
              <span>{t('Arguments')}</span>
              <input value={args} onChange={(e) => setArgs(e.target.value)} />
              {item?.argHint && <small>{t(item.argHint)}</small>}
            </label>
          </>
        ) : (
          <label className="field">
            <span>URL</span>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
          </label>
        )}
        {(item?.secrets ?? []).map((s) => (
          <label key={s.key} className="field">
            <span>{t(s.label)}</span>
            <input type="password" value={secrets[s.key] ?? ''} onChange={(e) => setSecrets({ ...secrets, [s.key]: e.target.value })} placeholder={s.key} />
          </label>
        ))}
        <label className="field">
          <span>{type === 'stdio' ? t('Extra environment variables') : t('Extra headers')} {t('(optional)')}</span>
          <textarea rows={2} value={envText} onChange={(e) => setEnvText(e.target.value)} placeholder={'KEY=value\nOTHER=value'} />
        </label>
        <div className="actions">
          <button type="button" className="btn" onClick={onDone}>
            {t('Cancel')}
          </button>
          <button type="button" className="btn btn-primary" disabled={busy || !name.trim()} onClick={() => void save()}>
            {busy ? t('Adding…') : t('Add server')}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---------- Usage ---------- */

function totalsRow(totals: UsageTotals) {
  return (
    <>
      <td>{totals.messages}</td>
      <td>{formatTokens(totals.inputTokens)}</td>
      <td>{formatTokens(totals.cacheReadTokens)}</td>
      <td>{formatTokens(totals.cacheCreationTokens)}</td>
      <td>{formatTokens(totals.outputTokens)}</td>
      <td className="num-strong">{formatCost(totals.costUsd)}</td>
    </>
  )
}

function Usage({ team, conversations, usage }: SettingsProps) {
  const totals = usage.total
  const allIn = totals.inputTokens + totals.cacheReadTokens + totals.cacheCreationTokens
  const agents = [...team.agents].sort((a, b) => (usage.byAgent[b.id]?.costUsd ?? 0) - (usage.byAgent[a.id]?.costUsd ?? 0))
  const convs = [...conversations].filter((c) => usage.byConversation[c.id]).sort((a, b) => (usage.byConversation[b.id]?.costUsd ?? 0) - (usage.byConversation[a.id]?.costUsd ?? 0))
  return (
    <>
      <h1>{t('Usage')}</h1>
      <p className="lead">{t('Everything runs on your Claude subscription, so the dollar figures are what the same tokens would cost on the API, not a bill. Use them to compare employees and conversations.')}</p>
      <div className="stats">
        <div className="stat">
          <div className="stat-value">{formatTokens(allIn)}</div>
          <div className="stat-label">{t('input tokens')}</div>
        </div>
        <div className="stat">
          <div className="stat-value">{formatTokens(totals.outputTokens)}</div>
          <div className="stat-label">{t('output tokens')}</div>
        </div>
        <div className="stat">
          <div className="stat-value">{totals.messages}</div>
          <div className="stat-label">{t('employee replies')}</div>
        </div>
        <div className="stat">
          <div className="stat-value">{formatCost(totals.costUsd)}</div>
          <div className="stat-label">{t('API-equivalent')}</div>
        </div>
      </div>
      <h4>{t('By employee')}</h4>
      <Card>
        <table className="table">
          <thead>
            <tr>
              <th>{t('Employee')}</th>
              <th>{t('Replies')}</th>
              <th>{t('Input')}</th>
              <th>{t('Cache read')}</th>
              <th>{t('Cache write')}</th>
              <th>{t('Output')}</th>
              <th>{t('Cost')}</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => {
              const u = usage.byAgent[a.id]
              const p = personFor(team, a.id)
              return (
                <tr key={a.id}>
                  <td>
                    <span className="cell-person">
                      <Avatar person={p} size={22} />
                      {p.label}
                      <span className="muted"> · {modelLabel(a.model)}</span>
                    </span>
                  </td>
                  {u ? totalsRow(u) : <td colSpan={6} className="muted">{t('no usage yet')}</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
      {convs.length > 0 && (
        <>
          <h4>{t('By conversation')}</h4>
          <Card>
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Conversation')}</th>
                  <th>{t('Replies')}</th>
                  <th>{t('Input')}</th>
                  <th>{t('Cache read')}</th>
                  <th>{t('Cache write')}</th>
                  <th>{t('Output')}</th>
                  <th>{t('Cost')}</th>
                </tr>
              </thead>
              <tbody>
                {convs.map((c) => {
                  const u = usage.byConversation[c.id]
                  return (
                    <tr key={c.id}>
                      <td className="cell-clip">{c.kind === 'group' ? t('Group · {name}', { name: conversationTitle(team, c) }) : t('DM · {name}', { name: conversationTitle(team, c) })}</td>
                      {u && totalsRow(u)}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}
      {Object.keys(usage.byModel).length > 0 && (
        <>
          <h4>{t('By model')}</h4>
          <Card>
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Model')}</th>
                  <th>{t('Replies')}</th>
                  <th>{t('Input')}</th>
                  <th>{t('Cache read')}</th>
                  <th>{t('Cache write')}</th>
                  <th>{t('Output')}</th>
                  <th>{t('Cost')}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(usage.byModel).map(([m, u]) => (
                  <tr key={m}>
                    <td>{m.split('+').map(modelLabel).join(' + ')}</td>
                    {totalsRow(u)}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </>
  )
}

/* ---------- Account ---------- */

function AccountSection({ account }: SettingsProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const windows = Object.values(account.windows).sort((a, b) => a.type.localeCompare(b.type))
  const refresh = async () => {
    setBusy(true)
    setError(null)
    try {
      await refreshAccount()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }
  const auth = account.authSource === undefined ? t('unknown until an employee speaks') : account.authSource === 'none' ? t('Claude subscription (Claude Code login)') : t('API key ({source})', { source: account.authSource })
  return (
    <>
      <h1>{t('Claude account')}</h1>
      <h4>{t('Connection')}</h4>
      <Card>
        <Row title={t('Signed in through')} hint={`Claude Code ${account.claudeCodeVersion ?? ''}`.trim()}>
          <span>{auth}</span>
        </Row>
        <Row title={t('Refresh limits')} hint={t('Runs a one-word Haiku turn to read the current limit windows. Costs almost nothing.')}>
          <button type="button" className="btn" disabled={busy} onClick={() => void refresh()}>
            {busy ? t('Checking…') : t('Check now')}
          </button>
        </Row>
      </Card>
      {error && <div className="form-error">{error}</div>}
      <h4>{t('Limits')}</h4>
      <Card>
        {windows.length === 0 ? (
          <Row title={t('No limit data yet')} hint={t('Claude reports the windows as employees talk. Press Check now to fetch them.')} />
        ) : (
          windows.map((w) => {
            const pct = typeof w.utilization === 'number' ? Math.min(100, Math.round(w.utilization * 100)) : null
            const tone = w.status === 'rejected' ? 'is-danger' : w.status === 'allowed_warning' || (pct ?? 0) >= 80 ? 'is-warn' : ''
            return (
              <div key={w.type} className="limit">
                <div className="limit-head">
                  <span className="row-title">{t(RATE_LIMIT_LABELS[w.type])}</span>
                  <span className="muted">
                    {pct === null ? t(w.status) : t('{percent}% used', { percent: pct })}
                    {w.resetsAt ? t(' · resets {time}', { time: formatRelative(w.resetsAt * (w.resetsAt < 1e12 ? 1000 : 1)) }) : ''}
                  </span>
                </div>
                <div className={`bar ${tone}`}>
                  <div className="bar-fill" style={{ width: `${pct ?? (w.status === 'rejected' ? 100 : 0)}%` }} />
                </div>
              </div>
            )
          })
        )}
        {account.updatedAt && <div className="muted small">{t('Last update')} {formatRelative(account.updatedAt)}</div>}
      </Card>
    </>
  )
}

function RuleAdder({ onAdd }: { onAdd: (rule: AutoReviewRule) => void }) {
  const [action, setAction] = useState<'allow' | 'require'>('require')
  const [tool, setTool] = useState('Bash')
  const [match, setMatch] = useState('')
  return (
    <div className="row rule-adder">
      <select value={action} onChange={(e) => setAction(e.target.value as 'allow' | 'require')}>
        <option value="require">{t('Require approval for')}</option>
        <option value="allow">{t('Always allow')}</option>
      </select>
      <input value={tool} onChange={(e) => setTool(e.target.value)} placeholder={t('Tool (Bash, Write, Edit, mcp__github__…, or *)')} />
      <input value={match} onChange={(e) => setMatch(e.target.value)} placeholder={t('when input contains… (optional)')} />
      <button
        type="button"
        className="btn"
        disabled={!tool.trim()}
        onClick={() => {
          onAdd({ id: Math.random().toString(36).slice(2, 10), action, tool: tool.trim(), ...(match.trim() ? { match: match.trim() } : {}) })
          setMatch('')
        }}
      >
        {t('Add rule')}
      </button>
    </div>
  )
}

function ImportButton() {
  const [error, setError] = useState<string | null>(null)
  return (
    <>
      {error && <span className="status" style={{ color: 'var(--danger)' }}>{error}</span>}
      <label className="btn">
        {t('Import employee…')}
      <input
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            setError(null)
            try {
              const parsed = JSON.parse(await f.text()) as { agent?: unknown }
              await importAgent(parsed.agent ?? parsed)
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err))
            }
          }}
        />
      </label>
    </>
  )
}
