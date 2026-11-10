import { t } from '../i18n'
import { useState } from 'react'
import type { Skill, Team } from '../../../shared/types'
import { deleteSkill, putSkill } from '../api'

interface SkillsProps {
  team: Team
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function Skills({ team }: SkillsProps) {
  const [editing, setEditing] = useState<{ id: string; skill: Skill } | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const entries = Object.entries(team.skills)

  const remove = async (id: string) => {
    try {
      await deleteSkill(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <>
      <div className="marketplace-head">
        <h1>{t('Skills')}</h1>
        <button type="button" className="btn btn-primary" onClick={() => setEditing(null)}>
          {t('+ New skill')}
        </button>
      </div>
      <p className="lead">
        {t('A skill is a saved way of doing a task. Type')} <code>/</code> {t('in the composer to pick one; its instructions are inserted into your message so any employee can follow them. Employees on Claude can also use the skills in your')} <code>~/.claude/skills</code> {t('when "Use my Claude Code setup" is on.')}
      </p>
      {error && <div className="form-error">{error}</div>}
      <div className="card">
        {entries.length === 0 && (
          <div className="row">
            <div className="row-text">
              <div className="row-title">{t('No skills yet')}</div>
              <div className="row-hint">{t('Example: /standup → "List what shipped, what is blocked, what is next, one line each." Or /qa-checklist, /release-notes, /client-proposal.')}</div>
            </div>
          </div>
        )}
        {entries.map(([id, s]) => (
          <div key={id} className="row">
            <div className="row-text">
              <div className="row-title">
                <code>/{id}</code> {s.name}
              </div>
              <div className="row-hint">{s.description || s.body.slice(0, 140)}</div>
            </div>
            <div className="row-control">
              <button type="button" className="btn" onClick={() => setEditing({ id, skill: s })}>
                {t('Edit')}
              </button>
              <button type="button" className="btn btn-danger-ghost" onClick={() => void remove(id)}>
                {t('Delete')}
              </button>
            </div>
          </div>
        ))}
      </div>
      {editing !== undefined && <SkillSheet existing={editing} onDone={() => setEditing(undefined)} />}
    </>
  )
}

function SkillSheet({ existing, onDone }: { existing: { id: string; skill: Skill } | null; onDone: () => void }) {
  const [id, setId] = useState(existing?.id ?? '')
  const [name, setName] = useState(existing?.skill.name ?? '')
  const [description, setDescription] = useState(existing?.skill.description ?? '')
  const [body, setBody] = useState(existing?.skill.body ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const key = existing?.id ?? slug(id || name)
      if (!key) throw new Error(t('Give the skill a name.'))
      await putSkill(key, { name: name.trim() || key, description: description.trim(), body })
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }
  return (
    <div className="modal-backdrop nested" onMouseDown={(e) => e.target === e.currentTarget && onDone()}>
      <div className="modal sheet" role="dialog">
        <h2>{existing ? t('Edit {name}', { name: `/${existing.id}` }) : t('New skill')}</h2>
        {error && <div className="form-error">{error}</div>}
        <label className="field">
          <span>{t('Name')}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('Standup')} autoFocus />
        </label>
        {!existing && (
          <label className="field">
            <span>{t('Slash id')}</span>
            <input value={id} onChange={(e) => setId(slug(e.target.value))} placeholder={slug(name) || 'standup'} />
          </label>
        )}
        <label className="field">
          <span>{t('Short description')}</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('Shown in the / menu')} />
        </label>
        <label className="field">
          <span>{t('Instructions')}</span>
          <textarea rows={7} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('Steps, decision rules, expected output, what needs approval…')} />
        </label>
        <div className="actions">
          <button type="button" className="btn" onClick={onDone}>
            {t('Cancel')}
          </button>
          <button type="button" className="btn btn-primary" disabled={busy || !body.trim()} onClick={() => void save()}>
            {busy ? t('Saving…') : t('Save')}
          </button>
        </div>
      </div>
    </div>
  )
}
