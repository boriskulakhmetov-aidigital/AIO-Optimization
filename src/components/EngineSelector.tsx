import { useState, useEffect } from 'react';
import { ENGINE_META, getEngineColor } from '../lib/engineMeta';
import type { EngineId } from '../lib/types';

interface EngineAvailability {
  id: EngineId;
  name: string;
  shortName: string;
  provider: string;
  tier: 'free' | 'pro';
  color: string;
  available: boolean;
  reason?: 'no_key' | 'pro_only';
}

interface Props {
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  selectedEngines: EngineId[];
  onSelectionChange: (engines: EngineId[]) => void;
  queryCount: number;
  onQueryCountChange: (count: number) => void;
}

export function EngineSelector({ authFetch, selectedEngines, onSelectionChange, queryCount, onQueryCountChange }: Props) {
  const [engines, setEngines] = useState<EngineAvailability[] | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    authFetch('/.netlify/functions/engine-availability')
      .then(r => r.json())
      .then(data => {
        const available = (data.engines ?? []) as EngineAvailability[];
        setEngines(available);

        // Auto-select all available engines on first load
        if (selectedEngines.length === 0) {
          onSelectionChange(available.filter(e => e.available).map(e => e.id));
        }
      })
      .catch(console.warn);
  }, []);

  if (!engines) return null;

  const availableCount = engines.filter(e => e.available).length;
  const selectedCount = selectedEngines.length;

  function toggleEngine(id: EngineId) {
    if (selectedEngines.includes(id)) {
      onSelectionChange(selectedEngines.filter(e => e !== id));
    } else {
      onSelectionChange([...selectedEngines, id]);
    }
  }

  function selectAll() {
    onSelectionChange(engines!.filter(e => e.available).map(e => e.id));
  }

  function selectNone() {
    onSelectionChange([]);
  }

  // Group by provider
  const grouped = new Map<string, EngineAvailability[]>();
  for (const e of engines) {
    const group = grouped.get(e.provider) ?? [];
    group.push(e);
    grouped.set(e.provider, group);
  }

  return (
    <div className="engine-selector">
      <div className="engine-selector__header" onClick={() => setCollapsed(!collapsed)}>
        <span className="engine-selector__toggle">{collapsed ? '\u25B6' : '\u25BC'}</span>
        <span className="engine-selector__label">
          AI Engines
        </span>
        <span className="engine-selector__count">
          {selectedCount} of {availableCount} selected
        </span>
        {!collapsed && (
          <span className="engine-selector__actions">
            <button className="engine-selector__link" onClick={(e) => { e.stopPropagation(); selectAll(); }}>All</button>
            <button className="engine-selector__link" onClick={(e) => { e.stopPropagation(); selectNone(); }}>None</button>
          </span>
        )}
      </div>

      {!collapsed && (
        <div className="engine-selector__grid">
          {Array.from(grouped.entries()).map(([provider, providerEngines]) => (
            <div key={provider} className="engine-selector__group">
              {providerEngines.map(engine => {
                const meta = ENGINE_META[engine.id];
                const color = getEngineColor(engine.id);
                const isSelected = selectedEngines.includes(engine.id);
                const isAvailable = engine.available;

                return (
                  <label
                    key={engine.id}
                    className={`engine-chip ${isAvailable ? '' : 'engine-chip--disabled'} ${isSelected && isAvailable ? 'engine-chip--selected' : ''}`}
                    title={isAvailable ? meta?.name ?? engine.id : engine.reason === 'pro_only' ? `${meta?.name ?? engine.id} — upgrade to access` : `${meta?.name ?? engine.id} — API key not configured`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected && isAvailable}
                      disabled={!isAvailable}
                      onChange={() => toggleEngine(engine.id)}
                      className="engine-chip__input"
                    />
                    <span
                      className="engine-chip__dot"
                      style={{ background: isAvailable ? color : 'var(--muted)' }}
                    />
                    <span className="engine-chip__name">
                      {meta?.shortName ?? engine.shortName}
                    </span>
                    {!isAvailable && (
                      <span className="engine-chip__lock" title={engine.reason === 'pro_only' ? 'Upgrade required' : 'Not connected'}>
                        {engine.reason === 'pro_only' ? '\u2B50' : '\u{1F512}'}
                      </span>
                    )}
                    {engine.tier === 'pro' && isAvailable && (
                      <span className="engine-chip__tier">PRO</span>
                    )}
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Query count slider */}
      {!collapsed && (
        <div className="engine-selector__query-count">
          <label className="engine-selector__qc-label">
            Queries per engine
          </label>
          <div className="engine-selector__qc-row">
            <input
              type="range"
              min={10}
              max={100}
              step={10}
              value={queryCount}
              onChange={e => onQueryCountChange(Number(e.target.value))}
              className="engine-selector__slider"
            />
            <input
              type="number"
              min={10}
              max={100}
              step={10}
              value={queryCount}
              onChange={e => {
                const v = Math.max(10, Math.min(100, Number(e.target.value) || 50));
                onQueryCountChange(v);
              }}
              className="engine-selector__qc-input"
            />
          </div>
          <span className="engine-selector__qc-total">
            {selectedCount * queryCount} total queries across {selectedCount} engine{selectedCount !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}
