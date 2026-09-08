import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import {
  CardChoiceAction,
  CardDefinition,
  CombatEvent,
  createInitialRun,
  GamePhase,
  gameReducer,
  getCardDefinition,
  getCardEffectLabel,
  loadRun,
  OwnedCard,
  RunState,
  serializeRun,
  UpgradeChoice,
} from "./domain/game";

const heroAssetUrl = `${import.meta.env.BASE_URL}assets/ember-knight.png`;
const forgeAssetUrl = `${import.meta.env.BASE_URL}assets/forge-arena-v2.png`;
const goblinAssetUrl = `${import.meta.env.BASE_URL}assets/goblin-raider-v2.png`;
const familyLabels: Record<CardDefinition["family"], string> = { fire: "Feu", attack: "Attaque", defense: "Défense", rage: "Rage", equipment: "Équipement" };
const phaseLabels: Record<GamePhase, string> = { planning: "Préparation", cardChoice: "Pioche", arranging: "Séquence prête", resolvingPlayerCards: "La chaîne frappe", resolvingEnemyTurn: "Riposte ennemie", victory: "Vague vaincue", levelUp: "Niveau supérieur", defeat: "La chaîne est rompue" };
const combatPhases: GamePhase[] = ["resolvingPlayerCards", "resolvingEnemyTurn"];
type AtlasSpec = { file: string; columns: number; rows: number; column: number; row: number };
const cardAtlases: Record<string, AtlasSpec> = {
  "ember-brand": { file: "cards-fire-atlas.png", columns: 3, rows: 2, column: 0, row: 0 }, fireball: { file: "cards-fire-atlas.png", columns: 3, rows: 2, column: 1, row: 0 }, "burning-edge": { file: "cards-fire-atlas.png", columns: 3, rows: 2, column: 2, row: 0 }, meteor: { file: "cards-fire-atlas.png", columns: 3, rows: 2, column: 0, row: 1 }, "ember-surge": { file: "cards-fire-atlas.png", columns: 3, rows: 2, column: 1, row: 1 },
  strike: { file: "cards-attack-atlas.png", columns: 2, rows: 2, column: 0, row: 0 }, "double-slash": { file: "cards-attack-atlas.png", columns: 2, rows: 2, column: 1, row: 0 }, "piercing-lunge": { file: "cards-attack-atlas.png", columns: 2, rows: 2, column: 0, row: 1 }, execution: { file: "cards-attack-atlas.png", columns: 2, rows: 2, column: 1, row: 1 },
  guard: { file: "cards-support-atlas.png", columns: 2, rows: 2, column: 0, row: 0 }, mend: { file: "cards-support-atlas.png", columns: 2, rows: 2, column: 1, row: 0 }, rage: { file: "cards-support-atlas.png", columns: 2, rows: 2, column: 0, row: 1 },
  "berserker-blade": { file: "cards-equipment-atlas.png", columns: 3, rows: 3, column: 0, row: 0 }, "cinder-amulet": { file: "cards-equipment-atlas.png", columns: 3, rows: 3, column: 1, row: 0 }, "royal-aegis": { file: "cards-equipment-atlas.png", columns: 3, rows: 3, column: 2, row: 0 }, "crit-sigil": { file: "cards-equipment-atlas.png", columns: 3, rows: 3, column: 0, row: 1 }, "flame-core": { file: "cards-equipment-atlas.png", columns: 3, rows: 3, column: 1, row: 1 }, "duelist-glove": { file: "cards-equipment-atlas.png", columns: 3, rows: 3, column: 2, row: 1 }, "fortress-heart": { file: "cards-equipment-atlas.png", columns: 3, rows: 3, column: 0, row: 2 }, "blood-oath": { file: "cards-equipment-atlas.png", columns: 3, rows: 3, column: 1, row: 2 },
};

function atlasStyle(cardId: string): CSSProperties {
  const atlas = cardAtlases[cardId];
  if (!atlas) return {};
  const x = atlas.columns === 1 ? 0 : atlas.column / (atlas.columns - 1) * 100;
  const y = atlas.rows === 1 ? 0 : atlas.row / (atlas.rows - 1) * 100;
  // Scale sprites by height so a square atlas cell is cropped, never stretched,
  // inside the portrait cards and the larger detail view.
  return { backgroundImage: `url(${import.meta.env.BASE_URL}assets/${atlas.file})`, backgroundSize: `auto ${atlas.rows * 100}%`, backgroundPosition: `${x}% ${y}%` };
}

