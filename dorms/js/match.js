/** Pure matching rules. Distances are approximate walking minutes. */

export function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function walkMinutes(a, b, walk) {
  const factor = walk?.pathFactor ?? 1.3;
  const mpm = walk?.metersPerMinute ?? 80;
  return (haversineMeters(a, b) * factor) / mpm;
}

export function roundMinutes(value) {
  if (!Number.isFinite(value)) return null;
  return Math.max(1, Math.round(value));
}

export function termById(catalog, termId) {
  return catalog.terms.find((term) => term.id === termId) || null;
}

export function standingCategory(standing) {
  if (standing === "freshman") return "Freshman";
  if (standing === "transfer" || standing === "continuing") return "Undergraduate";
  if (standing === "graduate") return "Graduate";
  return "";
}

function anchorMap(catalog) {
  return new Map(catalog.anchors.map((anchor) => [anchor.id, anchor]));
}

export function selectedAnchors(catalog, goalIds) {
  const goals = catalog.goals.filter((goal) => goalIds.includes(goal.id));
  const map = anchorMap(catalog);
  const seen = new Set();
  const anchors = [];
  for (const goal of goals) {
    for (const id of goal.anchors) {
      if (seen.has(id)) continue;
      const anchor = map.get(id);
      if (!anchor) continue;
      seen.add(id);
      anchors.push({ ...anchor, goals: goals.filter((item) => item.anchors.includes(id)).map((item) => item.label) });
    }
  }
  return anchors;
}

export function scoreHall(hall, anchors, walk, added = null) {
  const distances = anchors.map((anchor) => ({
    id: anchor.id,
    name: anchor.name,
    minutes: walkMinutes(hall, anchor, walk),
  }));
  const average = distances.reduce((sum, item) => sum + item.minutes, 0) / distances.length;
  const nearest = distances.reduce((best, item) => (item.minutes < best.minutes ? item : best));
  return { hall, average, nearest, distances, added };
}

export function nearestHalls(catalog, anchors, limit = 15) {
  return catalog.halls
    .map((hall) => scoreHall(hall, anchors, catalog.walk))
    .sort((a, b) => a.average - b.average || a.hall.name.localeCompare(b.hall.name))
    .slice(0, limit);
}

function ratePeriod(term) {
  return term?.ratePeriod || "semester";
}

function termIncludesFall(termId) {
  return termId !== "ug-spring";
}

function gihHallIds(standing) {
  if (standing === "freshman") return ["birnkrant-residential-college"];
  if (standing === "transfer" || standing === "continuing") {
    return ["cardinal-gardens-2", "century", "usc-village-building-9"];
  }
  return [];
}

function fitsStanding(hall, app, term) {
  const tags = hall.audiences;
  if (app.standing === "freshman") {
    if (!tags.includes("freshman")) return "The interactive map does not list this as a freshman building.";
    if (tags.includes("honors") && !app.honors) {
      return "This is McCarthy Honors. The building page says it is for freshmen who hold a Mork Family, Stamps, Trustee, or Presidential scholarship.";
    }
    return "";
  }
  if (app.standing === "transfer" || app.standing === "continuing") {
    if (!tags.includes("continuing")) {
      return "On the interactive map's Non-Freshman list, this is not a usual choice for continuing or transfer undergraduates.";
    }
    return "";
  }
  if (app.standing === "graduate") {
    if (term?.id === "law") {
      return tags.includes("law") ? "" : "The Law Housing application page lists only Terrace Apartments and says it is for first-year Gould JD students.";
    }
    if (term?.id === "grad-ay") {
      return tags.includes("grad-ay") ? "" : "The application page does not list this building for the graduate academic-year term.";
    }
    if (term?.id === "grad-fy") {
      if (tags.includes("grad-fy")) return "";
      if (tags.includes("family") && app.family) return "";
      return "The application page does not list this building as ordinary graduate housing for the full-year term.";
    }
  }
  return "No term or class standing has been selected that can match this building.";
}

