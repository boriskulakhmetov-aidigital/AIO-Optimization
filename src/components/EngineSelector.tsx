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
}

interface Props {
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  selectedEngines: EngineId[];
  onSelectionChange: (engines: EngineId[]) => void;
}

export function EngineSelector({ authFetch, selectedEngines, onSelectionChange }: Props) {
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
                    title={isAvailable ? meta?.name ?? engine.id : `${meta?.name ?? engine.id} — API key not configured`}
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
                      <span className="engine-chip__lock" title="API key not configured">&#128274;</span>
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
    </div>
  );
}
