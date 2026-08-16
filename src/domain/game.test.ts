import { describe, expect, it } from "vitest";
import { CARD_DEFINITIONS, createEnemy, createInitialRun, gameReducer, MAX_ACTIVE_SLOTS, RunState } from "./game";

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
    expect(finished.eventLog.filter((event) => event.tags?.includes("enemy-attack"))).toHaveLength(1);
    expect(finished.phase).toBe("cardChoice");
    expect(finished.round).toBe(2);
    expect(finished.candidateCardId).not.toBeNull();
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
});