export function hallBlockers(hall, app, catalog, stage) {
  const reasons = [];
  const term = termById(catalog, app.term);
  if (stage === "lifestyle") {
    if (app.noise === "quiet" && hall.climate === "social") {
      reasons.push("You asked for a quiet building, and the published description presents this one as strongly community-oriented.");
    }
    if (app.noise === "social" && hall.climate === "independent") {
      reasons.push("You asked for a social building, and the published description emphasizes independence or quiet.");
    }
    return reasons;
  }

  if (hall.unavailableFall2026 && termIncludesFall(app.term)) {
    reasons.push("The building page says it is unavailable for summer and fall 2026 because of renovations.");
  }
  const standingReason = fitsStanding(hall, app, term);
  if (standingReason) reasons.push(standingReason);
  if (hall.audiences.includes("family") && !(app.family && app.standing === "graduate" && app.term === "grad-fy")) {
    reasons.push("The application page or the building page marks this as family housing. It stays only if you request Family Housing and choose the graduate full-year term.");
  }
  if (hall.audiences.includes("veteran") && app.llc !== "veteran") {
    reasons.push("The building page says ADX is for the veterans housing program. It is left out unless Veteran Housing is selected.");
  }
  if (hall.audiences.includes("female-grad") && app.gender !== "female") {
    reasons.push("The building page says Max Kade House is for female graduate students.");
  }
  if (!hall.audiences.length) {
    reasons.push("The building page has a description, but the 2026–2027 term lists and the interactive-map categories do not give a student group this demo can match automatically.");
  }
  if (app.gender === "gih") {
    if (app.standing === "graduate") {
      reasons.push("The published Gender-Inclusive Housing note says undergraduates may apply. It does not say graduate students may apply.");
    } else if (!gihHallIds(app.standing).includes(hall.id)) {
      reasons.push("This building is not one of the published Gender-Inclusive Housing locations.");
    }
  }
  if (app.roomType && !hall.forms.includes(app.roomType)) {
    reasons.push("The published floor plans do not include the room type you selected.");
  }
  if (app.rateMax != null && app.roomType) {
    const period = ratePeriod(term);
    const priced = hall.rooms.filter(
      (room) => room.form === app.roomType && room.period === period && room.rate != null && room.rate <= app.rateMax
    );
    if (!priced.length) {
      reasons.push("None of the published prices for your room type are within the rate cap you set.");
    }
  }
  if ((app.elevator === true || app.elevator === "yes") && hall.noElevator) {
    reasons.push("The building page says there is no elevator. Whether any other hall is accessible is an OSAS decision, and this demo does not guess.");
  }
  const dining = nearestOfKind(hall, catalog, "dining");
  if (dining && app.dining != null && dining.minutes > app.dining) {
    reasons.push(`The nearest residential dining hall is about ${roundMinutes(dining.minutes)} minutes away, past the ${app.dining}-minute limit you set.`);
  }
  const gate = nearestOfKind(hall, catalog, "gate");
  if (gate && app.gate != null && gate.minutes > app.gate) {
    reasons.push(`The nearest approximate campus entrance is about ${roundMinutes(gate.minutes)} minutes away, past the ${app.gate}-minute limit you set.`);
  }
  return reasons;
}

function nearestOfKind(hall, catalog, kind) {
  const walk = catalog.walk;
  const places = catalog.anchors.filter((anchor) => anchor.kind === kind);
  if (!places.length) return null;
  return places
    .map((anchor) => ({ ...anchor, minutes: walkMinutes(hall, anchor, walk) }))
    .reduce((best, item) => (item.minutes < best.minutes ? item : best));
}

export function splitByReasons(entries, app, catalog, stage) {
  const kept = [];
  const removed = [];
  for (const entry of entries) {
    const reasons = hallBlockers(entry.hall, app, catalog, stage);
    if (reasons.length) removed.push({ ...entry, reasons });
    else kept.push(entry);
  }
  return { kept, removed };
}

export function policyCandidates(catalog, app) {
  const ids = new Set();
  if (app.llc) {
    const llc = catalog.llcs.find((item) => item.id === app.llc);
    for (const id of llc?.buildings || []) ids.add(id);
  }
  if (app.gender === "gih") {
    for (const id of gihHallIds(app.standing)) ids.add(id);
  }
  if (app.term === "law") ids.add("terrace");
  return [...ids];
}

export function passesNonGeo(hall, app, catalog) {
  return hallBlockers(hall, app, catalog, "final").length === 0;
}

export function roommatePool(catalog, app) {
  const category = standingCategory(app.standing);
  return catalog.roommates
    .filter((roommate) => standingCategory(roommate.standing) === category)
    .filter((roommate) => {
      if (app.gender === "gih") return roommate.gih;
      if (roommate.gih) return false;
      return roommate.gender === app.gender;
    })
    .map((roommate) => ({ roommate, score: scoreRoommate(app, roommate), notes: matchNotes(app, roommate) }))
    .sort((a, b) => b.score - a.score || a.roommate.name.localeCompare(b.roommate.name));
}