function useSound(enabled: boolean) {
  const context = useRef<AudioContext | null>(null);
  return useCallback((kind: string) => {
    if (!enabled || typeof window === "undefined") return;
    try {
      const Ctor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      context.current ??= new Ctor();
      const audio = context.current;
      if (audio.state === "suspended") void audio.resume();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const now = audio.currentTime;
      const tones: Record<string, [number, number]> = { card: [390, .08], hit: [110, .1], crit: [740, .14], shield: [260, .09], heal: [520, .12], victory: [610, .22], defeat: [90, .3], combo: [820, .16], windup: [175, .34] };
      const [frequency, duration] = tones[kind] ?? [320, .06];
      oscillator.type = kind === "hit" || kind === "defeat" ? "sawtooth" : "triangle";
      oscillator.frequency.setValueAtTime(frequency, now);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(60, frequency * .72), now + duration);
      gain.gain.setValueAtTime(.0001, now);
      gain.gain.exponentialRampToValueAtTime(.055, now + .012);
      gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(now);
      oscillator.stop(now + duration + .02);
    } catch { /* Sound is optional. */ }
  }, [enabled]);
}

function HpBar({ value, max, tone = "ember" }: { value: number; max: number; tone?: "ember" | "enemy" }) {
  const percentage = Math.max(0, Math.min(100, value / Math.max(1, max) * 100));
  return <div className={`hp-bar hp-${tone}`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}><span style={{ width: `${percentage}%` }} /></div>;
}

function CardArt({ card, compact = false }: { card: OwnedCard; compact?: boolean }) {
  return <span className={`card-art ${compact ? "is-compact" : ""}`} style={atlasStyle(card.cardId)} aria-hidden="true" />;
}

function CardVisual({ card }: { card: OwnedCard }) {
  const definition = getCardDefinition(card.cardId);
  return <><span className="card-sheen" /><CardArt card={card} /><span className="card-topline"><span>{familyLabels[definition.family]}</span><span className="level-badge">N{card.level}</span></span><span className="card-copy-overlay"><span className="card-name">{definition.name}</span><span className="card-subtitle">{definition.subtitle}</span></span><span className="card-effect">{getCardEffectLabel(card.cardId, card.level)}</span>{definition.kind === "equipment" && <span className="equipment-stamp">PASSIF</span>}</>;
}

function CardTile({ card, selected = false, locked = false, onTap, onPointerDown, onPointerMove, onPointerUp, onPointerCancel }: { card: OwnedCard; selected?: boolean; locked?: boolean; onTap?: () => void; onPointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void; onPointerMove?: (event: ReactPointerEvent<HTMLButtonElement>) => void; onPointerUp?: (event: ReactPointerEvent<HTMLButtonElement>) => void; onPointerCancel?: (event: ReactPointerEvent<HTMLButtonElement>) => void }) {
  const definition = getCardDefinition(card.cardId);
  return <button type="button" className={`card-tile family-${definition.family} ${selected ? "is-selected" : ""} ${locked ? "is-locked" : ""}`} onClick={onTap} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} aria-label={`${definition.name}, niveau ${card.level}. ${definition.description}`}><CardVisual card={card} /></button>;
}

function SortableCard({ card, index, locked, active, dragging = false, onTap, onDragStart, onDragMove, onDragEnd, onDragCancel }: { card: OwnedCard; index: number; locked: boolean; active: boolean; dragging?: boolean; onTap: () => void; onDragStart: (event: ReactPointerEvent<HTMLButtonElement>, uid: string) => void; onDragMove: (event: ReactPointerEvent<HTMLButtonElement>) => void; onDragEnd: (event: ReactPointerEvent<HTMLButtonElement>) => void; onDragCancel: (event: ReactPointerEvent<HTMLButtonElement>) => void }) {
  return <div className={`hand-slot ${active ? "is-active" : ""} ${dragging ? "is-dragging" : ""}`} data-card-uid={card.uid} style={{ "--deal-index": index } as CSSProperties}><span className="slot-number">{String(index + 1).padStart(2, "0")}</span><CardTile card={card} selected={dragging} locked={locked} onTap={onTap} onPointerDown={(event) => onDragStart(event, card.uid)} onPointerMove={onDragMove} onPointerUp={onDragEnd} onPointerCancel={onDragCancel} /></div>;
}

function BuildBadges({ cards }: { cards: OwnedCard[] }) {
  const counts = useMemo(() => ({ fire: cards.filter((card) => getCardDefinition(card.cardId).tags.includes("fire")).length, crit: cards.filter((card) => getCardDefinition(card.cardId).tags.includes("crit")).length, defense: cards.filter((card) => getCardDefinition(card.cardId).tags.includes("defense") || getCardDefinition(card.cardId).family === "defense").length }), [cards]);
  return <><div className="build-badges" aria-label="Affinités du build"><span className={`build-badge fire ${counts.fire ? "active" : ""}`}>🔥 Feu <b>{counts.fire}</b></span><span className={`build-badge crit ${counts.crit ? "active" : ""}`}>✦ Critique <b>{counts.crit}</b></span><span className={`build-badge defense ${counts.defense ? "active" : ""}`}>◈ Défense <b>{counts.defense}</b></span></div><SequenceRail cards={cards} /></>;
}

