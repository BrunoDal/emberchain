export type GamePhase =
  | "planning"
  | "cardChoice"
  | "arranging"
  | "resolvingPlayerCards"
  | "resolvingEnemyTurn"
  | "victory"
  | "levelUp"
  | "defeat";

export type CardKind = "temporary" | "equipment";
export type CardChoiceAction = "keep" | "replace" | "fuse";
export const MAX_ACTIVE_SLOTS = 6;

export interface CardDefinition {
  id: string;
  name: string;
  subtitle: string;
  kind: CardKind;
  icon: string;
  family: "fire" | "attack" | "defense" | "rage" | "equipment";
  description: string;
  tags: string[];
}

export interface OwnedCard {
  uid: string;
  cardId: string;
  level: number;
}

export interface HeroState {
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  crit: number;
  level: number;
  xp: number;
  nextXp: number;
  slots: number;
  shield: number;
  rage: number;
}

export interface EnemyState {
  id: string;
  name: string;
  kind: "goblin" | "cultist" | "golem" | "beast" | "witch" | "assassin" | "boss";
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  icon: string;
  title: string;
  burn: number;
  marked: boolean;
}

export type CombatEventType =
  | "cardPlayed"
  | "sequenceLoop"
  | "damage"
  | "heal"
  | "shield"
  | "statusApplied"
  | "enemyDefeated"
  | "heroDefeated"
  | "combo";

export interface CombatEvent {
  id: string;
  type: CombatEventType;
  sourceId?: string;
  targetId?: string;
  amount?: number;
  message: string;
  tags?: string[];
  cardUid?: string;
  heroHpAfter: number;
  enemyHpAfter: number;
  heroShieldAfter: number;
  enemyBurnAfter: number;
  enemyMarkedAfter: boolean;
  heroRageAfter: number;
}

interface CombatPlan {
  events: CombatEvent[];
  finalHero: HeroState;
  finalEnemy: EnemyState;
  victory: boolean;
  defeat: boolean;
  xpGained: number;
  essenceGained: number;
  consumedCardUids: string[];
}

export interface UpgradeChoice {
  id: "vitality" | "might" | "capacity";
  label: string;
  detail: string;
  icon: string;
}

export interface RewardState {
  xp: number;
  essence: number;
  cardName: string;
}

export interface RunState {
  saveVersion: number;
  phase: GamePhase;
  wave: number;
  round: number;
  hero: HeroState;
  activeCards: OwnedCard[];
  inventory: OwnedCard[];
  candidateCardId: string | null;
  currentEnemy: EnemyState;
  pendingUpgradeOptions: UpgradeChoice[];
  pendingUpgradeCount: number;
  combatPlan: CombatPlan | null;
  combatCursor: number;
  eventLog: CombatEvent[];
  lastEvent: CombatEvent | null;
  reward: RewardState | null;
  resources: { essence: number };
}

export type GameAction =
  | { type: "DRAW_CARD" }
  | { type: "CHOOSE_CARD"; action: CardChoiceAction; targetUid?: string }
  | { type: "REORDER_CARDS"; order: string[] }
  | { type: "START_COMBAT" }
  | { type: "ADVANCE_COMBAT" }
  | { type: "CHOOSE_UPGRADE"; id: UpgradeChoice["id"] }
  | { type: "START_NEXT_WAVE" }
  | { type: "RESTART_RUN" };

