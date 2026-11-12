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

test("permanent transfers survive seeds and reloads without moving other players", async () => {
  const entrants = players(48);
  entrants[4].name = " Obetayo ";
  entrants[5].name = "SHUBBY";
  entrants[6].name = "George";
  const destinations = new Map([[5, "sentinel"], [6, "coastal"], [7, "islanders"]]);
  for (let seed = 0; seed < 40; seed++) {
    const baseline = await runDraw(String(seed), players(48));
    const draw = await runDraw(String(seed), entrants);
    for (const pick of draw.picks) {
      assert.equal(pick.club, destinations.get(pick.player.id) ?? baseline.picks.find((p) => p.player.id === pick.player.id).club);
      assert.equal(draw.rounds[pick.round].order[pick.slot], pick.club);
      assert.ok(draw.squads[pick.club].some((p) => p.id === pick.player.id));
    }
    assert.equal(new Set(Object.values(draw.squads).flat().map((p) => p.id)).size, entrants.length);
    assert.deepEqual(await runDraw(String(seed), [...entrants].reverse()), draw);
    const verified = await verifyDraw(String(seed), await sha256Hex(String(seed)), entrants, draw);
    assert.equal(verified.picksMatch, true);
  }
});

test("post-draw changes reshape squads but leave the draw itself alone", async () => {
  const base = players(48).map((p, i) => ({ ...p, id: i + 100 }));
  base[10] = { ...base[10], id: 68, name: "Abbey |GF|", position: "GK" };
  base[11] = { ...base[11], id: 50, name: "Shubby", position: "FWD" };
  base[12] = { ...base[12], id: 65, name: "Gozie", position: "DEF" };
  const buchi = { id: 70, name: "Buchi", position: "DEF", rating: 6.5 };
  for (let seed = 0; seed < 20; seed++) {
    const without = await runDraw(String(seed), base);
    const draw = await runDraw(String(seed), [...base, buchi]);
    // Buchi never enters the pots, so the picks are the same.
    assert.deepEqual(draw.picks, without.picks);
    const all = Object.values(draw.squads).flat();
    assert.ok(!all.some((p) => p.id === 68));
    assert.ok(draw.squads.castellers.some((p) => p.id === 70));
    assert.ok(draw.squads.coastal.some((p) => p.id === 65));
    assert.equal(all.find((p) => p.id === 50).position, "GK");
    assert.equal(all.length, base.length);
  }
});