function SequenceRail({ cards }: { cards: OwnedCard[] }) {
  let marked = false;
  let rage = 0;
  const steps = cards.map((card) => {
    const definition = getCardDefinition(card.cardId);
    let outcome = getCardEffectLabel(card.cardId, card.level);
    if (card.cardId === "ember-brand") { marked = true; outcome = "Marque la cible · prochaine frappe +15"; }
    if (card.cardId === "rage") { rage = card.level >= 2 ? 2 : 1; outcome = `Prochaine attaque +${rage * 35}%`; }
    if (card.cardId === "strike") { outcome = marked ? "+15 dégâts · frappe préparée" : "Frappe directe"; marked = false; rage = 0; }
    if (card.cardId === "double-slash") { outcome = `2 impacts${rage ? " · rage consommée" : ""}`; rage = 0; }
    return { card, definition, outcome };
  });
  return <div className="sequence-rail" aria-label="Prévision de la séquence"><span className="sequence-label">CHAÎNE PRÉVUE</span><div className="sequence-summary">{steps.map(({ card, definition, outcome }, index) => <span className={`sequence-step family-${definition.family}`} key={card.uid}><b>{index + 1}. {definition.name}</b><small>{outcome}</small>{index < steps.length - 1 && <i>→</i>}</span>)}</div></div>;
}

function EnemyPanel({ enemy, wave, event }: { enemy: RunState["currentEnemy"]; wave: number; event: CombatEvent | null }) {
  const displayEnemy = event ? { ...enemy, hp: event.enemyHpAfter, burn: event.enemyBurnAfter, marked: event.enemyMarkedAfter } : enemy;
  const damageReaction = event?.type === "damage" && event.targetId === enemy.id;
  const enemyAsset = enemy.kind === "goblin" ? goblinAssetUrl : null;
  const intentActive = event?.type === "enemyWindup";
  return <section className={`enemy-panel enemy-${enemy.intent} ${enemy.kind === "boss" ? "is-boss" : ""} ${damageReaction ? "is-reacting" : ""} ${intentActive ? "is-winding-up" : ""} ${event?.tags?.includes("enemy-attack") ? "is-lunging" : ""}`}>
    <div className="panel-heading"><div><span className="overline">{enemy.kind === "boss" ? "BOSS · " : "MENACE · "}{enemy.title}</span><h1>{enemy.name}</h1></div><span className="wave-badge">VAGUE <b>{String(wave).padStart(2, "0")}</b></span></div>
    <div className="enemy-main"><div className="enemy-portrait"><span className="portrait-aura" />{enemyAsset && <img className="enemy-asset" src={enemyAsset} alt="" onError={(event) => { event.currentTarget.hidden = true; }} />}<span className="enemy-silhouette" data-kind={enemy.kind}><i /><b /><em /></span><span className="portrait-runes">✦ · ᛝ · ✦</span></div><div className="enemy-stats"><div className="stat-row"><span>♥ {displayEnemy.hp} / {enemy.maxHp}</span><span>⚔ {enemy.attack}</span><span>◈ {enemy.defense}</span></div><HpBar value={displayEnemy.hp} max={enemy.maxHp} tone="enemy" /><div className="status-row"><span className={`status enemy-intent ${intentActive ? "is-active" : ""}`}>⚠ {intentActive ? "RIPOSTE · " : "INTENTION · "}{enemy.intentLabel}</span>{displayEnemy.burn > 0 && <span className="status burn">🔥 Brûlure {displayEnemy.burn}</span>}{displayEnemy.marked && <span className="status mark">✦ Marquée</span>}</div></div></div>
  </section>;
}

function HeroPanel({ hero, event }: { hero: RunState["hero"]; event: CombatEvent | null }) {
  const displayHero = event ? { ...hero, hp: event.heroHpAfter, shield: event.heroShieldAfter, rage: event.heroRageAfter } : hero;
  const damageReaction = event?.type === "damage" && event.targetId === "hero";
  return <section className={`hero-panel ${damageReaction ? "is-reacting" : ""}`}><div className="hero-portrait"><img src={heroAssetUrl} alt="Kael, dernier veilleur" /><span className="hero-glint" /></div><div className="hero-stats"><div className="hero-heading"><div><span className="overline">HÉROS · NIVEAU {hero.level}</span><h2>Kael, dernier veilleur</h2></div><span className="hero-level">N{hero.level}</span></div><div className="stat-row"><span>♥ {displayHero.hp} / {hero.maxHp}</span><span>⚔ {hero.attack}</span><span>◈ {hero.defense}</span>{displayHero.shield > 0 && <span className="shield-stat">Bouclier {displayHero.shield}</span>}</div><HpBar value={displayHero.hp} max={hero.maxHp} /><div className="xp-row"><span>EXP</span><span>{hero.xp} / {hero.nextXp}</span></div><div className="xp-bar"><span style={{ width: `${Math.min(100, hero.xp / hero.nextXp * 100)}%` }} /></div></div></section>;
}