export const CARD_DEFINITIONS: CardDefinition[] = [
  { id: "ember-brand", name: "Marque braise", subtitle: "Préparation", kind: "temporary", icon: "✦", family: "fire", description: "Marque la cible. Les prochaines frappes gagnent +15 dégâts.", tags: ["fire", "mark"] },
  { id: "strike", name: "Frappe", subtitle: "Attaque directe", kind: "temporary", icon: "⚔", family: "attack", description: "Inflige de lourds dégâts physiques.", tags: ["attack"] },
  { id: "fireball", name: "Boule de feu", subtitle: "Dégâts + brûlure", kind: "temporary", icon: "☄", family: "fire", description: "Inflige des dégâts de feu et applique Brûlure.", tags: ["fire", "burn"] },
  { id: "guard", name: "Garde royale", subtitle: "Protection", kind: "temporary", icon: "◈", family: "defense", description: "Gagne un bouclier renforcé par la Défense.", tags: ["defense"] },
  { id: "rage", name: "Rage", subtitle: "Puissance", kind: "temporary", icon: "↗", family: "rage", description: "La prochaine attaque inflige 35% de dégâts supplémentaires.", tags: ["rage"] },
  { id: "double-slash", name: "Double entaille", subtitle: "Deux impacts", kind: "temporary", icon: "⚡", family: "attack", description: "Frappe deux fois. Idéale après une préparation.", tags: ["attack", "combo"] },
  { id: "mend", name: "Soin", subtitle: "Récupération", kind: "temporary", icon: "✚", family: "defense", description: "Récupère des PV immédiatement.", tags: ["heal"] },
  { id: "burning-edge", name: "Lame ardente", subtitle: "Feu continu", kind: "temporary", icon: "◒", family: "fire", description: "Inflige des dégâts et prolonge la brûlure.", tags: ["fire", "burn", "attack"] },
  { id: "berserker-blade", name: "Lame berserker", subtitle: "Équipement", kind: "equipment", icon: "♢", family: "equipment", description: "Les coups critiques infligent 30% de dégâts en plus.", tags: ["equipment", "crit"] },
  { id: "cinder-amulet", name: "Amulette de braise", subtitle: "Équipement", kind: "equipment", icon: "◉", family: "equipment", description: "Les cartes de feu infligent 20% de dégâts en plus.", tags: ["equipment", "fire"] },
  { id: "royal-aegis", name: "Égide royale", subtitle: "Équipement", kind: "equipment", icon: "⬡", family: "equipment", description: "Les boucliers sont 30% plus efficaces.", tags: ["equipment", "defense"] },
  { id: "crit-sigil", name: "Sceau critique", subtitle: "Équipement", kind: "equipment", icon: "✧", family: "equipment", description: "Augmente la chance de critique de 12 points.", tags: ["equipment", "crit"] },
  { id: "meteor", name: "Météore", subtitle: "Impact majeur", kind: "temporary", icon: "☄", family: "fire", description: "Un impact de feu massif qui applique une brûlure durable.", tags: ["fire", "burn", "spell"] },
  { id: "ember-surge", name: "Sursaut de braise", subtitle: "Feu en chaîne", kind: "temporary", icon: "✹", family: "fire", description: "Inflige plus de dégâts si la cible brûle déjà.", tags: ["fire", "burn", "combo"] },
  { id: "piercing-lunge", name: "Estoc perforant", subtitle: "Ignore l’armure", kind: "temporary", icon: "➶", family: "attack", description: "Une attaque qui traverse une partie de la Défense ennemie.", tags: ["attack", "piercing"] },
  { id: "execution", name: "Coup de grâce", subtitle: "Finisseur", kind: "temporary", icon: "⌁", family: "attack", description: "Inflige beaucoup plus de dégâts aux ennemis affaiblis.", tags: ["attack", "execute"] },
  { id: "flame-core", name: "Cœur incandescent", subtitle: "Équipement", kind: "equipment", icon: "◉", family: "equipment", description: "Les dégâts de feu sont encore augmentés.", tags: ["equipment", "fire"] },
  { id: "duelist-glove", name: "Gant duelliste", subtitle: "Équipement", kind: "equipment", icon: "♧", family: "equipment", description: "Augmente la chance de critique et la puissance des combos.", tags: ["equipment", "crit"] },
  { id: "fortress-heart", name: "Cœur forteresse", subtitle: "Équipement", kind: "equipment", icon: "⬢", family: "equipment", description: "Les boucliers absorbent encore plus de dégâts.", tags: ["equipment", "defense"] },
  { id: "blood-oath", name: "Serment de sang", subtitle: "Équipement", kind: "equipment", icon: "✤", family: "equipment", description: "Quand les PV sont bas, les attaques deviennent plus puissantes.", tags: ["equipment", "rage", "crit"] },
];

