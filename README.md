# TrojanMatch
HACKATHON AI@USC 2026

TrojanMatch is a student prototype from the AI@USC Hackathon 2026. It is a browser app for USC students to browse campus events and ride requests, rank a short list of student organizations, and walk through a housing-preference demo.

It is not an official USC Housing product, and it is not affiliated with the University of Southern California. Nothing in this repository submits an application, a roommate request, or a payment to USC.

## Run it locally

You need Node.js 18 or newer. There is no package install. From the repository root:

```bash
node server.js
```

Then open [http://localhost:3000](http://localhost:3000). The server listens on port 3000 unless you set `PORT` or pass a port: `node server.js 8080`.

`server.js` serves the HTML, CSS, and JSON in this repository. It also exposes `GET /api/health` and `POST /api/chat`.

### Optional chat key

The home-page assistant, Traveler, answers from a short built-in list of replies when no key is set. To call Gemini instead, copy `.env.example` to `.env` and set `GEMINI_API_KEY`. An optional `GEMINI_MODEL` overrides the default model name in `server.js`. The key stays on the server. Restart `node server.js` after you change `.env`.

`GET /api/health` returns `{ "ai": true }` only when that key is present. On [Replit](https://replit.com), `.replit` already runs `node server.js`; put the same variable in Secrets instead of committing a `.env` file.

## Pages

The menu on the home page opens the other flows in the page. Each flow is also a file you can open on its own.

### Home (`index.html`)

The home page has an animated horse banner, three preview cards, and a small runner game. The preview cards are example text. They are not live matches, and signing in does not replace them with personal results.

- **Sign in** asks for a name and an `@usc.edu` email. There is no password. The session and profile stay in this browser (`localStorage`).
- **Edit profile** (avatar, top right) can store a major, graduation month, and graduation year. All three are optional.
- **Ride break** is a canvas game. Jump with Space, the up arrow, or a tap. The best score stays in this browser.
- **Traveler** is the chat button at the bottom right. With a Gemini key it sends the message, a short history, and the signed-in first name, major, and graduation fields to `POST /api/chat`. Without a key it uses the built-in replies and says it is offline.

### Event matching (`eventRideMatch.html`)

Open it from the menu, or go to `/eventRideMatch.html`. Carpools and Messages are tabs inside this page. The menu labels them Carpools and Messages; the page itself labels the ride tab **Rides** and the buddy feature **Finding a buddy**.

Sign-in here is a list of eight demo students plus a **USG Admin** dashboard. Those people, events, organizations, ride requests, Los Angeles listings, and report rows are sample data in the file. They are not loaded from EngageSC or a live events API. A comment in the file says a production version would replace them.

After you pick a demo student you can:

- Browse upcoming sample campus events, including some marked members-only for certain orgs.
- Search with keywords such as a day or a topic. The page tries `POST /api/search` first. This server does not implement that route, so search falls back to local keyword matching and shows **Local search (AI offline)**.
- Post that you are looking for a buddy, connect with up to three other sample students, and open a group chat. Chat replies from other people are canned lines in the page.
- Add an event or ride to a calendar as an `.ics` file, or open a Google Calendar or Outlook link.
- On **Rides**, filter sample ride requests, join or leave one, or post a new request. A listed dollar amount is an estimate typed into the demo. The page says to settle up outside the app. It does not take payment.
- On **Messages**, read and send group chats for events and rides you joined. Report and Block only show a toast.
- As **USG Admin**, see sample dashboard counts, toggle ride sharing and the search flag, and generate a paragraph from the current demo counts.

Use **Switch user**, **Reset demo**, or the clock buttons to move the in-memory demo forward. Reloading the page restores the sample data.

### Club matching (`clubs.html`)

Open it from the menu, or go to `/clubs.html`. The form asks for a name, year, weekly time, and interest checkboxes. **Find My Clubs** scores a fixed list of student organizations in the page by shared interests and weekly time, then shows up to six results with links. The year field is not used in that score. **Generate Random Interest** picks one interest and one related club from the same list. The list is copied into the file; the page does not call EngageSC.

### Dorm matching (`dorms/index.html`)

Open it from the menu, or go to `/dorms/`. The embedded page title in the file is **Room MatchingPlus**. It walks through a local housing demo:

1. Start from a blank profile or a sample student.
2. Name, screen name, application category, and an emergency contact.
3. Term and class standing.
4. Gender-separated housing or Gender-Inclusive Housing.
5. Room type and a rate cap.
6. Accessibility (OSAS and elevator).
7. Learning communities.
8. Three goals, which pick nearby campus landmarks.
9. Habits: sleep, cleanliness, study, noise, guests, and pets.
10. Distance and eligibility filters.
11. Roommates: skip, invite from a sample pool (optional MBTI), or bind a screen name or the sample code `MAYA-YUAN`.
12. Pros, cons, and a ranked list of remaining halls.
13. Review and submit.

Matching uses the rules in `dorms/js/match.js` and the halls in `dorms/data/catalog.json` (45 halls, plus terms, landmarks, learning communities, and sample roommates). The catalog note says the building facts came from public USC Housing pages on 2026-11-14, and that walking times are approximate. There is no model call on this flow.

Progress for the open tab is kept in `sessionStorage`. **Submit demo application** writes a confirmation number and a short record to `localStorage` under `usc-dorm-applications`. USC Housing does not receive it.

The review step asks you to acknowledge that a real USC Housing application requires a $65 nonrefundable fee on the official portal. This demo does not collect that fee and does not send an application.

Check the matching rules with:

```bash
node dorms/js/selfcheck.mjs
```

## What this prototype does not do

- It does not rank events, clubs, or dorms with a model. Club scores and dorm rankings are local rules. Event search in this server is local keyword matching.
- Traveler calls Gemini only when `GEMINI_API_KEY` is set. Those replies can be wrong.
- It does not charge $65 or any other amount, and it does not connect to a payment provider.
- It does not sign in through USC, and it does not sync profiles, chats, rides, or housing applications to a shared database.

## License

Apache License 2.0. See [LICENSE](LICENSE).
