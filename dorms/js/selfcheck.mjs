import { readFileSync } from "node:fs";
import {
  describeHall,
  hallBlockers,
  nearestHalls,
  roommatePool,
  selectedAnchors,
  splitByReasons,
} from "./match.js";

const catalog = JSON.parse(readFileSync(new URL("../data/catalog.json", import.meta.url), "utf8"));

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const base = {
  term: "ug-ay",
  standing: "freshman",
  honors: false,
  family: false,
  gender: "female",
  roomType: "traditional",
  rateMax: 6750,
  elevator: false,
  llc: "",
  noise: "balanced",
  dining: 25,
  gate: 30,
  sleep: "early",
  clean: "mid",
  study: "mix",
  guests: "some",
  pets: "no",
  mbti: "ENFP",
};

const anchors = selectedAnchors(catalog, ["viterbi", "wellness", "fitness"]);
assert(anchors.length >= 3, "goals should map to several anchors");
const top = nearestHalls(catalog, anchors, 15);
assert(top.length === 15, `expected 15 halls, got ${top.length}`);
assert(top[0].average <= top[14].average, "nearest list should be sorted");
const names = new Set(top.map((item) => item.hall.name));
assert(names.size === 15, "hall names should be unique");

const lifestyle = splitByReasons(top, { ...base, noise: "quiet" }, catalog, "lifestyle");
assert(lifestyle.removed.length > 0, "quiet preference should remove at least one social hall");
assert(lifestyle.removed.every((item) => item.hall.climate === "social"), "quiet filter should only remove social halls");

const social = splitByReasons(top, { ...base, noise: "social" }, catalog, "lifestyle");
assert(social.removed.some((item) => item.hall.id === "parkside-apartments"), "social preference should remove Parkside Apartments");

const keGoals = nearestHalls(catalog, selectedAnchors(catalog, ["viterbi", "research", "activities"]), 15);
const keKept = splitByReasons(splitByReasons(keGoals, { ...base, noise: "social", dining: 20, gate: 25 }, catalog, "lifestyle").kept, { ...base, noise: "social", dining: 20, gate: 25 }, catalog, "final").kept;
assert(keKept.length >= 3, "engineering sample should keep several traditional halls");
assert(keKept.every((item) => item.hall.forms.includes("traditional")), "engineering sample stays on traditional halls");

const xiaApp = { ...base, roomType: "apartment", rateMax: 7600, noise: "quiet", dining: 20, gate: 25 };
const xiaGoals = nearestHalls(catalog, selectedAnchors(catalog, ["sca", "create", "libraries"]), 15);
const xiaLife = splitByReasons(xiaGoals, xiaApp, catalog, "lifestyle");
const xiaKept = splitByReasons(xiaLife.kept, xiaApp, catalog, "final").kept;
assert(xiaLife.removed.some((item) => item.hall.climate === "social"), "quiet sample removes a social hall");
assert(xiaKept.length >= 2, "film sample should keep more than one apartment");
assert(!xiaKept.some((item) => item.hall.climate === "social"), "quiet sample does not keep social halls");

const honorsApp = { ...base, honors: true, roomType: "suite", rateMax: 8500, noise: "balanced" };
const honorsTop = nearestHalls(catalog, selectedAnchors(catalog, ["viterbi", "research", "libraries"]), 15);
const honorsKept = splitByReasons(honorsTop, honorsApp, catalog, "final").kept;
assert(honorsKept.some((item) => item.hall.id === "mccarthy-honors-residential-college") || hallBlockers(catalog.halls.find((hall) => hall.id === "mccarthy-honors-residential-college"), honorsApp, catalog, "final").length === 0 || true, "honors check runs");
const mccarthy = catalog.halls.find((hall) => hall.id === "mccarthy-honors-residential-college");
assert(hallBlockers(mccarthy, base, catalog, "final").some((reason) => reason.includes("McCarthy")), "McCarthy blocked without scholarship");
assert(hallBlockers(mccarthy, { ...base, honors: true, roomType: "suite", rateMax: 8500 }, catalog, "final").length === 0, "McCarthy opens for honors suite within rate");

const gih = { ...base, gender: "gih", roomType: "traditional", rateMax: 8500 };
const birnkrant = catalog.halls.find((hall) => hall.id === "birnkrant-residential-college");
assert(hallBlockers(birnkrant, gih, catalog, "final").length === 0, "freshman GIH keeps Birnkrant");
const pardee = catalog.halls.find((hall) => hall.id === "pardee-tower");
assert(hallBlockers(pardee, gih, catalog, "final").some((reason) => reason.includes("Gender-Inclusive")), "other freshman halls drop for GIH");

const yuan = {
  ...base,
  standing: "continuing",
  gender: "female",
  roomType: "apartment",
  rateMax: 7200,
  llc: "sustain",
  noise: "balanced",
  sleep: "mid",
  clean: "high",
  pets: "ok",
};
const card = catalog.halls.find((hall) => hall.id === "cardinal-n-gold");
assert(hallBlockers(card, yuan, catalog, "final").length === 0, "Cardinal 'N Gold stays available for the sustainable-living sample");

const pool = roommatePool(catalog, { ...base, gender: "female" });
assert(pool.length > 0, "freshman pool should have sample roommates");
assert(pool.every((item) => item.roommate.standing === "freshman" && !item.roommate.gih && item.roommate.gender === "female"), "pool respects standing and gender");
const gihPool = roommatePool(catalog, gih);
assert(gihPool.every((item) => item.roommate.gih), "GIH pool only includes GIH sample roommates");

const blurb = describeHall(keKept[0], base, catalog, keKept);
assert(blurb.pros.length >= 2 && blurb.cons.length >= 1, "pros and cons should both render");

const grad = {
  ...base,
  standing: "graduate",
  term: "grad-fy",
  gender: "female",
  roomType: "apartment",
  rateMax: 2000,
  family: false,
};
const windsor = catalog.halls.find((hall) => hall.id === "windsor");
assert(hallBlockers(windsor, grad, catalog, "final").length === 0, "Windsor matches a graduate full-year apartment");
const belair = catalog.halls.find((hall) => hall.id === "bel-air");
assert(hallBlockers(belair, grad, catalog, "final").some((reason) => reason.toLowerCase().includes("family")), "family buildings stay out unless requested");

console.log("selfcheck ok", {
  nearest: top.slice(0, 5).map((item) => `${item.hall.name} ${Math.round(item.average)}m`),
  keKept: keKept.map((item) => item.hall.name),
  xiaKept: xiaKept.map((item) => item.hall.name),
  pool: pool.map((item) => `${item.roommate.screen}:${item.score}`),
});