const cardMap = new Map(CARD_DEFINITIONS.map((card) => [card.id, card]));
export const getCardDefinition = (id: string) => cardMap.get(id) ?? CARD_DEFINITIONS[0];

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const owned = (cardId: string, level = 1): OwnedCard => ({ uid: uid(), cardId, level });

export function createEnemy(wave: number): EnemyState {
  const boss = wave % 5 === 0;
  const variants = [
    { id: "cinderling", name: "Gobelame", kind: "goblin" as const, icon: "👺", title: "Pillard des cendres", hp: 220, attack: 13, defense: 3 },
    { id: "ash-priest", name: "Prêtre cendré", kind: "cultist" as const, icon: "☠", title: "Adepte du brasier", hp: 260, attack: 16, defense: 5 },
    { id: "basalt-brute", name: "Brute basaltique", kind: "golem" as const, icon: "🗿", title: "Poids de la montagne", hp: 310, attack: 19, defense: 10 },
    { id: "night-hound", name: "Limier nocturne", kind: "beast" as const, icon: "🐺", title: "Chasseur sans lune", hp: 290, attack: 22, defense: 4 },
    { id: "mirror-witch", name: "Sorcière miroir", kind: "witch" as const, icon: "🪞", title: "Reflet de la faille", hp: 320, attack: 18, defense: 8 },
    { id: "iron-mantis", name: "Mante de fer", kind: "assassin" as const, icon: "🦂", title: "Lame mécanique", hp: 340, attack: 25, defense: 7 },
  ];
  const bosses = [
    { id: "ember-warden", name: "Gardien de braise", kind: "boss" as const, icon: "♜", title: "Boss de la forge oubliée", hp: 400, attack: 27, defense: 13 },
    { id: "flame-queen", name: "Reine des flammes", kind: "boss" as const, icon: "♛", title: "Souveraine du cratère", hp: 460, attack: 30, defense: 15 },
  ];
  const base = boss ? bosses[(Math.floor(wave / 5) - 1) % bosses.length] : variants[(wave - 1) % variants.length];
  const scale = 1 + Math.max(0, wave - 1) * 0.1;
  return { ...base, hp: Math.round(base.hp * scale), maxHp: Math.round(base.hp * scale), attack: Math.round(base.attack * (1 + (wave - 1) * 0.08)), defense: Math.round(base.defense * (1 + (wave - 1) * 0.06)), burn: 0, marked: false };
}

const initialHero = (): HeroState => ({ hp: 120, maxHp: 120, attack: 18, defense: 8, crit: 0.12, level: 1, xp: 0, nextXp: 70, slots: 4, shield: 0, rage: 0 });

function randomCandidate(wave: number) {
  const pool = wave % 3 === 0 ? ["fireball", "cinder-amulet", "burning-edge", "meteor", "ember-surge", "flame-core"] : ["strike", "double-slash", "ember-brand", "mend", "rage", "fireball", "royal-aegis", "crit-sigil", "berserker-blade", "piercing-lunge", "execution", "duelist-glove", "fortress-heart", "blood-oath"];
  return pool[Math.floor(Math.random() * pool.length)];
}

function randomInitialHand(): OwnedCard[] {
  const pools = [
    ["strike", "double-slash", "piercing-lunge"],
    ["ember-brand", "fireball", "burning-edge"],
    ["guard", "mend", "royal-aegis"],
    ["rage", "crit-sigil", "cinder-amulet", "berserker-blade"],
  ];
  return pools.map((pool) => owned(pool[Math.floor(Math.random() * pool.length)]));
}

export function createInitialRun(): RunState {
  return {
    saveVersion: 2,
    phase: "arranging",
    wave: 1,
    round: 1,
    hero: initialHero(),
    activeCards: randomInitialHand(),
    inventory: [],
    candidateCardId: null,
    currentEnemy: createEnemy(1),
    pendingUpgradeOptions: [],
    pendingUpgradeCount: 0,
    combatPlan: null,
    combatCursor: 0,
    eventLog: [],
    lastEvent: null,
    reward: null,
    resources: { essence: 0 },
  };
}

