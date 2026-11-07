import assert from "node:assert/strict";
import { test } from "node:test";
import { CLUB_ORDER, runDraw, sha256Hex, verifyDraw } from "./draw.ts";

const names = ["King Jery", "Ose Miles", "Ebenezer", "Scottie"];
const players = (count) => Array.from({ length: count }, (_, i) => ({
  id: i + 1,
  name: names[i] ?? `Player ${i + 1}`,
  position: i >= count - 6 && count >= 12 ? "GK" : "MID",
  rating: 9 - i / 20,
}));

test("fixed teammates stay together across seeds, roster sizes and input order", async () => {
  for (const count of [6, 12, 25, 48]) {
    for (let seed = 0; seed < 40; seed++) {
      const entrants = players(count);
      const draw = await runDraw(String(seed), entrants);
      const group = draw.picks.filter((pick) => pick.player.id <= 4);
      assert.equal(new Set(group.map((pick) => pick.club)).size, 1);
      assert.equal(new Set(draw.picks.map((pick) => pick.player.id)).size, count);
      assert.equal(draw.picks.length, count);
      for (const club of CLUB_ORDER) {
        assert.deepEqual(draw.squads[club], draw.picks.filter((pick) => pick.club === club).map((pick) => pick.player));
      }
      for (const pick of draw.picks) assert.equal(draw.rounds[pick.round].order[pick.slot], pick.club);
      if (count >= 24) {
        const sizes = Object.values(draw.squads).map((squad) => squad.length);
        assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
        if (count === 48) {
          for (const squad of Object.values(draw.squads)) assert.equal(squad.filter((p) => p.position === "GK").length, 1);
        }
      }
      assert.deepEqual(await runDraw(String(seed), [...entrants].reverse()), draw);
    }
  }
});

test("partial groups and normalized names stay together and verify", async () => {
  const entrants = players(24).filter((p) => p.id !== 3);
  entrants[0].name = " KING  JERY ";
  entrants[1].name = "ose-miles";
  const draw = await runDraw("partial", entrants);
  assert.equal(new Set(draw.picks.filter((p) => p.player.id <= 4).map((p) => p.club)).size, 1);
  const verified = await verifyDraw("partial", await sha256Hex("partial"), entrants, draw);
  assert.equal(verified.hashMatches, true);
  assert.equal(verified.picksMatch, true);
});

test("King Jerry and Scotty join Ose Miles and Ebenezer with either spelling", async () => {
  for (const king of ["King Jery", "King Jerry"]) {
    for (const scotty of ["Scottie", "Scotty"]) {
      const entrants = players(48);
      entrants[0].name = king;
      entrants[3].name = scotty;
      for (let seed = 0; seed < 40; seed++) {
        const draw = await runDraw(String(seed), entrants);
        assert.equal(new Set(draw.picks.filter((p) => p.player.id <= 4).map((p) => p.club)).size, 1);
      }
    }
  }
});

test("empty and unrelated rosters remain valid", async () => {
  assert.equal((await runDraw("empty", [])).picks.length, 0);
  const entrants = players(24).map((p) => ({ ...p, name: `Player ${p.id}` }));
  const draw = await runDraw("ordinary", entrants);
  for (const squad of Object.values(draw.squads)) assert.equal(squad.length, 4);
});
