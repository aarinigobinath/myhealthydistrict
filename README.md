# MyHealthyDistrict (web app)

A community health app for Forsyth County, GA: describe your situation, get **options** (not a plan) in
**Care**, **People** and **Voice**, save favorites to **MyStuff**, and see how neighbors' reports reach the county.
Built from the web storyboard. High school project.

| Part | Technology |
| --- | --- |
| Database | PostgreSQL 16 |
| Backend API | Python, FastAPI, SQLAlchemy, JWT login (bcrypt passwords) |
| Website | React 19 + Vite + React Router |
| Tests | pytest (API), Vitest (React), Playwright (real browser) |

## Windows: double-click

Double-click `START-MyHealthyDistrict.bat`. It installs Python, Node.js and PostgreSQL with winget if they are missing
(Windows may ask for permission), builds the website, loads the sample data and opens http://localhost:8000.
Close the window to stop. Quick look without installing anything: open `preview-no-install\index.html`.

## Run it (Docker)

```
docker compose up --build
```

Open <http://localhost:8000>. Sample data loads the first time.

## Run it without Docker

You need PostgreSQL 16, Python 3.11+ and Node 20+.

```
# 1. database (once)
createuser -P mhd          # password: mhd_dev_pw
createdb -O mhd mhd && createdb -O mhd mhd_test

# 2. backend
python -m venv .venv && . .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r backend/requirements-dev.txt
cd backend && python -m app.seed && cd ..

# 3. website
cd frontend && npm install && npm run build && cd ..

# 4. run (API + website on http://localhost:8000), restarts itself if it stops
./scripts/run_forever.sh
```

While editing the website, run `npm run dev` inside `frontend/` (port 5173, forwards `/api` to port 8000).

## Preview without any server

`cd frontend && npm run build:demo` makes `dist-demo/`: the same website answering its API inside the browser
(`frontend/src/demo/mockApi.js`, sample data from `data.json`). Accounts, saves and reports stay in that browser only.

## Sign in (demo accounts, sample passwords)

| Who | Email | Password |
| --- | --- | --- |
| Maya (resident) | maya@example.com | MayaDemo2026! |
| County staff | county@example.com | CountyDemo2026! |

Or create your own account on the Register screen.

## Test it

```
./scripts/run_all_tests.sh
```

* `backend/tests/test_api_flow.py` - 17 checks following Maya's story: login rules, search routing, remote learning options,
  jogging filters, saving to MyStuff, joining groups, reporting a problem, voting, county update changing a report's status.
* `frontend/src/__tests__` - 11 checks: login screens, search results, save button (including a failed save), county guard.
* `e2e/test_maya_story.py` - 5 real-browser runs: sign up, the whole three-act story, voice search, phone-width layout.

## Where the data comes from

`backend/app/seed.py` holds all sample data. Items with `verified=True` cite a public source (county site, library,
health department, Northside, discoverfoco.com, Georgia rule 160-4-2-.31). Items with `verified=False` are invented
examples and show a yellow **Sample** tag. Anything unconfirmed is a `[BRACKETED PLACEHOLDER]`.
Phone numbers, hours and dates change: confirm with each source before relying on them.

Real facts used include: Big Creek Greenway trailheads and length, Forsyth County Health Department (428 Canton Hwy),
The Place of Forsyth food pantry, Sharon Forks Library, Northside Hospital Forsyth Outpatient Rehabilitation, Senior Services,
Board of Commissioners meeting times (first and third Thursdays, 5 p.m., 110 East Main Street), county parks and addresses,
Forsyth County Schools online course options, and Georgia's Hospital/Homebound rule.

## How search works

`backend/app/search.py` is plain keyword matching, no AI. Every topic and option has keywords; word lists decide between
Care, People and Voice. `GET /api/search?q=...` returns the tab, the words it matched ("Because you said...") and the option groups.

## Folder map

```
backend/app   main.py (routes) models.py (tables) search.py seed.py security.py serializers.py
backend/tests API tests
frontend/src  pages/ (one file per screen) components/ui.jsx api.js auth.jsx styles.css
e2e           browser tests
scripts       run_forever.sh start_api.sh run_all_tests.sh
```

## Before showing this to real people

* Set `MHD_SECRET_KEY` to a long random value (see `.env.example`).
* This is a demo: reports are stored in your own database and are **not** sent to the county.
* Add login rate limiting, email verification and a privacy policy before collecting real residents' data.
  Ask a teacher or parent before gathering personal information from minors.


## Updating the sample data
Edit `backend/app/seed.py`, then change `SEED_VERSION` at the top. The Windows launcher (and Docker) reload the database
whenever that version differs, so the new data appears the next time you start the app. A reload starts the demo database
fresh, so accounts made while testing are removed. To refresh the browser-only preview copy of the data, seed a test database
and run `python ../scripts/export_demo_data.py` from the `backend` folder, then `npm run build:demo`.

Events and county projects come from pages that could be read when the data was collected (Oct. 22, 2026). The county's own
calendar (https://www.forsythco.com/calendar/?event_category=165) blocked our automatic reader, so the app links to it.


## Look and behavior notes (round 2)
* **Logo**: a map pin holding a heart with a small pulse line (`logo.svg`, `frontend/src/components/Logo.jsx`, also the browser-tab icon).
* **Theme**: deep teal with warm coral accent, soft sage background, white cards with light shadows (`frontend/src/styles.css`, tokens at the top).
* **AI Assistant**: round button with a small caption at the bottom right of every signed-in page (not a tab). It asks the same `/api/search`
  as the search bar and shows the same cards in short sentences.
* **Header**: always one row (labels turn into icons on narrow windows). County dropdown at top right starts on Forsyth after every sign-in;
  other counties only show a small note, the content stays Forsyth (`frontend/src/county.jsx`).
* **Maps**: Google Maps embed plus "Open in Google Maps" and "Get directions" buttons. If a map ever stays blank, the buttons still work.
* **Launcher** stops an older copy still running on port 8000 so you always see the newest version.