const upgradeOptions = (): UpgradeChoice[] => [
  { id: "vitality", label: "Cœur de braise", detail: "+24 PV maximum et récupère 24 PV", icon: "♥" },
  { id: "might", label: "Poigne ardente", detail: "+7 Attaque", icon: "⚔" },
  { id: "capacity", label: "Lien supplémentaire", detail: "+1 emplacement de carte", icon: "＋" },
];

function snapshot(event: Omit<CombatEvent, "heroHpAfter" | "enemyHpAfter" | "heroShieldAfter" | "enemyBurnAfter" | "enemyMarkedAfter" | "heroRageAfter">, hero: HeroState, enemy: EnemyState): CombatEvent {
  return { ...event, heroHpAfter: Math.max(0, Math.round(hero.hp)), enemyHpAfter: Math.max(0, Math.round(enemy.hp)), heroShieldAfter: Math.max(0, Math.round(hero.shield)), enemyBurnAfter: enemy.burn, enemyMarkedAfter: enemy.marked, heroRageAfter: hero.rage };
}

function buildCombatPlan(run: RunState): CombatPlan {
  const hero: HeroState = { ...run.hero, shield: 0, rage: 0 };
  const enemy: EnemyState = { ...run.currentEnemy };
  const events: CombatEvent[] = [];
  const consumed: string[] = [];
  const equipment = run.activeCards.filter((card) => getCardDefinition(card.cardId).kind === "equipment");
  const has = (id: string) => equipment.some((card) => card.cardId === id);
  const levelOf = (id: string) => equipment.filter((card) => card.cardId === id).reduce((sum, card) => sum + card.level, 0);
  const fireMultiplier = 1 + levelOf("cinder-amulet") * 0.2 + levelOf("flame-core") * 0.3;
  const shieldMultiplier = 1 + levelOf("royal-aegis") * 0.3 + levelOf("fortress-heart") * 0.5;
  const critChance = Math.min(0.8, hero.crit + levelOf("crit-sigil") * 0.12 + levelOf("duelist-glove") * 0.08);
  const combatId = () => `${events.length}-${Math.random().toString(36).slice(2, 5)}`;
  let combo = 0;

  const push = (event: Omit<CombatEvent, "id" | "heroHpAfter" | "enemyHpAfter" | "heroShieldAfter" | "enemyBurnAfter" | "enemyMarkedAfter" | "heroRageAfter">) => events.push(snapshot({ ...event, id: combatId() }, hero, enemy));
  const damageEnemy = (base: number, tags: string[], source: string, cardUid?: string) => {
    const fire = tags.includes("fire");
    const crit = Math.random() < critChance;
    const rageMultiplier = hero.rage > 0 ? 1.35 : 1;
    const bloodOathMultiplier = has("blood-oath") && hero.hp <= hero.maxHp * 0.5 ? 1.25 : 1;
    const defenseMultiplier = tags.includes("piercing") ? 0.05 : 0.35;
    const executeMultiplier = tags.includes("execute") && enemy.hp <= enemy.maxHp * 0.4 ? 1.7 : 1;
    const comboMultiplier = has("duelist-glove") && combo >= 2 ? 1.15 : 1;
    let amount = Math.max(1, Math.round((base * (fire ? fireMultiplier : 1) * rageMultiplier * bloodOathMultiplier * executeMultiplier * comboMultiplier) - enemy.defense * defenseMultiplier));
    if (crit) amount = Math.round(amount * (has("berserker-blade") ? 1.3 : 1.8));
    hero.rage = 0;
    enemy.hp -= amount;
    combo += 1;
    push({ type: "damage", sourceId: source, targetId: enemy.id, amount, message: `${crit ? "CRITIQUE · " : ""}${amount} dégâts`, tags: [...tags, ...(crit ? ["critical"] : []), ...(combo > 1 ? ["combo"] : [])], cardUid });
  };
  const healHero = (amount: number, source: string, cardUid?: string) => {
    const healed = Math.min(hero.maxHp - hero.hp, amount);
    hero.hp += healed;
    push({ type: "heal", sourceId: source, targetId: "hero", amount: healed, message: `+${healed} PV récupérés`, tags: ["heal"], cardUid });
  };
  const shieldHero = (amount: number, source: string, cardUid?: string) => {
    const value = Math.round(amount * shieldMultiplier);
    hero.shield += value;
    push({ type: "shield", sourceId: source, targetId: "hero", amount: value, message: `Bouclier +${value}`, tags: ["shield"], cardUid });
  };

  if (enemy.hp > 0 && hero.hp > 0) {
    for (const card of run.activeCards) {
      const definition = getCardDefinition(card.cardId);
      const power = 1 + (card.level - 1) * 0.32;
      if (definition.kind === "equipment") {
        push({ type: "cardPlayed", sourceId: card.cardId, message: `${definition.name} renforce la séquence`, tags: ["equipment"], cardUid: card.uid });
        continue;
      }
      consumed.push(card.uid);
      push({ type: "cardPlayed", sourceId: card.cardId, message: `${definition.icon} ${definition.name}`, tags: [definition.family], cardUid: card.uid });
      if (enemy.hp <= 0 || hero.hp <= 0) break;
      switch (card.cardId) {
        case "ember-brand":
          enemy.marked = true;
          push({ type: "statusApplied", sourceId: card.cardId, targetId: enemy.id, message: "La cible est marquée", tags: ["mark", "fire"], cardUid: card.uid });
          break;
        case "strike":
          damageEnemy((hero.attack + 24) * power + (enemy.marked ? 15 : 0), ["attack", ...(enemy.marked ? ["prepared"] : [])], card.cardId, card.uid);
          enemy.marked = false;
          break;
        case "fireball":
          damageEnemy((31 + hero.attack * 0.55) * power, ["fire", "spell"], card.cardId, card.uid);
          enemy.burn = Math.max(enemy.burn, 2 + card.level);
          push({ type: "statusApplied", sourceId: card.cardId, targetId: enemy.id, message: "Brûlure appliquée", tags: ["burn", "fire"], cardUid: card.uid });
          break;
        case "guard":
          shieldHero((25 + hero.defense * 1.5) * power, card.cardId, card.uid);
          break;
        case "rage":
          hero.rage = 1;
          push({ type: "statusApplied", sourceId: card.cardId, targetId: "hero", message: "La prochaine attaque est amplifiée", tags: ["rage"], cardUid: card.uid });
          break;
        case "double-slash":
          damageEnemy((hero.attack + 8) * power, ["attack", "combo"], card.cardId, card.uid);
          if (enemy.hp > 0) damageEnemy((hero.attack + 8) * power, ["attack", "combo"], card.cardId, card.uid);
          break;
        case "mend":
          healHero((27 + hero.defense) * power, card.cardId, card.uid);
          break;
        case "burning-edge":
          damageEnemy((hero.attack + 18) * power, ["attack", "fire"], card.cardId, card.uid);
          enemy.burn = Math.max(enemy.burn, 3 + card.level);
          push({ type: "statusApplied", sourceId: card.cardId, targetId: enemy.id, message: "La brûlure s’intensifie", tags: ["burn", "fire"], cardUid: card.uid });
          break;
        case "meteor":
          damageEnemy((53 + hero.attack * 0.8) * power, ["fire", "spell", "critical"], card.cardId, card.uid);
          enemy.burn = Math.max(enemy.burn, 3 + card.level);
          push({ type: "statusApplied", sourceId: card.cardId, targetId: enemy.id, message: "Le sol est en feu", tags: ["burn", "fire"], cardUid: card.uid });
          break;
        case "ember-surge":
          damageEnemy((24 + hero.attack * 0.45 + (enemy.burn > 0 ? 22 : 0)) * power, ["fire", "combo"], card.cardId, card.uid);
          enemy.burn = Math.max(enemy.burn, 2 + card.level);
          break;
        case "piercing-lunge":
          damageEnemy((hero.attack + 30) * power, ["attack", "piercing"], card.cardId, card.uid);
          break;
        case "execution":
          damageEnemy((hero.attack + 25) * power, ["attack", "execute"], card.cardId, card.uid);
          break;
      }
      if (combo >= 3 && events[events.length - 1]?.type === "damage") push({ type: "combo", sourceId: "hero", message: `COMBO x${combo}`, tags: ["combo"] });
    }

    if (enemy.hp > 0 && enemy.burn > 0 && hero.hp > 0) {
      const tick = 9 + enemy.burn * 3;
      enemy.hp -= tick;
      enemy.burn -= 1;
      push({ type: "damage", sourceId: "burn", targetId: enemy.id, amount: tick, message: `La brûlure inflige ${tick}`, tags: ["burn", "damage-over-time"] });
    }

    if (enemy.hp > 0 && hero.hp > 0) {
      const raw = Math.max(1, Math.round(enemy.attack - hero.defense * 0.45));
      const blocked = Math.min(hero.shield, raw);
      const amount = raw - blocked;
      hero.shield -= blocked;
      hero.hp -= amount;
      push({ type: "damage", sourceId: enemy.id, targetId: "hero", amount, message: blocked > 0 ? `${amount} dégâts · ${blocked} bloqués` : `${amount} dégâts reçus`, tags: ["enemy-attack", ...(blocked > 0 ? ["blocked"] : [])] });
    }
  }
  if (enemy.hp <= 0) push({ type: "enemyDefeated", targetId: enemy.id, message: "Vague vaincue", tags: ["victory"] });
  if (hero.hp <= 0) push({ type: "heroDefeated", targetId: "hero", message: "Le héros est tombé", tags: ["defeat"] });
  const victory = enemy.hp <= 0 && hero.hp > 0;
  const defeat = hero.hp <= 0;
  return { events, finalHero: { ...hero, hp: Math.max(0, hero.hp) }, finalEnemy: { ...enemy, hp: Math.max(0, enemy.hp) }, victory, defeat, xpGained: victory ? 28 + run.wave * 8 : 0, essenceGained: victory ? 2 + Math.ceil(run.wave / 2) : 0, consumedCardUids: consumed };
}