function CombatVfx({ event }: { event: CombatEvent | null }) {
  if (!event) return null;
  const tags = event.tags ?? [];
  const tone = event.type === "enemyWindup" ? "windup" : tags.includes("enemy-attack") ? "enemy" : tags.includes("critical") ? "critical" : tags.includes("fire") ? "fire" : tags.includes("shield") || tags.includes("blocked") ? "shield" : tags.includes("heal") ? "heal" : tags.includes("combo") ? "combo" : event.type === "damage" ? "impact" : "neutral";
  const particleCount = tone === "fire" || tone === "critical" ? 16 : 10;
  const route = event.targetId === "hero" ? "to-hero" : event.targetId ? "to-enemy" : "at-center";
  return <div className={`combat-vfx vfx-${tone} ${route}`} key={event.id} aria-hidden="true"><span className="vfx-trail" /><span className="vfx-flash" /><span className="vfx-ring" />{(tone === "enemy" || tone === "windup") && <span className="vfx-slash" />}{Array.from({ length: particleCount }, (_, index) => <i key={`${event.id}-${index}`} style={{ "--i": index, "--count": particleCount } as CSSProperties} />)}</div>;
}

function CombatFeed({ events }: { events: CombatEvent[] }) {
  return <div className="combat-feed" aria-live="polite"><span className="feed-label">DERNIERS ÉVÉNEMENTS</span>{events.slice(-3).map((event) => <div className={`feed-line feed-${event.type}`} key={event.id}><span>{event.type === "enemyWindup" ? "⚠ " : event.cardUid ? "✦ " : ""}{event.message}</span>{event.amount ? <strong>{event.amount}</strong> : null}</div>)}</div>;
}

function JournalSheet({ events, onClose }: { events: CombatEvent[]; onClose: () => void }) {
  return <div className="sheet-layer journal-layer" role="dialog" aria-modal="true" aria-label="Journal de combat" onClick={onClose}><section className="bottom-sheet journal-sheet" onClick={(event) => event.stopPropagation()}><div className="sheet-handle" /><div className="sheet-heading"><div><span className="overline">CHRONIQUE DE LA FORGE</span><h2>Journal de combat</h2></div><button className="sheet-close" onClick={onClose} aria-label="Fermer le journal">×</button></div><p className="sheet-lead">Les tours restent visibles jusqu’à la fin de la vague.</p><div className="journal-list">{events.length ? events.map((event, index) => <div className={`journal-entry journal-${event.type}`} key={`${event.id}-${index}`}><span className="journal-round">T{event.round}</span><span className="journal-mark">{event.type === "enemyWindup" ? "⚠" : event.type === "damage" ? "✦" : event.type === "shield" ? "◈" : event.type === "heal" ? "♥" : "·"}</span><div><strong>{event.message}</strong><small>{event.type === "enemyWindup" ? "RIPOSTE ENNEMIE" : event.cardUid ? getCardDefinition(event.sourceId ?? "").name : event.type.replace("enemy", "ennemi").toUpperCase()}</small></div>{event.amount !== undefined && <b>{event.amount}</b>}</div>) : <div className="journal-empty">La chronique se remplira dès que ta chaîne frappera.</div>}</div><button className="sheet-primary" onClick={onClose}>RETOUR À LA FORGE <b>→</b></button></section></div>;
}

function GuideSheet({ onClose }: { onClose: () => void }) {
  return <div className="sheet-layer" role="dialog" aria-modal="true" aria-label="Guide du forgeron" onClick={onClose}><section className="bottom-sheet guide-sheet" onClick={(event) => event.stopPropagation()}><div className="sheet-handle" /><div className="sheet-heading"><div><span className="overline">GUIDE DU FORGERON</span><h2>Construis ta machine.</h2></div><button className="sheet-close" onClick={onClose} aria-label="Fermer">×</button></div><p className="sheet-lead">Au début, quatre cartes aléatoires arrivent dans ta main. Ordonne-les puis lance un tour.</p><div className="guide-steps"><div><b>01</b><span><strong>ORDONNE</strong><small>Les cartes jouent de gauche à droite.</small></span></div><div><b>02</b><span><strong>ATTAQUE</strong><small>Ta chaîne frappe une seule fois.</small></span></div><div><b>03</b><span><strong>ENCAISSE</strong><small>L’ennemi riposte s’il survit.</small></span></div><div><b>04</b><span><strong>PIOCHE</strong><small>Garde, fusionne ou échange une carte précise.</small></span></div></div><button className="sheet-primary" onClick={onClose}>COMPRIS <b>→</b></button></section></div>;
}

