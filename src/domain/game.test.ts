import { describe, expect, it, vi } from "vitest";
import { CARD_DEFINITIONS, createEnemy, createInitialRun, gameReducer, getCardEffectLabel, getSequenceForecast, loadRun, MAX_ACTIVE_SLOTS, RunState } from "./game";

function advanceUntilStable(state: RunState) {
  let current = state;
  for (let i = 0; i < 80 && ["resolvingPlayerCards", "resolvingEnemyTurn"].includes(current.phase); i += 1) current = gameReducer(current, { type: "ADVANCE_COMBAT" });
  return current;
}

describe("Emberchain run loop", () => {
  it("deals four random cards before the first attack without drawing a candidate", () => {
    const run = createInitialRun();
    expect(run.phase).toBe("arranging");
    expect(run.round).toBe(1);
    expect(run.activeCards).toHaveLength(4);
    expect(run.candidateCardId).toBeNull();
    expect(run.activeCards.every((card) => CARD_DEFINITIONS.some((definition) => definition.id === card.cardId))).toBe(true);
  });

  it("resolves one player sequence, one enemy counterattack, then draws", () => {
    const run: RunState = { ...createInitialRun(), currentEnemy: { ...createEnemy(1), hp: 999, maxHp: 999, attack: 12 } };
    const finished = advanceUntilStable(gameReducer(run, { type: "START_COMBAT" }));
    expect(finished.eventLog.some((event) => event.type === "cardPlayed")).toBe(true);
    expect(finished.eventLog.some((event) => event.type === "enemyWindup")).toBe(true);
    expect(finished.eventLog.filter((event) => event.tags?.includes("enemy-attack"))).toHaveLength(1);
    expect(finished.phase).toBe("cardChoice");
    expect(finished.round).toBe(2);
    expect(finished.candidateCardId).not.toBeNull();
  });

  it("keeps the combat journal across multiple turns of the same wave", () => {
    let run: RunState = { ...createInitialRun(), hero: { ...createInitialRun().hero, hp: 1000, maxHp: 1000 }, currentEnemy: { ...createEnemy(1), hp: 999, maxHp: 999 } };
    run = advanceUntilStable(gameReducer(run, { type: "START_COMBAT" }));
    const firstJournalSize = run.eventLog.length;
    run = gameReducer(run, { type: "CHOOSE_CARD", action: "keep" });
    run = advanceUntilStable(gameReducer(run, { type: "START_COMBAT" }));
    expect(run.eventLog.length).toBeGreaterThan(firstJournalSize);
    expect(run.eventLog.filter((event) => event.type === "enemyWindup").length).toBeGreaterThanOrEqual(2);
  });

  it("replaces the exact selected card after a draw", () => {
    const base = createInitialRun();
    const target = base.activeCards[1];
    const run: RunState = { ...base, phase: "cardChoice", candidateCardId: "meteor" };
    const next = gameReducer(run, { type: "CHOOSE_CARD", action: "replace", targetUid: target.uid });
    expect(next.phase).toBe("arranging");
    expect(next.activeCards[1].cardId).toBe("meteor");
    expect(next.activeCards.some((card) => card.uid === target.uid)).toBe(false);
  });

  it("fuses an identical selected card and increases its level", () => {
    const base = createInitialRun();
    const target = base.activeCards[0];
    const run: RunState = { ...base, phase: "cardChoice", candidateCardId: target.cardId };
    const fused = gameReducer(run, { type: "CHOOSE_CARD", action: "fuse", targetUid: target.uid });
    expect(fused.phase).toBe("arranging");
    expect(fused.activeCards[0].level).toBe(2);
  });

  it("starts each new wave with the current hand and no preliminary draw", () => {
    const run = createInitialRun();
    const victory: RunState = { ...run, phase: "victory", reward: { xp: 36, essence: 3, cardName: "Victoire" } };
    const next = gameReducer(victory, { type: "START_NEXT_WAVE" });
    expect(next.wave).toBe(2);
    expect(next.round).toBe(1);
    expect(next.phase).toBe("arranging");
    expect(next.candidateCardId).toBeNull();
    expect(next.currentEnemy.maxHp).toBeGreaterThan(run.currentEnemy.maxHp);
  });

  it("caps the active sequence at six slots for the mobile layout", () => {
    let run: RunState = { ...createInitialRun(), phase: "levelUp", pendingUpgradeCount: 3, pendingUpgradeOptions: [] };
    for (let i = 0; i < 3; i += 1) run = gameReducer(run, { type: "CHOOSE_UPGRADE", id: "capacity" });
    expect(run.hero.slots).toBe(MAX_ACTIVE_SLOTS);
  });

  it("skips a candidate instead of hiding it in an inaccessible reserve", () => {
    const base = createInitialRun();
    const full: RunState = { ...base, phase: "cardChoice", candidateCardId: "meteor", activeCards: Array.from({ length: base.hero.slots }, (_, index) => ({ uid: `full-${index}`, cardId: "strike", level: 1 })) };
    const skipped = gameReducer(full, { type: "SKIP_CARD" });
    expect(skipped.phase).toBe("arranging");
    expect(skipped.candidateCardId).toBeNull();
  });

  it("contains the advanced content roster", () => {
    expect(new Set(CARD_DEFINITIONS.map((card) => card.id)).size).toBeGreaterThanOrEqual(20);
    const regularEnemies = [1, 2, 3, 4, 6, 11].map((wave) => createEnemy(wave).id);
    expect(new Set(regularEnemies).size).toBe(6);
    expect(createEnemy(5).kind).toBe("boss");
    expect(createEnemy(10).kind).toBe("boss");
    expect(createEnemy(5).id).not.toBe(createEnemy(10).id);
  });

  it("supports repeated attack, counterattack and draw turns through five waves", () => {
    const initial = createInitialRun();
    let run: RunState = {
      ...initial,
      hero: { ...initial.hero, hp: 1000, maxHp: 1000, attack: 80 },
      activeCards: [
        { uid: "brand", cardId: "ember-brand", level: 2 },
        { uid: "fire", cardId: "fireball", level: 2 },
        { uid: "rage", cardId: "rage", level: 2 },
        { uid: "slash", cardId: "double-slash", level: 2 },
      ],
    };
    for (let wave = 1; wave <= 5; wave += 1) {
      for (let turn = 0; turn < 12 && !["victory", "levelUp", "defeat"].includes(run.phase); turn += 1) {
        if (run.phase === "cardChoice") run = gameReducer(run, { type: "CHOOSE_CARD", action: "keep" });
        if (run.phase === "arranging") run = gameReducer(run, { type: "START_COMBAT" });
        run = advanceUntilStable(run);
      }
      expect(["victory", "levelUp"]).toContain(run.phase);
      while (run.phase === "levelUp") run = gameReducer(run, { type: "CHOOSE_UPGRADE", id: "might" });
      if (wave < 5) run = gameReducer(run, { type: "START_NEXT_WAVE" });
    }
    expect(run.wave).toBe(5);
    expect(run.reward?.xp).toBeGreaterThan(0);
  });

  it("keeps windup before enemy impact and snapshots combat state", () => {
    const base = createInitialRun();
    const finished = advanceUntilStable(gameReducer({ ...base, currentEnemy: { ...base.currentEnemy, hp: 999, maxHp: 999 } }, { type: "START_COMBAT" }));
    const windup = finished.eventLog.findIndex((event) => event.type === "enemyWindup");
    const impact = finished.eventLog.findIndex((event, index) => index > windup && event.tags?.includes("enemy-attack"));
    expect(windup).toBeGreaterThanOrEqual(0);
    expect(impact).toBeGreaterThan(windup);
    expect(finished.eventLog[windup].heroHpAfter).toBe(finished.eventLog[windup - 1].heroHpAfter);
    expect(finished.eventLog[impact].heroHpAfter).toBe(finished.eventLog[windup].heroHpAfter - (finished.eventLog[impact].amount ?? 0));
    expect(finished.eventLog.every((event) => Number.isFinite(event.heroHpAfter) && Number.isFinite(event.enemyHpAfter))).toBe(true);
  });

  it("describes berserker bonus on top of the real critical base", () => {
    expect(getCardEffectLabel("berserker-blade")).toContain("×1,8");
    expect(getCardEffectLabel("berserker-blade")).toContain("+30%");
    expect(getCardEffectLabel("fireball", 1)).toContain("brûlure 3");
    expect(getCardEffectLabel("burning-edge", 2)).toContain("brûlure 5");
    expect(getCardEffectLabel("rage", 2)).not.toContain("×1.32");
    expect(getCardEffectLabel("ember-brand", 2)).not.toContain("×1.32");
  });

  it("applies the berserker bonus to the real critical amount", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    try {
      const base = createInitialRun();
      const makeRun = (activeCards: RunState["activeCards"]): RunState => ({
        ...base,
        hero: { ...base.hero, hp: 1000, maxHp: 1000, attack: 20 },
        activeCards,
        currentEnemy: { ...createEnemy(1), hp: 999, maxHp: 999, defense: 0 },
      });
      const without = advanceUntilStable(gameReducer(makeRun([{ uid: "strike", cardId: "strike", level: 1 }]), { type: "START_COMBAT" }));
      const withBlade = advanceUntilStable(gameReducer(makeRun([{ uid: "blade", cardId: "berserker-blade", level: 1 }, { uid: "strike", cardId: "strike", level: 1 }]), { type: "START_COMBAT" }));
      const withoutAmount = without.eventLog.find((event) => event.sourceId === "strike" && event.type === "damage")?.amount;
      const withBladeAmount = withBlade.eventLog.find((event) => event.sourceId === "strike" && event.type === "damage")?.amount;
      expect(withoutAmount).toBe(Math.round((20 + 24) * 1.8));
      expect(withBladeAmount).toBe(Math.round((20 + 24) * 1.8 * 1.3));
    } finally {
      random.mockRestore();
    }
  });

  it("gives each enemy archetype a visible combat intention", () => {
    const intentions = [1, 2, 3, 4, 6, 11].map((wave) => createEnemy(wave).intent);
    expect(new Set(intentions).size).toBeGreaterThanOrEqual(5);
    expect(createEnemy(5).intent).toBe("boss");
    expect(createEnemy(2).intentLabel).toContain("Siphon");
  });

  it("unlocks mastery effects on upgraded cards", () => {
    expect(getCardEffectLabel("rage", 2)).toContain("70%");
    expect(getCardEffectLabel("double-slash", 3)).toContain("3 ×");
    expect(getCardEffectLabel("guard", 3)).toContain("soin");
  });

  it("previews the real order payoff and the enemy threat", () => {
    const base = createInitialRun();
    const run: RunState = {
      ...base,
      activeCards: [
        { uid: "mark", cardId: "ember-brand", level: 1 },
        { uid: "strike", cardId: "strike", level: 1 },
        { uid: "rage", cardId: "rage", level: 2 },
        { uid: "slash", cardId: "double-slash", level: 1 },
      ],
      currentEnemy: { ...createEnemy(1), hp: 999, maxHp: 999 },
    };
    const forecast = getSequenceForecast(run);
    expect(forecast.steps[0].link).toContain("Prépare");
    expect(forecast.steps[1].outcome).toContain("dégâts");
    expect(forecast.steps[1].link).toContain("Marque");
    expect(forecast.damageMax).toBeGreaterThanOrEqual(forecast.damageExpected);
    expect(forecast.incomingDamage).toBeGreaterThan(0);
  });

  it("calls out a preparation that survives the visible sequence", () => {
    const base = createInitialRun();
    const forecast = getSequenceForecast({ ...base, activeCards: [{ uid: "mark", cardId: "ember-brand", level: 1 }], currentEnemy: { ...createEnemy(1), hp: 999, maxHp: 999 } });
    expect(forecast.unspentPreparation).toContain("Marque prête");
  });

  it("includes defensive payoff in the forecast before the riposte", () => {
    const base = createInitialRun();
    const run: RunState = {
      ...base,
      hero: { ...base.hero, hp: 60, maxHp: 120 },
      activeCards: [{ uid: "guard", cardId: "guard", level: 1 }],
      currentEnemy: { ...createEnemy(1), hp: 999, maxHp: 999 },
    };
    const forecast = getSequenceForecast(run);
    expect(forecast.shield).toBeGreaterThan(0);
    expect(forecast.incomingDamage).toBeLessThan(run.currentEnemy.attack);
  });

  it("repairs a legacy save before it reaches the mobile UI", () => {
    const base = createInitialRun();
    vi.stubGlobal("localStorage", { getItem: () => JSON.stringify({ ...base, resources: undefined, candidateCardId: "missing", activeCards: [{ uid: "legacy", cardId: "strike", level: 99 }] }) });
    try {
      const loaded = loadRun();
      expect(loaded?.resources.essence).toBe(0);
      expect(loaded?.candidateCardId).toBeNull();
      expect(loaded?.activeCards[0].level).toBe(3);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