function afterStableState(state: RunState): RunState {
  return { ...state, combatPlan: null, combatCursor: 0, lastEvent: null };
}

export function gameReducer(state: RunState, action: GameAction): RunState {
  switch (action.type) {
    case "DRAW_CARD":
      return state.phase === "planning" ? { ...state, phase: "cardChoice", candidateCardId: randomCandidate(state.wave), reward: null } : state;
    case "CHOOSE_CARD": {
      if (state.phase !== "cardChoice" || !state.candidateCardId) return state;
      const candidate = owned(state.candidateCardId);
      if (action.action === "replace" && action.targetUid) {
        const targetIndex = state.activeCards.findIndex((card) => card.uid === action.targetUid);
        if (targetIndex < 0) return state;
        const activeCards = [...state.activeCards];
        activeCards[targetIndex] = candidate;
        return { ...state, activeCards, candidateCardId: null, phase: "arranging" };
      }
      if (action.action === "fuse" && action.targetUid) {
        const targetIndex = state.activeCards.findIndex((card) => card.uid === action.targetUid && card.cardId === candidate.cardId);
        if (targetIndex < 0) return state;
        const activeCards = [...state.activeCards];
        activeCards[targetIndex] = { ...activeCards[targetIndex], level: Math.min(3, activeCards[targetIndex].level + 1) };
        return { ...state, activeCards, candidateCardId: null, phase: "arranging" };
      }
      if (action.action === "keep") {
        const activeCards = state.activeCards.length < state.hero.slots ? [...state.activeCards, candidate] : state.activeCards;
        const inventory = state.activeCards.length < state.hero.slots ? state.inventory : [...state.inventory, candidate];
        return { ...state, activeCards, inventory, candidateCardId: null, phase: "arranging" };
      }
      return state;
    }
    case "REORDER_CARDS": {
      if (!["arranging", "cardChoice"].includes(state.phase)) return state;
      const byUid = new Map(state.activeCards.map((card) => [card.uid, card]));
      const activeCards = action.order.map((id) => byUid.get(id)).filter((card): card is OwnedCard => Boolean(card));
      return activeCards.length === state.activeCards.length ? { ...state, activeCards } : state;
    }
    case "START_COMBAT":
      if (state.phase !== "arranging" || state.activeCards.length === 0) return state;
      return { ...state, phase: "resolvingPlayerCards", combatPlan: buildCombatPlan(state), combatCursor: 0, eventLog: [], lastEvent: null };
    case "ADVANCE_COMBAT": {
      if (!state.combatPlan || !["resolvingPlayerCards", "resolvingEnemyTurn"].includes(state.phase)) return state;
      if (state.combatCursor < state.combatPlan.events.length) {
        const event = state.combatPlan.events[state.combatCursor];
        const eventLog = [...state.eventLog, event].slice(-18);
        return { ...state, combatCursor: state.combatCursor + 1, eventLog, lastEvent: event, phase: event.tags?.includes("enemy-attack") ? "resolvingEnemyTurn" : "resolvingPlayerCards" };
      }
      const plan = state.combatPlan;
      // Les cartes temporaires sont marquées comme jouées dans la résolution, puis
      // rechargées pour la vague suivante afin que la V1 conserve une boucle jouable
      // avec un seul tirage de carte par vague.
      const activeCards = state.activeCards;
      const hero = { ...plan.finalHero, xp: state.hero.xp + plan.xpGained };
      let pendingUpgradeCount = 0;
      let xp = hero.xp;
      let nextXp = hero.nextXp;
      while (xp >= nextXp) { xp -= nextXp; hero.level += 1; pendingUpgradeCount += 1; nextXp = Math.round(nextXp * 1.3); }
      hero.xp = xp;
      hero.nextXp = nextXp;
      const reward = plan.victory ? { xp: plan.xpGained, essence: plan.essenceGained, cardName: "Victoire" } : null;
      const nextPhase: GamePhase = plan.victory ? (pendingUpgradeCount ? "levelUp" : "victory") : plan.defeat ? "defeat" : "cardChoice";
      const next: RunState = { ...state, round: plan.victory || plan.defeat ? state.round : state.round + 1, hero, activeCards, currentEnemy: plan.finalEnemy, candidateCardId: plan.victory || plan.defeat ? null : randomCandidate(state.wave), reward, resources: { essence: state.resources.essence + plan.essenceGained }, pendingUpgradeCount, pendingUpgradeOptions: pendingUpgradeCount ? upgradeOptions() : [], phase: nextPhase };
      return afterStableState(next);
    }
    case "CHOOSE_UPGRADE": {
      if (state.phase !== "levelUp") return state;
      const hero = { ...state.hero };
      if (action.id === "vitality") { hero.maxHp += 24; hero.hp = Math.min(hero.maxHp, hero.hp + 24); }
      if (action.id === "might") hero.attack += 7;
      if (action.id === "capacity") hero.slots = Math.min(MAX_ACTIVE_SLOTS, hero.slots + 1);
      const count = state.pendingUpgradeCount - 1;
      return { ...state, hero, pendingUpgradeCount: count, pendingUpgradeOptions: count ? upgradeOptions() : [], phase: count ? "levelUp" : "victory" };
    }
    case "START_NEXT_WAVE":
      if (state.phase !== "victory") return state;
      return { ...state, wave: state.wave + 1, round: 1, hero: { ...state.hero, shield: 0, rage: 0 }, currentEnemy: createEnemy(state.wave + 1), candidateCardId: null, phase: "arranging", eventLog: [], reward: null };
    case "RESTART_RUN":
      return createInitialRun();
    default:
      return state;
  }
}

export function serializeRun(state: RunState): string {
  const safe = state.combatPlan ? { ...state, phase: "arranging" as const, combatPlan: null, combatCursor: 0, lastEvent: null, eventLog: [] } : state;
  return JSON.stringify(safe);
}

export function loadRun(): RunState | null {
  try {
    const raw = localStorage.getItem("emberchain-run");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RunState;
    if (!parsed?.hero || !parsed?.activeCards || !parsed?.currentEnemy) return null;
    return { ...parsed, saveVersion: 2, round: parsed.round ?? 1, combatPlan: null, combatCursor: 0, lastEvent: null, phase: ["cardChoice", "arranging", "victory", "levelUp", "defeat"].includes(parsed.phase) ? parsed.phase : "arranging" };
  } catch { return null; }
}