function CardDetailSheet({ card, onClose }: { card: OwnedCard; onClose: () => void }) {
  const definition = getCardDefinition(card.cardId);
  return <div className="sheet-layer" role="dialog" aria-modal="true" aria-label={`Détails de ${definition.name}`} onClick={onClose}><section className={`bottom-sheet detail-sheet family-${definition.family}`} onClick={(event) => event.stopPropagation()}><div className="sheet-handle" /><div className="sheet-heading"><div><span className="overline">{familyLabels[definition.family]} · NIVEAU {card.level}</span><h2>{definition.name}</h2></div><button className="sheet-close" onClick={onClose} aria-label="Fermer">×</button></div><CardArt card={card} /><span className="detail-subtitle">{definition.subtitle}</span><p className="detail-description">{definition.description}</p><div className="detail-effect"><span>EFFET RÉEL · NIVEAU {card.level}</span><strong>{getCardEffectLabel(card.cardId, card.level)}</strong></div>{definition.kind === "equipment" && <span className="passive-pill">PASSIF · RESTE ACTIF PENDANT LA RUN</span>}<button className="sheet-primary" onClick={onClose}>RETOUR À LA FORGE <b>→</b></button></section></div>;
}

function DrawSheet({ state, candidate, canFuse, onChoose, onDetails, onJournal, onSkip }: { state: RunState; candidate: CardDefinition; canFuse: boolean; onChoose: (action: CardChoiceAction, uid?: string) => void; onDetails: () => void; onJournal: () => void; onSkip: () => void }) {
  const [mode, setMode] = useState<Exclude<CardChoiceAction, "keep"> | null>(null);
  const [targetUid, setTargetUid] = useState<string | null>(null);
  const target = targetUid ? state.activeCards.find((card) => card.uid === targetUid) ?? null : null;
  const validTarget = target && (mode === "replace" || (mode === "fuse" && target.cardId === candidate.id));
  const full = state.activeCards.length >= state.hero.slots;

  return <div className="sheet-layer draw-layer" role="dialog" aria-modal="true" aria-label="Nouvelle carte">
    <section className="bottom-sheet draw-sheet">
      <div className="sheet-heading"><div><span className="overline">APRÈS LA RIPOSTE · TOUR {state.round}</span><h2>Tu pioches une carte.</h2></div><div><button className="info-button" onClick={onJournal} aria-label="Ouvrir le journal">☷</button><button className="info-button" onClick={onDetails} aria-label="Voir les détails">i</button></div></div>
      <div className="draw-card-row">
        <button className={`card-tile family-${candidate.family} draw-card`} onClick={onDetails} aria-label={`Détails de ${candidate.name}`}><CardVisual card={{ uid: "candidate", cardId: candidate.id, level: 1 }} /></button>
        <div className="draw-copy"><span>Compare avant de confirmer.</span>{!full && <button className="sheet-primary" onClick={() => onChoose("keep")}>GARDER DANS LA LIGNE <b>→</b></button>}{full && <button className="sheet-secondary" onClick={onSkip}>PASSER · MAIN PLEINE <b>↷</b></button>}<button className={`sheet-secondary ${mode === "replace" ? "selected" : ""}`} onClick={() => { setMode("replace"); setTargetUid(null); }}>ÉCHANGER AVEC MA MAIN <b>⇄</b></button>{canFuse && <button className={`sheet-secondary ${mode === "fuse" ? "selected" : ""}`} onClick={() => { setMode("fuse"); setTargetUid(null); }}>FUSIONNER LA COPIE <b>✦</b></button>}</div>
      </div>
      <div className={`target-picker hand-preview ${mode ? "is-selecting" : ""}`}>
        <span>{mode ? "Sélectionne une cible, vérifie, puis confirme." : "Choisis une action."}</span>
        <div>{state.activeCards.map((card) => {
          const definition = getCardDefinition(card.cardId);
          const valid = mode === "replace" || (mode === "fuse" && card.cardId === candidate.id);
          return <button key={card.uid} className={`target-card family-${definition.family} ${targetUid === card.uid ? "selected" : ""}`} disabled={!valid} onClick={() => setTargetUid(card.uid)}>
            <CardArt card={card} compact />
            <b>N{card.level}</b>
            <span>{definition.name}</span>
            <small className="target-effect">{getCardEffectLabel(card.cardId, card.level)}</small>
          </button>;
        })}</div>
        {validTarget && <div className="draw-comparison"><div><small>SORTANT</small><strong>{getCardDefinition(target.cardId).name} · N{target.level}</strong><span>{getCardEffectLabel(target.cardId, target.level)}</span></div><span>→</span><div><small>ENTRANT</small><strong>{candidate.name} · N1</strong><span>{getCardEffectLabel(candidate.id, 1)}</span></div><button className="sheet-primary" onClick={() => onChoose(mode!, target.uid)}>CONFIRMER <b>✓</b></button></div>}
      </div>
    </section>
  </div>;
}

