import {
  describeHall,
  money,
  nearestHalls,
  passesNonGeo,
  policyCandidates,
  roommatePool,
  roundMinutes,
  scoreHall,
  selectedAnchors,
  splitByReasons,
  standingCategory,
  termById,
} from "./match.js";

const STEPS = [
  ["welcome", "Start"],
  ["profile", "Profile"],
  ["term", "Term and standing"],
  ["gender", "Gender and housing"],
  ["room", "Room and rate"],
  ["access", "Accessibility"],
  ["llc", "Learning communities"],
  ["goals", "Three goals"],
  ["lifestyle", "Habits"],
  ["refine", "Distance and eligibility"],
  ["roommate", "Roommates"],
  ["rank", "Pros, cons, and rank"],
  ["submit", "Review and submit"],
];

const HABIT_LABELS = {
  sleep: { early: "Early sleeper", mid: "In between", late: "Late sleeper" },
  clean: { high: "Very tidy", mid: "Average", low: "Relaxed about mess" },
  study: { room: "Mostly in the room", mix: "Room or library", library: "Mostly in a library" },
  noise: { quiet: "Prefer quiet", balanced: "Either is fine", social: "Prefer a social scene" },
  guests: { rare: "Rarely have guests", some: "Occasional guests", often: "Often have guests" },
  pets: { no: "Do not want a roommate with pets", ok: "Pets are fine", own: "I have an animal to explain" },
};

const appRoot = document.querySelector("#app");
let catalog = null;
let state = loadState();

appRoot.addEventListener("click", onClick);
appRoot.addEventListener("change", onField);
appRoot.addEventListener("input", onField);

init();

async function init() {
  catalog = await fetch("./data/catalog.json").then((response) => response.json());
  render();
}

function blankState() {
  return {
    step: "welcome",
    maxReached: 0,
    name: "",
    screen: "",
    category: "",
    emergencyName: "",
    emergencyPhone: "",
    term: "",
    standing: "",
    honors: false,
    family: false,
    gender: "",
    roomType: "",
    rateMax: null,
    rateChosen: false,
    osas: "",
    elevator: "",
    llc: "",
    career: "",
    life: "",
    interest: "",
    clean: "",
    noise: "",
    guests: "",
    study: "",
    sleep: "",
    pets: "",
    dining: null,
    diningChosen: false,
    gate: null,
    gateChosen: false,
    mbti: "",
    roommateMode: "",
    group: [],
    manualGroup: [],
    extras: {},
    ranking: [],
    supplement: "",
    feeAck: false,
    confirmation: "",
    error: "",
  };
}

function loadState() {
  try {
    const saved = JSON.parse(sessionStorage.getItem("usc-dorm-demo") || "null");
    return saved ? { ...blankState(), ...saved } : blankState();
  } catch {
    return blankState();
  }
}

function saveState() {
  try {
    sessionStorage.setItem("usc-dorm-demo", JSON.stringify(state));
  } catch {
    /* If the browser blocks storage, the demo can still be finished on this page. */
  }
}

function onField(event) {
  const field = event.target.dataset.field;
  if (!field) return;
  if (event.target.type === "checkbox") state[field] = event.target.checked;
  else state[field] = event.target.value;
  state.error = "";
  saveState();
  if (event.type === "change") render();
}

function onClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (action === "reset") {
    if (!confirm("Clear the demo progress stored in this browser?")) return;
    state = blankState();
    saveState();
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  state.error = "";
  if (action === "start-blank") {
    const step = state.step;
    state = { ...blankState(), step: "profile", maxReached: 1 };
  }
  if (action === "start-sample") applySample(button.dataset.id);
  if (action === "goto") go(button.dataset.step, false);
  if (action === "next") {
    const problem = validate(state.step);
    if (problem) state.error = problem;
    else go(nextStep(state.step), true);
  }
  if (action === "back") go(previousStep(state.step), false);
  if (action === "pick") {
    state[button.dataset.field] = button.dataset.value;
    if (button.dataset.field === "standing") {
      const allowed = termsFor(state.standing).some((term) => term.id === state.term);
      if (!allowed) state.term = "";
      state.llc = "";
      state.extras = {};
    }
    if (button.dataset.field === "term") state.extras = {};
  }
  if (action === "rate") {
    state.rateChosen = true;
    state.rateMax = button.dataset.value === "any" ? null : Number(button.dataset.value);
  }
  if (action === "limit") {
    const chosen = `${button.dataset.field}Chosen`;
    state[chosen] = true;
    state[button.dataset.field] = button.dataset.value === "any" ? null : Number(button.dataset.value);
  }
  if (action === "extra") state.extras = { ...state.extras, [button.dataset.id]: button.dataset.why };
  if (action === "drop-extra") {
    const extras = { ...state.extras };
    delete extras[button.dataset.id];
    state.extras = extras;
  }
  if (action === "move") moveRank(button.dataset.id, Number(button.dataset.dir));
  if (action === "mode") {
    state.roommateMode = button.dataset.value;
    if (button.dataset.value === "skip") {
      state.group = [];
      state.manualGroup = [];
    }
  }
  if (action === "invite") inviteRoommate(button.dataset.id);
  if (action === "remove-member") {
    state.group = state.group.filter((id) => id !== button.dataset.id);
    state.manualGroup = state.manualGroup.filter((person) => person.screen !== button.dataset.id);
  }
  if (action === "bind") bindRoommate();
  if (action === "submit") submitApplication();
  saveState();
  render();
  if (action === "next" || action === "back" || action === "goto" || action === "start-sample" || action === "start-blank") {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function applySample(id) {
  const sample = catalog.samples.find((item) => item.id === id);
  state = {
    ...blankState(),
    ...sample,
    step: "profile",
    maxReached: 1,
    rateChosen: true,
    diningChosen: true,
    gateChosen: true,
    osas: "no",
    elevator: "no",
    mbti: sample.id === "xia" ? "INFP" : sample.id === "yuan" ? "ENFP" : "ENTJ",
  };
}

function go(step, forward) {
  const index = STEPS.findIndex((item) => item[0] === step);
  if (index < 0) {
    state.step = step;
    return;
  }
  if (forward) state.maxReached = Math.max(state.maxReached, index);
  if (index <= state.maxReached || !forward) state.step = step;
}

function nextStep(step) {
  const index = STEPS.findIndex((item) => item[0] === step);
  return STEPS[Math.min(STEPS.length - 1, index + 1)][0];
}
function previousStep(step) {
  const index = STEPS.findIndex((item) => item[0] === step);
  return STEPS[Math.max(0, index - 1)][0];
}

function termsFor(standing) {
  if (!catalog) return [];
  return catalog.terms.filter((term) => term.who.includes(standing));
}

function goalsOf(group) {
  return catalog.goals.filter((goal) => goal.group === group);
}

function pipeline() {
  if (!state.career || !state.life || !state.interest) return null;
  const anchors = selectedAnchors(catalog, [state.career, state.life, state.interest]);
  const top = nearestHalls(catalog, anchors, 15);
  const life = splitByReasons(top, state, catalog, "lifestyle");
  const fin = splitByReasons(life.kept, state, catalog, "final");
  const choice = [...fin.kept];
  for (const [id, why] of Object.entries(state.extras)) {
    if (choice.some((entry) => entry.hall.id === id)) continue;
    const hall = catalog.halls.find((item) => item.id === id);
    if (!hall || !passesNonGeo(hall, state, catalog)) continue;
    choice.push(scoreHall(hall, anchors, catalog.walk, why));
  }
  choice.sort((a, b) => a.average - b.average || a.hall.name.localeCompare(b.hall.name));
  const ids = choice.map((entry) => entry.hall.id);
  state.ranking = state.ranking.filter((id) => ids.includes(id));
  for (const id of ids) if (!state.ranking.includes(id)) state.ranking.push(id);
  return { anchors, top, life, fin, choice };
}

function validate(step) {
  if (step === "profile") {
    if (!state.name.trim() || !state.screen.trim() || !state.category || !state.emergencyName.trim() || !state.emergencyPhone.trim()) {
      return "Enter your name, screen name, application category, and emergency contact.";
    }
    if (!/^[A-Za-z0-9]{3,16}$/.test(state.screen.trim())) return "Use 3 to 16 letters or numbers for the screen name.";
  }
  if (step === "term") {
    if (!state.standing || !state.term) return "Choose a class standing and a term.";
    if (state.standing === "graduate" && state.term === "law") {
      return "";
    }
  }
  if (step === "gender" && !state.gender) return "Choose a gender assignment or Gender-Inclusive Housing.";
  if (step === "room" && (!state.roomType || !state.rateChosen)) return "Choose a room type and a rate cap.";
  if (step === "access" && (!state.osas || !state.elevator)) return "Answer both accessibility questions.";
  if (step === "goals" && (!state.career || !state.life || !state.interest)) return "Choose all three goals.";
  if (step === "lifestyle" && (!state.clean || !state.noise || !state.guests || !state.study)) return "Answer all four habit questions.";
  if (step === "refine" && (!state.sleep || !state.pets || !state.diningChosen || !state.gateChosen)) return "Answer sleep, pets, dining distance, and campus-entrance distance.";
  if (step === "roommate" && !state.roommateMode) return "Skip roommates, open the pool, or bind a group.";
  if (step === "roommate" && state.roommateMode === "bind" && !groupMembers().length) return "The bind path needs at least one roommate.";
  if (step === "rank" && !pipeline()?.choice.length) return "There is no hall left to rank. Go back and loosen a filter, or add the community building back.";
  if (step === "rank" && llcMustLead()) return "When you request a Living Learning Community, the published process asks you to rank that building first.";
  return "";
}

function llcBuildings() {
  return catalog.llcs.find((item) => item.id === state.llc)?.buildings || [];
}

function llcMustLead() {
  const result = pipeline();
  if (!result || !state.llc) return false;
  const present = llcBuildings().filter((id) => result.choice.some((entry) => entry.hall.id === id));
  if (!present.length) return true;
  return !present.includes(state.ranking[0]);
}

function groupMembers() {
  const linked = state.group.map((id) => catalog.roommates.find((person) => person.id === id)).filter(Boolean);
  return [...linked, ...state.manualGroup];
}

function render() {
  if (!catalog) {
    appRoot.innerHTML = `<p class="panel">Loading housing data…</p>`;
    return;
  }
  const index = Math.max(0, STEPS.findIndex((item) => item[0] === state.step));
  const stepper = `<nav class="stepper" aria-label="Application steps">${STEPS.map(([id, label], itemIndex) => {
    const enabled = itemIndex <= state.maxReached && itemIndex !== index;
    return `<button type="button" data-action="goto" data-step="${id}" ${enabled ? "" : "disabled"} ${itemIndex === index ? 'aria-current="step"' : ""}>${itemIndex + 1}. ${label}</button>`;
  }).join("")}</nav>`;
  const reset = `<button type="button" class="text-button reset" id="reset-app" data-action="reset">Start over</button>`;
  const steps = `<div class="step-row">${state.step === "done" ? "" : stepper}${reset}</div>`;
  const body = {
    welcome: renderWelcome,
    profile: renderProfile,
    term: renderTerm,
    gender: renderGender,
    room: renderRoom,
    access: renderAccess,
    llc: renderLlc,
    goals: renderGoals,
    lifestyle: renderLifestyle,
    refine: renderRefine,
    roommate: renderRoommate,
    rank: renderRank,
    submit: renderSubmit,
    done: renderDone,
  }[state.step]();
  appRoot.innerHTML = `${steps}${body}`;
}

function shell(title, lede, inner, actions) {
  return `<section class="panel"><h2>${title}</h2>${lede ? `<p class="lede">${lede}</p>` : ""}${inner}${state.error ? `<p class="error">${esc(state.error)}</p>` : ""}${actions || nav()}</section>`;
}
function nav(extra = "") {
  const showBack = state.step !== "welcome" && state.step !== "profile" && state.step !== "done";
  return `<div class="actions">${showBack ? `<button type="button" class="button secondary" data-action="back">Back</button>` : ""}${extra}<button type="button" class="button" data-action="next">Continue</button></div>`;
}

function renderWelcome() {
  const samples = catalog.samples.map((sample) => `<article class="choice"><strong>${esc(sample.name)}</strong><span>${esc(sample.blurb)}</span><span>Screen name ${esc(sample.screen)}</span><div class="actions"><button type="button" class="button" data-action="start-sample" data-id="${sample.id}">Use this sample</button></div></article>`).join("");
  return shell(
    "Follow the USC Housing sequence, with building choice replaced by matching.",
    "This demo lets a student walk through the flow. Profile, term, class standing, gender or Gender-Inclusive Housing, room type, rate, accessibility, learning communities, roommates, and submit are all still here. Instead of picking five buildings by hand, the app keeps the 15 nearest halls for three goals and then filters them.",
    `<div class="banner">The data comes from public USC Housing pages. Coordinates and walking times are approximate. The real application, roommate request, and $65 fee happen in the portal at housing.usc.edu.</div><div class="grid three">${samples}</div>`,
    `<div class="actions"><button type="button" class="button secondary" data-action="start-blank">Start from a blank profile</button></div>`
  );
}

function renderProfile() {
  return shell(
    "Personal and contact details",
    "This step follows Personal and Contact Details on the application page, plus the screen name used for roommate matching. Portal login and the 10-digit student ID are not part of this demo.",
    `<div class="grid two">
      ${field("Name", "name", state.name)}
      ${field("Screen name", "screen", state.screen, "for example tommy")}
      <label>Application category<select data-field="category">${selectOptions([["", "Choose one"], ["new", "New to USC"], ["continuing-nonres", "Continuing Non-resident Student"]], state.category)}</select></label>
      ${field("Emergency contact", "emergencyName", state.emergencyName)}
      ${field("Emergency contact phone", "emergencyPhone", state.emergencyPhone)}
    </div>`
  );
}

function renderTerm() {
  const standings = [
    ["freshman", "First-year", "Freshman. Matching uses the Freshman category on the interactive map."],
    ["transfer", "Transfer student", "The public pages do not publish a separate transfer building list. This demo uses the Non-Freshman category and labels that as a simplification."],
    ["continuing", "Continuing undergraduate, not currently in university housing", "This matches who a Continuing Non-resident can apply as. It is not University Housing Renewal for students who already live on campus."],
    ["graduate", "Graduate student", "Terms and buildings follow the graduate contracts listed on the application page."],
  ];
  const terms = termsFor(state.standing).map((term) => choiceButton("term", term.id, term.label, term.dates, state.term));
  return shell(
    "Term and class standing",
    "The application starts by choosing a term. The dates and contract names below are from the USC Housing 2026–2027 application instructions.",
    `${choiceGrid(standings.map(([id, title, note]) => choiceButton("standing", id, title, note, state.standing)))}
    ${state.standing === "freshman" ? `<label class="check"><input type="checkbox" data-field="honors" ${state.honors ? "checked" : ""}/>I hold a Mork Family, Stamps, Trustee, or Presidential scholarship, as named on the McCarthy Honors building page.</label>` : ""}
    ${state.standing === "graduate" ? `<label class="check"><input type="checkbox" data-field="family" ${state.family ? "checked" : ""}/>I want to apply for Family Housing. The application page marks Bel-Air, Regal Trojan, Regent, and Sunset as family buildings and places them in the graduate full-year term.</label>` : ""}
    <h3>Term</h3>
    ${state.standing ? `<div class="grid two">${terms.join("") || "<p>No published term matches this class standing.</p>"}</div>` : `<p class="meta">Choose a class standing first. The terms for that standing appear next.</p>`}
    ${state.term === "law" ? `<p class="banner">The Law Housing application page says it is only for first-year JD students at the Gould School of Law, and only in Terrace Apartments. This demo does not check whether you are a first-year JD student.</p>` : ""}`
  );
}

function renderGender() {
  return shell(
    "Gender and Gender-Inclusive Housing",
    `The published note is that residence halls usually separate genders by floor or unit, and that Gender-Inclusive Housing is assigned only when a student requests it. ${state.standing === "graduate" ? "The FAQ says undergraduates may apply. If a graduate student selects it, the hall list is cleared." : ""}`,
    `<div class="grid three">
      ${choiceButton("gender", "female", "Female", "Use the current gender-separated assignment.", state.gender)}
      ${choiceButton("gender", "male", "Male", "Use the current gender-separated assignment.", state.gender)}
      ${choiceButton("gender", "gih", "Gender-Inclusive Housing", "Voluntary. First-year rooms are in Birnkrant. Continuing undergraduates use Cardinal Gardens, Century, and Cowlings and Ilium.", state.gender)}
    </div>`
  );
}

function renderRoom() {
  const term = termById(catalog, state.term);
  const monthly = term?.ratePeriod === "month";
  const rates = monthly
    ? [["1300", "Up to $1,300 / month"], ["1730", "Up to $1,730 / month"], ["2000", "Up to $2,000 / month"], ["any", "No cap"]]
    : [["6000", "Up to $6,000 / semester"], ["6750", "Up to $6,750 / semester"], ["8500", "Up to $8,500 / semester"], ["any", "No cap"]];
  const selectedRate = !state.rateChosen ? "" : state.rateMax == null ? "any" : String(state.rateMax);
  return shell(
    "Room type and rate",
    monthly
      ? "Graduate building pages list prices per month. Those prices are not compared with undergraduate semester prices. This step uses only the pricing period for your term."
      : "Undergraduate building pages list 2026–2027 prices per person per semester. Meal plans are not included in that rent.",
    `<div class="grid three">
      ${choiceButton("roomType", "traditional", "Traditional hall", "Single, double, or triple, often with a community bathroom.", state.roomType)}
      ${choiceButton("roomType", "suite", "Suite", "For example the suites published for McCarthy and the Parkside residential colleges.", state.roomType)}
      ${choiceButton("roomType", "apartment", "Apartment", "Studio, one-bedroom, or two-bedroom, usually with a kitchen.", state.roomType)}
    </div>
    <h3>Rate cap</h3>
    <div class="grid two">${rates.map(([value, label]) => `<button type="button" class="choice" data-action="rate" data-value="${value}" aria-pressed="${selectedRate === value}">${label}</button>`).join("")}</div>`
  );
}

function renderAccess() {
  return shell(
    "Accessibility",
    "This follows Specific Accommodation Request. The public page says you must register with the Office of Student Accessibility Services first. Placement depends on the OSAS recommendation and on space, and it is not guaranteed. There is no published list of accessible halls, so this demo does not drop halls by guessing.",
    `<div class="grid two">
      ${choiceButton("osas", "yes", "I need a housing accommodation", "A real application requires OSAS registration first.", state.osas)}
      ${choiceButton("osas", "no", "I am not requesting an accommodation", "You can still change this in the official portal.", state.osas)}
      ${choiceButton("elevator", "yes", "I need an elevator", "Only Fairmont and La Sorbonne are removed, because their pages say they have no elevator.", state.elevator)}
      ${choiceButton("elevator", "no", "I do not need an elevator", "OSAS still decides whether the other halls are accessible.", state.elevator)}
    </div>`
  );
}

function renderLlc() {
  const choices = catalog.llcs.filter((item) => item.standings.includes(state.standing));
  return shell(
    "Living Learning Community",
    "Undergraduates can request a community on the application. The published process asks you to list that building as your first choice. Some communities also ask for a short supplemental answer. Graduate terms are already limited by building, so this demo does not invent extra graduate programs.",
    `<div class="grid two">
      ${choiceButton("llc", "", "No community", "Continue with goal matching.", state.llc)}
      ${choices.map((item) => choiceButton("llc", item.id, item.name, item.note, state.llc)).join("")}
    </div>
    <p class="meta">The LGBTQ+ Student Center still describes Rainbow Community separately, in Birnkrant and Century. The Housing community table does not list that name, so this demo does not offer it as an official community.</p>`
  );
}

function renderGoals() {
  const result = pipeline();
  const map = result ? mapHtml(result.top.map((entry) => ({ ...entry.hall, kind: "hall", label: entry.hall.code })), result.anchors.map((anchor) => ({ ...anchor, kind: "anchor", label: anchor.name }))) : "";
  const list = result ? result.top.map((entry, index) => hallLine(entry, index, `${roundMinutes(entry.average)} min`)).join("") : "";
  return shell(
    "Three goals, then the 15 nearest halls",
    "Choose one career goal, one life goal, and one interest. Each one maps to academic buildings, libraries, or activity centers a student with that goal would commonly use. The 15 halls are ranked by average walking time to those places. Walking time is straight-line distance times 1.3, at 80 meters per minute.",
    `<div class="grid three">
      ${goalSelect("Career goal", "career", "career")}
      ${goalSelect("Life goal", "life", "life")}
      ${goalSelect("Interest", "interest", "interest")}
    </div>
    ${result ? `<h3>Places that drove this match</h3><p>${result.anchors.map((anchor) => `<span class="tag gold">${esc(anchor.name)}</span>`).join("")}</p>${map}<p class="meta">Red dots are residence halls. Gold dots are the places above. Positions come from the Housing interactive map or the Census Bureau geocoder. This is not a survey map.</p><div class="cards">${list}</div>` : ""}`
  );
}

function renderLifestyle() {
  const result = pipeline();
  const removed = result?.life.removed || [];
  const kept = result?.life.kept || [];
  return shell(
    "Narrow the 15 halls by habits",
    "USC's published Profile asks about study habits, sleep, cleanliness, and what you do in your spare time. Cleanliness, guests, and where you study are compared later with roommates. Only the quiet-or-social answer removes halls, and only when a building page itself describes a strong community or a quiet, independent setting.",
    `${habitGrid("clean", "Cleanliness", "clean")}
    ${habitGrid("noise", "Quiet or social", "noise")}
    ${habitGrid("guests", "Guests", "guests")}
    ${habitGrid("study", "Where you study", "study")}
    ${result && state.noise ? `<p class="banner">${kept.length} of the 15 halls remain. ${removed.length} were removed.</p>${removedList(removed)}<div class="cards">${kept.map((entry, index) => hallLine(entry, index, entry.hall.climateNote)).join("")}</div>` : ""}`
  );
}

function renderRefine() {
  const result = pipeline();
  const diningChoices = [["8", "Within 8 minutes"], ["12", "Within 12 minutes"], ["20", "Within 20 minutes"], ["any", "No limit"]];
  const gateChoices = [["10", "Within 10 minutes"], ["15", "Within 15 minutes"], ["25", "Within 25 minutes"], ["any", "No limit"]];
  const extras = policyExtras(result);
  return shell(
    "Sleep, pets, dining, gates, and the other USC filters",
    "Sleep and pets are compared with roommates. The public site does not publish those differences by hall, so those two answers do not remove halls. Distance to dining and to campus entrances does. Gender or Gender-Inclusive Housing, class standing, room type, rate, and a building page that says there is no elevator also apply here.",
    `${habitGrid("sleep", "Sleep", "sleep")}
    ${habitGrid("pets", "Pets", "pets")}
    <h3>Distance to residential dining</h3>
    <p class="meta">The three halls are Everybody's Kitchen, Parkside Residential Dining Hall, and USC Village Dining Hall. The last two use the map center of the building group, not a measured doorway.</p>
    <div class="grid two">${diningChoices.map(([value, label]) => limitButton("dining", value, label)).join("")}</div>
    <h3>Distance to a campus entrance</h3>
    <p class="meta">Entrances are approximated by six intersections on Jefferson, Exposition, Vermont, Figueroa, and 34th Street. They are not published gate locations.</p>
    <div class="grid two">${gateChoices.map(([value, label]) => limitButton("gate", value, label)).join("")}</div>
    ${result && state.sleep ? renderRefineResult(result, extras) : ""}`
  );
}

function renderRefineResult(result, extras) {
  const choiceIds = new Set(result.choice.map((entry) => entry.hall.id));
  return `<p class="banner">${result.life.kept.length} halls remained after habits. Eligibility and distance leave ${result.fin.kept.length}${Object.keys(state.extras).length ? `, plus ${result.choice.length - result.fin.kept.length} added back` : ""}.</p>
  ${extras.map((item) => `<p class="banner">${esc(item.note)} <button type="button" class="tiny" data-action="extra" data-id="${item.id}" data-why="${item.why}">Add ${esc(item.name)} back</button></p>`).join("")}
  ${removedList(result.fin.removed)}
  <div class="cards">${result.choice.map((entry, index) => hallLine(entry, index, entry.added ? "Added back for the published process" : "Passed the filters")).join("")}</div>
  ${[...choiceIds].filter((id) => state.extras[id]).map((id) => `<button type="button" class="tiny" data-action="drop-extra" data-id="${id}">Remove added ${esc(catalog.halls.find((hall) => hall.id === id).name)}</button>`).join(" ")}`;
}

function policyExtras(result) {
  if (!result) return [];
  const present = new Set(result.choice.map((entry) => entry.hall.id));
  return policyCandidates(catalog, state)
    .filter((id) => !present.has(id))
    .map((id) => {
      const hall = catalog.halls.find((item) => item.id === id);
      const reasons = passesNonGeo(hall, state, catalog) ? [] : ["It does not pass the room type, rate, or class standing you already chose, so it cannot be added back directly."];
      let why = "llc";
      let note = `${hall.name} is the published location of your community, but it is not on the filtered list.`;
      if (state.gender === "gih" && ["birnkrant-residential-college", "cardinal-gardens-2", "century", "usc-village-building-9"].includes(id)) {
        why = "gih";
        note = `${hall.name} is a published Gender-Inclusive Housing location, but it is not in the current distance results.`;
      }
      if (id === "terrace" && state.term === "law") {
        why = "law";
        note = "Law Housing publishes only Terrace Apartments.";
      }
      return reasons.length ? { id, name: hall.name, why, note: `${note} ${reasons[0]}` } : { id, name: hall.name, why, note };
    });
}

function renderRoommate() {
  const pool = roommatePool(catalog, { ...state, mbti: state.mbti });
  const members = groupMembers();
  return shell(
    "Roommate group",
    "If you already want to live with someone, create a group and skip the pool. Otherwise you can look at the sample pool. USC matches on the Profile, not on MBTI. MBTI is an extra in this demo. A request has to be in the same class-standing category, list the same housing choices, and be mutual. The official process does not guarantee it.",
    `<div class="grid three">
      ${choiceButton("mode", "skip", "Skip choosing a roommate", "Assignment can use gender, building, and the Profile later.", state.roommateMode, "mode")}
      ${choiceButton("mode", "pool", "Enter the roommate pool", "See sample matches from the questionnaire and optional MBTI.", state.roommateMode, "mode")}
      ${choiceButton("mode", "bind", "Bind an existing group", "Enter a screen name or the code MAYA-YUAN.", state.roommateMode, "mode")}
    </div>
    ${state.roommateMode === "pool" ? renderPool(pool) : ""}
    ${state.roommateMode === "bind" ? renderBind(members) : ""}
    ${members.length && state.roommateMode !== "skip" ? memberList(members) : ""}`
  );
}

function renderPool(pool) {
  const types = ["INTJ", "INTP", "ENTJ", "ENTP", "INFJ", "INFP", "ENFJ", "ENFP", "ISTJ", "ISFJ", "ESTJ", "ESFJ", "ISTP", "ISFP", "ESTP", "ESFP"];
  return `<label>MBTI, optional<select data-field="mbti"><option value="">Skip for now</option>${types.map((type) => `<option ${state.mbti === type ? "selected" : ""}>${type}</option>`).join("")}</select></label>
  <p class="meta">The sample pool shows only people in your class-standing category. Gender-separated applications also match gender. Gender-Inclusive Housing is compared only with sample roommates who also requested it. Your category is ${esc(standingCategory(state.standing) || "not selected")}.</p>
  <div class="cards">${pool.length ? pool.map(({ roommate, score, notes }) => `<article class="person"><header><div><strong>${esc(roommate.name)}</strong><p class="meta">Screen name ${esc(roommate.screen)} · ${esc(roommate.mbti)} · overlap ${score}</p></div><button type="button" class="tiny" data-action="invite" data-id="${roommate.id}">Invite to group</button></header><p>${esc(roommate.blurb)}</p><p class="meta">${esc(notes.join("; "))}</p></article>`).join("") : "<p>No sample roommate matches both your class standing and gender. Bind a group instead, or skip roommates.</p>"}</div>`;
}

function renderBind(members) {
  return `<div class="grid two">
    <label>Screen name or group code<input id="bind-value" placeholder="maya or MAYA-YUAN" /></label>
  </div>
  <div class="actions"><button type="button" class="button" data-action="bind">Join group</button></div>
  <p class="meta">Sample roommate Maya Chen uses screen name maya and group code MAYA-YUAN. Her class-standing category is Undergraduate. You can also type a screen name that is not in the pool. The demo will record that bind.</p>
  ${members.length ? "" : ""}`;
}

function memberList(members) {
  return `<h3>Current group</h3><div class="cards">${members.map((person) => `<article class="person"><header><div><strong>${esc(person.name || person.screen)}</strong><p class="meta">${esc(person.screen)}${person.manual ? " · entered by screen name" : ""}</p></div><button type="button" class="tiny" data-action="remove-member" data-id="${person.id || person.screen}">Remove</button></header></article>`).join("")}</div>`;
}

function renderRank() {
  const result = pipeline();
  if (!result) return shell("Pros, cons, and rank", "", "<p>Finish the three goals first.</p>");
  const ranked = state.ranking.map((id) => result.choice.find((entry) => entry.hall.id === id)).filter(Boolean);
  const term = termById(catalog, state.term);
  const count = term?.preferenceCount || 5;
  return shell(
    "Pros and cons, then rank",
    `An undergraduate application lists 5 choices in order of interest. A graduate application lists 4. The list below is every hall that remains. Submit records your order. If more than ${count} remain, the first ${count} are the choices that correspond to that form.`,
    `${ranked.length ? ranked.map((entry, index) => rankCard(entry, index, result.choice)).join("") : "<p>No halls remain. Go back to loosen dining, entrance, room type, or rate, or add the community building back.</p>"}`
  );
}

function rankCard(entry, index, choice) {
  const detail = describeHall(entry, { ...state, elevator: state.elevator === "yes" }, catalog, choice);
  return `<article class="hall"><header><div class="split"><span class="rank-no">${index + 1}</span><div><h3>${esc(entry.hall.name)} <span class="meta">${esc(entry.hall.code || "")}</span></h3><p class="meta">${esc(entry.hall.address)}</p></div></div><div class="actions"><button type="button" class="tiny" data-action="move" data-id="${entry.hall.id}" data-dir="-1">Move up</button><button type="button" class="tiny" data-action="move" data-id="${entry.hall.id}" data-dir="1">Move down</button></div></header>
  <div class="columns"><div class="pro"><h4>Pros</h4><ul>${detail.pros.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></div><div class="con"><h4>Cons</h4><ul>${detail.cons.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></div></div>
  <p class="quote">${esc(entry.hall.quote)}</p></article>`;
}

function renderSubmit() {
  const result = pipeline();
  const term = termById(catalog, state.term);
  const count = term?.preferenceCount || 5;
  const ranked = (result ? state.ranking : []).map((id, index) => {
    const hall = catalog.halls.find((item) => item.id === id);
    return `<li>${index < count ? "Choice" : "Ranked beyond the form"} ${index + 1}: ${esc(hall.name)}</li>`;
  }).join("");
  const needsEssay = state.gender === "gih" || state.llc;
  return shell(
    "Review and submit",
    "On the official portal, the application is complete and eligible for assignment only after the $65 nonrefundable fee is received. You can still add roommates after paying. This demo stores the result only in this browser.",
    `<ul>
      <li>${esc(state.name)}, screen name ${esc(state.screen)}</li>
      <li>${esc(term?.label || "")}, ${esc(state.standing)}, category ${esc(state.category)}</li>
      <li>${esc(genderLabel(state.gender))}, room type ${esc(state.roomType)}, rate ${state.rateMax == null ? "no cap" : money(state.rateMax)}</li>
      <li>OSAS: ${state.osas === "yes" ? "registration needed" : "not requested"}; elevator: ${state.elevator === "yes" ? "needed, and halls whose pages say they have no elevator were removed" : "not used as a filter"}</li>
      <li>Community: ${esc(catalog.llcs.find((item) => item.id === state.llc)?.name || "none")}</li>
      <li>Roommates: ${esc(roommateSummary())}</li>
    </ul>
    <ol>${ranked}</ol>
    ${needsEssay ? `<label>Supplemental answer<textarea data-field="supplement" placeholder="Gender-Inclusive Housing and some communities ask for a short written answer. This demo only checks that you wrote one.">${esc(state.supplement)}</textarea></label>` : ""}
    <label class="check"><input type="checkbox" data-field="feeAck" ${state.feeAck ? "checked" : ""}/>I understand that a real application requires a $65 nonrefundable fee. This demo does not collect payment and does not send an application to USC.</label>`,
    `<div class="actions"><button type="button" class="button secondary" data-action="back">Back to ranking</button><button type="button" class="button" data-action="submit">Submit demo application</button></div>`
  );
}

function renderDone() {
  const saved = JSON.parse(localStorage.getItem("usc-dorm-applications") || "[]");
  const current = saved.find((item) => item.confirmation === state.confirmation) || saved.at(-1);
  return `<section class="panel"><p class="eyebrow">Saved in this browser</p><h2>Demo application submitted</h2><p class="done-code">${esc(state.confirmation)}</p><p>The confirmation number only shows that the demo flow finished. USC Housing will not receive it and will not assign a room from it.</p><p>Submitted: ${esc(current?.submittedAt ? new Date(current.submittedAt).toLocaleString("en-US", { hour12: false }) : "")}</p><p>Ranked choices: ${esc((current?.rankingNames || []).join(", "))}</p><div class="actions"><button type="button" class="button" data-action="start-blank">Start another</button></div></section>`;
}

function submitApplication() {
  const problem = ["profile", "term", "gender", "room", "access", "goals", "lifestyle", "refine", "roommate", "rank"]
    .map(validate)
    .find(Boolean);
  if (problem) {
    state.error = problem;
    return;
  }
  if ((state.gender === "gih" || state.llc) && state.supplement.trim().length < 8) {
    state.error = "This request needs a short supplemental answer.";
    return;
  }
  if (!state.feeAck) {
    state.error = "Confirm that you understand the $65 application fee. This demo does not charge it.";
    return;
  }
  if (llcMustLead()) {
    state.error = "The community building needs to be ranked first, or added back to the list first.";
    return;
  }
  const result = pipeline();
  state.confirmation = `USC-DEMO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const record = {
    confirmation: state.confirmation,
    submittedAt: new Date().toISOString(),
    name: state.name,
    screen: state.screen,
    term: state.term,
    standing: state.standing,
    rankingNames: state.ranking.map((id) => catalog.halls.find((hall) => hall.id === id)?.name),
    roommateMode: state.roommateMode,
    group: groupMembers().map((person) => person.screen),
    goals: [state.career, state.life, state.interest],
    choiceCount: result?.choice.length || 0,
  };
  const all = JSON.parse(localStorage.getItem("usc-dorm-applications") || "[]");
  all.push(record);
  localStorage.setItem("usc-dorm-applications", JSON.stringify(all));
  state.step = "done";
}

function inviteRoommate(id) {
  const roommate = catalog.roommates.find((person) => person.id === id);
  const problem = roommateProblem(roommate);
  if (problem) {
    state.error = problem;
    return;
  }
  if (!state.group.includes(id)) state.group.push(id);
  state.roommateMode = "bind";
}

function bindRoommate() {
  const value = document.querySelector("#bind-value")?.value.trim();
  if (!value) {
    state.error = "Enter a screen name or a group code.";
    return;
  }
  const roommate = catalog.roommates.find((person) => person.screen.toLowerCase() === value.toLowerCase() || person.groupCode?.toLowerCase() === value.toLowerCase());
  if (roommate) {
    const problem = roommateProblem(roommate);
    if (problem) {
      state.error = problem;
      return;
    }
    if (!state.group.includes(roommate.id)) state.group.push(roommate.id);
    state.roommateMode = "bind";
    return;
  }
  if (!/^[A-Za-z0-9]{3,16}$/.test(value)) {
    state.error = "A screen name you type in also needs 3 to 16 letters or numbers.";
    return;
  }
  if (!state.manualGroup.some((person) => person.screen.toLowerCase() === value.toLowerCase())) {
    state.manualGroup.push({ screen: value, name: value, manual: true });
  }
  state.roommateMode = "bind";
}

function roommateProblem(roommate) {
  if (standingCategory(roommate.standing) !== standingCategory(state.standing)) {
    return `${roommate.name} is in the ${standingCategory(roommate.standing)} category, and you are in ${standingCategory(state.standing)}. The application page requires the same category.`;
  }
  if (state.gender === "gih" && !roommate.gih) return "That sample profile did not request Gender-Inclusive Housing.";
  if (state.gender !== "gih" && roommate.gih) return "That person requested Gender-Inclusive Housing, so they cannot be bound directly to a gender-separated application.";
  if (state.gender !== "gih" && roommate.gender !== state.gender) return "For a gender-separated assignment, a sample bind uses the same gender selection.";
  return "";
}

function moveRank(id, direction) {
  const index = state.ranking.indexOf(id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= state.ranking.length) return;
  const next = [...state.ranking];
  [next[index], next[target]] = [next[target], next[index]];
  state.ranking = next;
}

function roommateSummary() {
  if (state.roommateMode === "skip") return "None requested. Assignment can happen later.";
  const names = groupMembers().map((person) => person.screen);
  if (state.roommateMode === "pool" && !names.length) return "Looked at the roommate pool only";
  return `Group: ${names.join(", ") || "no members yet"}`;
}

function genderLabel(gender) {
  if (gender === "female") return "Female";
  if (gender === "male") return "Male";
  if (gender === "gih") return "Gender-Inclusive Housing";
  return "";
}

function field(label, name, value, placeholder = "") {
  return `<label>${label}<input data-field="${name}" value="${esc(value)}" placeholder="${esc(placeholder)}" /></label>`;
}
function selectOptions(options, current) {
  return options.map(([value, label]) => `<option value="${esc(value)}" ${current === value ? "selected" : ""}>${esc(label)}</option>`).join("");
}
function choiceButton(fieldName, value, title, note, current, action = "pick") {
  return `<button type="button" class="choice" data-action="${action}" data-field="${fieldName}" data-value="${esc(value)}" aria-pressed="${current === value}"><strong>${esc(title)}</strong><span>${esc(note)}</span></button>`;
}
function choiceGrid(html) {
  return `<div class="grid two">${html.join("")}</div>`;
}
function goalSelect(label, fieldName, group) {
  const options = [["", "Choose one"], ...goalsOf(group).map((goal) => [goal.id, goal.label])];
  return `<label>${label}<select data-field="${fieldName}">${selectOptions(options, state[fieldName])}</select></label>`;
}
function habitGrid(fieldName, label, group) {
  const buttons = Object.entries(HABIT_LABELS[group]).map(([value, text]) => choiceButton(fieldName, value, text, "", state[fieldName]));
  return `<h3>${label}</h3><div class="grid three">${buttons.join("")}</div>`;
}
function limitButton(fieldName, value, label) {
  const current = !state[`${fieldName}Chosen`] ? "" : state[fieldName] == null ? "any" : String(state[fieldName]);
  return `<button type="button" class="choice" data-action="limit" data-field="${fieldName}" data-value="${value}" aria-pressed="${current === value}">${label}</button>`;
}
function hallLine(entry, index, detail) {
  return `<article class="hall"><header><div><strong>${index + 1}. ${esc(entry.hall.name)}</strong><p class="meta">${esc(entry.hall.code || "")} · ${esc(detail)}</p></div><span class="tag">${esc(entry.hall.forms.join(" / "))}</span></header><p>${esc(entry.hall.summary)}</p></article>`;
}
function removedList(removed) {
  if (!removed?.length) return "";
  return `<details><summary>See the ${removed.length} halls that were removed</summary><ul>${removed.map((entry) => `<li><strong>${esc(entry.hall.name)}</strong>: ${esc(entry.reasons[0])}</li>`).join("")}</ul></details>`;
}
function mapHtml(halls, anchors) {
  const points = [...halls, ...anchors];
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = maxLat - minLat || 0.01;
  const lngSpan = maxLng - minLng || 0.01;
  const place = (point) => {
    const x = ((point.lng - minLng) / lngSpan) * 84 + 8;
    const y = (1 - (point.lat - minLat) / latSpan) * 78 + 8;
    return `<span class="dot ${point.kind}" style="left:${x}%;top:${y}%" title="${esc(point.label)}"></span>`;
  };
  return `<div class="map" role="img" aria-label="Relative positions of residence halls and goal locations">${anchors.map(place).join("")}${halls.map(place).join("")}</div>`;
}
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}
