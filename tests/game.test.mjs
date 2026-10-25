import assert from "node:assert/strict";
import test from "node:test";
import { streakDisplay } from "../src/lib/game.ts";

const days = (count) => `${count} days`;

test("streak labels stay empty-state copy until there is real attempt history", () => {
  assert.deepEqual(streakDisplay(0, 0, 0, days, "Never tried"), { current: "Never tried", best: "Never tried" });
  assert.deepEqual(streakDisplay(2, 1, 2, days, "Never tried"), { current: "1 days", best: "2 days" });
});