function scoreRoommate(app, roommate) {
  let score = 0;
  for (const key of ["sleep", "clean", "study", "noise", "guests", "pets"]) {
    if (app[key] && app[key] === roommate[key]) score += key === "guests" || key === "pets" ? 1 : 2;
  }
  if (app.mbti && roommate.mbti && app.mbti.length === 4) {
    const left = app.mbti.toUpperCase();
    const right = roommate.mbti.toUpperCase();
    for (let i = 0; i < 4; i += 1) if (left[i] === right[i]) score += 1;
  }
  return score;
}

function matchNotes(app, roommate) {
  const notes = [];
  if (app.sleep && app.sleep === roommate.sleep) notes.push("Similar sleep schedule");
  if (app.clean && app.clean === roommate.clean) notes.push("Similar cleanliness");
  if (app.study && app.study === roommate.study) notes.push("Similar study location");
  if (app.noise && app.noise === roommate.noise) notes.push("Similar noise preference");
  if (app.guests && app.guests === roommate.guests) notes.push("Similar guest habits");
  if (app.pets && app.pets === roommate.pets) notes.push("Similar view on pets");
  if (app.mbti && roommate.mbti) {
    const shared = [...app.mbti.toUpperCase()].filter((letter, index) => letter === roommate.mbti[index]).length;
    notes.push(`MBTI shares ${shared} letters`);
  } else {
    notes.push("MBTI was not used; only the questionnaire was compared");
  }
  return notes;
}

export function priceRange(hall, roomType, period, rateMax = null) {
  const rates = hall.rooms
    .filter((room) => room.form === roomType && room.period === period && room.rate != null)
    .filter((room) => rateMax == null || room.rate <= rateMax)
    .map((room) => room.rate);
  if (!rates.length) return null;
  return { min: Math.min(...rates), max: Math.max(...rates), period };
}

export function describeHall(entry, app, catalog, kept) {
  const { hall } = entry;
  const term = termById(catalog, app.term);
  const prices = priceRange(hall, app.roomType, ratePeriod(term), app.rateMax);
  const pros = [];
  const cons = [];
  if (entry.nearest) {
    pros.push(
      `About ${roundMinutes(entry.average)} minutes on average to the places you chose. The closest is ${entry.nearest.name}, about ${roundMinutes(entry.nearest.minutes)} minutes.`
    );
  }
  if (prices) {
    const unit = prices.period === "month" ? "per month" : "per semester";
    pros.push(`It offers your room type. Published prices are $${prices.min.toLocaleString("en-US")}–$${prices.max.toLocaleString("en-US")} ${unit}.`);
  }
  pros.push(hall.summary);
  if (hall.gih && app.gender === "gih") pros.push("This is a published Gender-Inclusive Housing location.");
  if (app.llc && catalog.llcs.find((item) => item.id === app.llc)?.buildings.includes(hall.id)) {
    pros.push("This is the published location of the Living Learning Community you selected.");
  }
  const dining = nearestOfKind(hall, catalog, "dining");
  if (dining) pros.push(`The nearest residential dining hall is ${dining.name}, about a ${roundMinutes(dining.minutes)}-minute walk.`);
  if (hall.climateNote && hall.climate !== "mixed") pros.push(hall.climateNote);

  if (entry.added === "llc") cons.push("It was not in the 15 halls nearest your goals. It was added back because your community is located here, which matches the published process.");
  if (entry.added === "gih") cons.push("It was not in the 15 halls nearest your goals. Gender-Inclusive Housing is published for only a few buildings, so it was added to the list.");
  if (entry.added === "law") cons.push("It was not in the 15 halls nearest your goals. The Law Housing application page lists only this building.");
  if (hall.features.includes("community-bathroom")) cons.push("The building page describes community bathrooms, not a bathroom inside the suite.");
  if (hall.noElevator) cons.push("The building page says there is no elevator.");
  if (hall.meal === "full") cons.push("The building page says residents need a full meal plan.");
  if (hall.meal === "partial") cons.push("The building page mentions a partial meal plan.");
  if (hall.audiences.includes("honors")) cons.push("Only for first-year students with one of the honors scholarships named on the building page.");
  if (prices && app.rateMax != null && prices.max >= app.rateMax) {
    cons.push("A published price for this room type sits exactly at your rate cap.");
  }
  const closest = kept.reduce((best, item) => Math.min(best, item.average), Infinity);
  if (Number.isFinite(closest) && entry.average - closest >= 4) {
    cons.push(`The average walk is about ${roundMinutes(entry.average - closest)} minutes longer than the closest hall on this list.`);
  }
  if (!cons.length) cons.push("The published description does not add a more specific drawback. Distance and room type are still yours to weigh.");
  return { pros, cons, prices, dining };
}

export function money(value) {
  return `$${Number(value).toLocaleString("en-US")}`;
}