function UpgradeCard({ option, onChoose }: { option: UpgradeChoice; onChoose: () => void }) {
  return <button className="upgrade-card" onClick={onChoose}><span className="upgrade-icon">{option.icon}</span><span className="upgrade-copy"><strong>{option.label}</strong><span>{option.detail}</span></span><b>→</b></button>;
}

function ResultSheet({ state, onNextWave, onRestart, onUpgrade, onJournal }: { state: RunState; onNextWave: () => void; onRestart: () => void; onUpgrade: (id: UpgradeChoice["id"]) => void; onJournal: () => void }) {
  if (state.phase === "levelUp") return <div className="sheet-layer" role="dialog" aria-modal="true" aria-label="Niveau supérieur"><section className="bottom-sheet result-sheet level-sheet"><div className="sheet-handle" /><span className="result-kicker">NIVEAU SUPÉRIEUR · N{state.hero.level}</span><h2>Renforce Kael.</h2><p>Choisis une amélioration pour modifier ta prochaine chaîne.</p><div className="upgrade-list">{state.pendingUpgradeOptions.map((option) => <UpgradeCard option={option} onChoose={() => onUpgrade(option.id)} key={option.id} />)}</div></section></div>;
  if (state.phase === "victory") return <div className="sheet-layer" role="dialog" aria-modal="true" aria-label="Victoire"><section className="bottom-sheet result-sheet victory-sheet"><div className="sheet-handle" /><span className="result-kicker">✦ VAGUE {state.wave} VAINCUE ✦</span><div className="victory-mark">✦</div><h2>La chaîne tient bon.</h2><div className="reward-strip"><span>✦ +{state.reward?.xp ?? 0} EXP</span><span>✧ +{state.reward?.essence ?? 0} ÉCLATS</span></div><button className="sheet-primary" onClick={onNextWave}>VAGUE SUIVANTE <b>→</b></button></section></div>;
  if (state.phase === "defeat") return <div className="sheet-layer" role="dialog" aria-modal="true" aria-label="Défaite"><section className="bottom-sheet result-sheet defeat-sheet"><div className="sheet-handle" /><span className="result-kicker">LA FORGE T’A BRISÉ</span><div className="defeat-mark">×</div><h2>La vague {state.wave} gagne.</h2><p>Change l’ordre de tes cartes et retente la chaîne.</p><button className="sheet-primary" onClick={onRestart}>NOUVELLE RUN <b>↻</b></button></section></div>;
  return null;
}

function HomeMenu({ wave, hasSavedRun, onNewRun, onContinue, onGuide }: { wave: number; hasSavedRun: boolean; onNewRun: () => void; onContinue: () => void; onGuide: () => void }) {
  return <main className="home-screen"><div className="home-orb orb-one" /><div className="home-orb orb-two" /><section className="home-panel"><header className="home-brand"><span className="brand-mark">✦</span><div><strong>EMBERCHAIN</strong><span>FORGE TA SÉQUENCE</span></div></header><div className="home-art"><span className="home-art-glow" /><img src={heroAssetUrl} alt="Kael, dernier veilleur" /></div><div className="home-copy"><span className="overline">DECKBUILDER · AUTO-BATTLE</span><h1>Forge une chaîne.<br /><em>Brise la vague.</em></h1><p>Construis l’ordre parfait, puis regarde ta machine de combat s’embraser.</p></div><div className="home-actions"><button className="home-primary" onClick={onNewRun}><span>✦</span><strong>NEW RUN</strong><small>Commencer une nouvelle chaîne</small><b>→</b></button>{hasSavedRun && <button className="home-secondary" onClick={onContinue}><span>↻</span><strong>REPRENDRE LA RUN</strong><small>Vague {String(wave).padStart(2, "0")} · sauvegarde locale</small><b>→</b></button>}<button className="home-guide" onClick={onGuide}><span>◈</span><strong>GUIDE DU FORGERON</strong><b>?</b></button></div><footer><span>UNE MAIN · UNE DÉCISION À LA FOIS</span><span>V1 · LOCAL</span></footer></section></main>;
}

function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, () => loadRun() ?? createInitialRun());
  const [screen, setScreen] = useState<"menu" | "run">("menu");
  const [showGuide, setShowGuide] = useState(false);
  const [detailsCardUid, setDetailsCardUid] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ uid: string; x: number; y: number } | null>(null);
  const [fastMode, setFastMode] = useState(false);
  const [muted, setMuted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [showJournal, setShowJournal] = useState(false);
  const [systemReducedMotion] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const handRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<{ uid: string; pointerId: number; startX: number; startY: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef<{ uid: string; until: number } | null>(null);
  const playSound = useSound(!muted);
  const isCombat = combatPhases.includes(state.phase);
  const candidate = state.candidateCardId ? getCardDefinition(state.candidateCardId) : null;
  const detailsCard = detailsCardUid === "candidate" && candidate ? { uid: "candidate", cardId: candidate.id, level: 1 } : state.activeCards.find((card) => card.uid === detailsCardUid) ?? null;
  const activeCardUid = state.lastEvent?.cardUid;
  const motionReduced = reducedMotion || systemReducedMotion;

  useEffect(() => { if (!isCombat) return; const event = state.lastEvent; const delay = motionReduced ? 360 : fastMode ? (event?.type === "enemyWindup" ? 270 : 125) : (event?.type === "enemyWindup" ? 1500 : 560); const timer = window.setTimeout(() => dispatch({ type: "ADVANCE_COMBAT" }), delay); return () => window.clearTimeout(timer); }, [fastMode, isCombat, motionReduced, state.combatCursor, state.lastEvent]);
  useEffect(() => { const event = state.lastEvent; if (!event) return; if (event.type === "enemyWindup") playSound("windup"); else if (event.type === "enemyDefeated") playSound("victory"); else if (event.type === "heroDefeated") playSound("defeat"); else if (event.tags?.includes("critical")) playSound("crit"); else if (event.type === "damage") playSound("hit"); else if (event.type === "shield") playSound("shield"); else if (event.type === "heal") playSound("heal"); else if (event.type === "combo" || event.type === "sequenceLoop") playSound("combo"); else if (event.type === "cardPlayed") playSound("card"); }, [playSound, state.lastEvent]);
  useEffect(() => { if (!isCombat) localStorage.setItem("emberchain-run", serializeRun(state)); }, [isCombat, state]);

  const startNewRun = () => { localStorage.removeItem("emberchain-run"); dispatch({ type: "RESTART_RUN" }); setScreen("run"); setShowGuide(false); };
  const reorderCards = (fromUid: string, toUid: string | null) => { if (!toUid || fromUid === toUid || isCombat) return; const order = state.activeCards.map((card) => card.uid); const from = order.indexOf(fromUid); const to = order.indexOf(toUid); if (from < 0 || to < 0) return; order.splice(from, 1); order.splice(to, 0, fromUid); dispatch({ type: "REORDER_CARDS", order }); playSound("card"); };
  const hitTest = (x: number, y: number): string | null => { const slots = handRef.current ? Array.from(handRef.current.querySelectorAll<HTMLElement>("[data-card-uid]")) : []; const hit = slots.find((slot) => { const rect = slot.getBoundingClientRect(); return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom; }); return hit?.dataset.cardUid ?? null; };
  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>, uid: string) => { if (isCombat || state.phase === "cardChoice") return; suppressClickRef.current = null; event.currentTarget.setPointerCapture(event.pointerId); pointerRef.current = { uid, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false }; };
  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => { const pointer = pointerRef.current; if (!pointer || pointer.pointerId !== event.pointerId) return; pointer.moved = pointer.moved || Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > 8; if (pointer.moved) setDrag({ uid: pointer.uid, x: event.clientX, y: event.clientY }); };
  const onPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => { const pointer = pointerRef.current; if (!pointer || pointer.pointerId !== event.pointerId) return; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); if (pointer.moved) { suppressClickRef.current = { uid: pointer.uid, until: Date.now() + 400 }; reorderCards(pointer.uid, hitTest(event.clientX, event.clientY)); } pointerRef.current = null; setDrag(null); };
  const onPointerCancel = () => { pointerRef.current = null; setDrag(null); };

  if (screen === "menu") return <><HomeMenu wave={state.wave} hasSavedRun={state.wave > 1 || state.phase !== "planning"} onNewRun={startNewRun} onContinue={() => { setScreen("run"); setShowGuide(false); }} onGuide={() => setShowGuide(true)} />{showGuide && <GuideSheet onClose={() => setShowGuide(false)} />}</>;
  const handCount = Math.max(4, state.activeCards.length);
  return <main className={`game-screen ${motionReduced ? "reduced-motion" : ""} phase-${state.phase}`} style={{ "--forge-bg": `url(${forgeAssetUrl})` } as CSSProperties}><header className="game-topbar"><button className="topbar-button" onClick={() => setScreen("menu")} aria-label="Retour au menu">‹</button><div className="game-brand"><span className="brand-mark">✦</span><strong>EMBERCHAIN</strong></div><div className="topbar-actions"><button className="journal-button" onClick={() => setShowJournal(true)} aria-label="Ouvrir le journal de combat">JOURNAL</button><span className="essence">✧ {state.resources.essence}</span><button className="topbar-button" onClick={() => setMuted((value) => !value)} aria-label={muted ? "Activer le son" : "Couper le son"}>{muted ? "⌁" : "◖"}</button><button className={`topbar-button ${motionReduced ? "active" : ""}`} onClick={() => setReducedMotion((value) => !value)} aria-label="Réduire les mouvements">{motionReduced ? "◌" : "✺"}</button></div></header><div className="battle-board"><EnemyPanel enemy={state.currentEnemy} wave={state.wave} event={state.lastEvent} /><section className="impact-zone"><div className="impact-line"><span className="phase-pill">TOUR {state.round} · {phaseLabels[state.phase]}</span>{state.wave % 5 === 0 && <span className="boss-pill">BOSS</span>}</div><CombatVfx event={state.lastEvent} />{state.lastEvent && <div className="impact-message" key={state.lastEvent.id}><strong>{state.lastEvent.type === "enemyWindup" ? "RIPOSTE" : state.lastEvent.amount ?? "✦"}</strong><span>{state.lastEvent.message}</span></div>}<div className="impact-orbit"><i /><i /><i /></div>{(state.phase === "arranging" || state.phase === "planning") && <button className="play-button" onClick={() => { playSound("card"); dispatch({ type: "START_COMBAT" }); }}><span>JOUER</span><small>ATTAQUER · TOUR {state.round}</small><b>→</b></button>}</section><section className={`hand-panel ${state.activeCards.length > 4 ? "dense" : ""}`}><div className="hand-heading"><div><span className="overline">TA MAIN · {state.activeCards.length} / {state.hero.slots}</span><h2>{isCombat ? "La chaîne s’exécute" : state.round === 1 ? "Main de départ distribuée" : "Prépare ta chaîne"}</h2></div>{isCombat && <button className={`speed-toggle ${fastMode ? "active" : ""}`} onClick={() => setFastMode((value) => !value)} aria-label="Accélérer la résolution">{fastMode ? "2×" : "1×"}</button>}</div><BuildBadges cards={state.activeCards} /><div className="hand" ref={handRef} style={{ "--card-count": handCount } as CSSProperties}>{state.activeCards.map((card, index) => <SortableCard key={card.uid} card={card} index={index} locked={isCombat || state.phase === "cardChoice"} active={activeCardUid === card.uid} dragging={drag?.uid === card.uid} onTap={() => { const suppressed = suppressClickRef.current; if (suppressed?.uid === card.uid && suppressed.until >= Date.now()) { suppressClickRef.current = null; return; } suppressClickRef.current = null; setDetailsCardUid(card.uid); }} onDragStart={onPointerDown} onDragMove={onPointerMove} onDragEnd={onPointerUp} onDragCancel={onPointerCancel} />)}</div><p className="hand-hint">{isCombat ? "Les cartes jouent de gauche à droite, puis l’ennemi riposte" : "Touchez pour les détails · glissez pour réordonner"}</p>{isCombat && <CombatFeed events={state.eventLog} />}</section><HeroPanel hero={state.hero} event={state.lastEvent} /></div><div className="stage-effects"><div className="stars" /><div className="embers" /></div>{drag && <div className="drag-ghost" style={{ left: drag.x, top: drag.y }}><CardTile card={state.activeCards.find((card) => card.uid === drag.uid) ?? state.activeCards[0]} selected /></div>}{candidate && state.phase === "cardChoice" && <DrawSheet state={state} candidate={candidate} canFuse={state.activeCards.some((card) => card.cardId === candidate.id)} onDetails={() => setDetailsCardUid("candidate")} onJournal={() => setShowJournal(true)} onSkip={() => dispatch({ type: "SKIP_CARD" })} onChoose={(action, uid) => { playSound(action === "fuse" ? "combo" : "card"); dispatch({ type: "CHOOSE_CARD", action, targetUid: uid }); }} />}<ResultSheet state={state} onNextWave={() => dispatch({ type: "START_NEXT_WAVE" })} onRestart={startNewRun} onUpgrade={(id) => dispatch({ type: "CHOOSE_UPGRADE", id })} onJournal={() => setShowJournal(true)} />{detailsCard && <CardDetailSheet card={detailsCard} onClose={() => setDetailsCardUid(null)} />}{showGuide && <GuideSheet onClose={() => setShowGuide(false)} />}{showJournal && <JournalSheet events={state.eventLog} onClose={() => setShowJournal(false)} />}</main>;
}

export default App;
