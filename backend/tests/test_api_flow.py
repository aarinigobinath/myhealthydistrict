"""End-to-end API tests that follow Maya's story (Acts 1-3) plus login rules."""
import uuid

from .conftest import login


def fresh_email():
    return f"test-{uuid.uuid4().hex[:8]}@example.com"


# ------------------------------------------------------------ login screens
def test_health(client):
    assert client.get("/api/health").json()["ok"] is True


def test_register_login_me(client):
    email = fresh_email()
    r = client.post("/api/auth/register", json={"email": email, "password": "longenough1", "name": "Tess", "area": "North"})
    assert r.status_code == 201
    token = r.json()["token"]
    me = client.get("/api/me", headers={"Authorization": f"Bearer {token}"}).json()
    assert me["email"] == email and me["area"] == "North" and me["is_admin"] is False
    assert "password" not in str(me).lower()
    # log in again with the same details
    assert login(client, email, "longenough1")


def test_register_rules(client):
    email = fresh_email()
    ok = {"email": email, "password": "longenough1", "name": "Dup"}
    assert client.post("/api/auth/register", json=ok).status_code == 201
    assert client.post("/api/auth/register", json=ok).status_code == 409  # same email
    assert client.post("/api/auth/register", json={**ok, "email": fresh_email(), "password": "short"}).status_code == 422
    assert client.post("/api/auth/register", json={**ok, "email": "not-an-email"}).status_code == 422
    # email match ignores capital letters
    assert client.post("/api/auth/register", json={**ok, "email": email.upper()}).status_code == 409


def test_login_failures_and_guards(client):
    assert client.post("/api/auth/login", json={"email": "maya@example.com", "password": "wrong-password"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "nobody@example.com", "password": "whatever123"}).status_code == 401
    assert client.get("/api/me").status_code == 401
    assert client.get("/api/me", headers={"Authorization": "Bearer garbage"}).status_code == 401
    assert client.get("/api/mystuff").status_code == 401
    assert client.put("/api/saved", json={"type": "group", "id": 1}).status_code == 401


def test_update_profile(client, maya):
    r = client.patch("/api/me", headers=maya, json={"neighborhood": "Halcyon"})
    assert r.status_code == 200 and r.json()["neighborhood"] == "Halcyon"
    client.patch("/api/me", headers=maya, json={"neighborhood": "[YOUR NEIGHBORHOOD]"})


# ------------------------------------------------------------ Act 1: describe a situation -> options
def test_search_routes_to_the_right_tab(client):
    def route(q):
        return client.get("/api/search", params={"q": q}).json()

    a = route("I’m a high schooler, stuck in bed after knee surgery")
    assert a["route"] == "care"
    assert a["topics"][0]["slug"] == "recovery-rehab" and a["topics"][0]["open"] is True
    assert "surgery" in a["matched"]
    assert any(o["slug"] == "remote-learning" for o in a["topics"][0]["options"])

    b = route("I want to start jogging again")
    assert b["route"] == "care" and b["topics"][0]["slug"] == "move-exercise"
    assert any(o["slug"] == "jogging-track-locator" for o in b["topics"][0]["options"])

    c = route("find a running group")
    assert c["route"] == "people" and c["groups"]

    d = route("the road to the park has no sidewalk")
    assert d["route"] == "voice" and d["ideas"]

    assert route("")["topics"] == []


def test_remote_learning_options(client):
    o = client.get("/api/options/remote-learning").json()
    titles = [r["title"] for r in o["resources"]]
    assert len(titles) >= 3
    assert any("teacher comes to you" in t.lower() for t in titles)
    assert any("Georgia Virtual School" in t for t in titles)
    verified = [r for r in o["resources"] if not r["sample"]]
    assert verified and all(r["source_url"] for r in verified)  # every real item cites a source


def test_unknown_option_is_404(client):
    assert client.get("/api/options/does-not-exist").status_code == 404


# ------------------------------------------------------------ Act 2: Care -> track locator -> People
def test_care_landing_has_all_topics(client):
    topics = client.get("/api/topics").json()
    assert len(topics) == 12
    assert {t["slug"] for t in topics} >= {"move-exercise", "recovery-rehab", "nutrition-food"}
    pop = client.get("/api/popular").json()
    assert pop["items"] and "Flu shots" in pop["searches"]


def test_jogging_track_locator_and_filters(client):
    o = client.get("/api/options/jogging-track-locator").json()
    names = [r["title"] for r in o["resources"]]
    assert "Big Creek Greenway" in names and "Fowler Park" in names
    assert o["layout"] == "map" and "paved" in o["tags"]
    paved = client.get("/api/options/jogging-track-locator", params={"tag": "paved"}).json()["resources"]
    assert 0 < len(paved) < len(o["resources"])
    assert all("paved" in r["tags"] for r in paved)
    greenway = next(r for r in o["resources"] if r["title"] == "Big Creek Greenway")
    assert "4110 Carolene Way" in greenway["description"] and not greenway["sample"]


def test_save_to_mystuff_round_trip(client, maya):
    track = next(r for r in client.get("/api/options/jogging-track-locator").json()["resources"] if r["slug"] == "fowler-park")
    group = next(g for g in client.get("/api/people").json()["groups"] if g["slug"] == "forsyth-morning-walkers")
    before = client.get("/api/mystuff", headers=maya).json()["counts"]["all"]

    assert client.put("/api/saved", headers=maya, json={"type": "resource", "id": track["id"]}).status_code == 200
    assert client.put("/api/saved", headers=maya, json={"type": "resource", "id": track["id"]}).status_code == 200  # twice is fine
    assert client.put("/api/saved", headers=maya, json={"type": "group", "id": group["id"]}).status_code == 200
    stuff = client.get("/api/mystuff", headers=maya).json()
    assert stuff["counts"]["all"] == before + 2
    assert any(x["slug"] == "fowler-park" for x in stuff["options"])
    assert any(x["slug"] == "forsyth-morning-walkers" for x in stuff["communities"])
    # the saved flag shows up on the list pages too
    again = next(r for r in client.get("/api/options/jogging-track-locator", headers=maya).json()["resources"] if r["slug"] == "fowler-park")
    assert again["saved"] is True

    client.delete(f"/api/saved/resource/{track['id']}", headers=maya)
    client.delete(f"/api/saved/group/{group['id']}", headers=maya)
    assert client.get("/api/mystuff", headers=maya).json()["counts"]["all"] == before
    assert client.put("/api/saved", headers=maya, json={"type": "resource", "id": 999999}).status_code == 404


def test_join_group_and_rsvp(client, maya):
    people = client.get("/api/people", headers=maya).json()
    g = next(x for x in people["groups"] if x["slug"] == "weekend-runners-club")
    joined = client.post(f"/api/groups/{g['id']}/join", headers=maya).json()
    assert joined["joined"] is True and joined["members"] == g["members"] + 1
    left = client.post(f"/api/groups/{g['id']}/join", headers=maya).json()
    assert left["joined"] is False and left["members"] == g["members"]

    e = people["events"][0]
    on = client.post(f"/api/events/{e['id']}/rsvp", headers=maya).json()
    assert on["going"] is True and on["going_count"] == e["going_count"] + 1
    client.post(f"/api/events/{e['id']}/rsvp", headers=maya)


def test_create_group_needs_login(client, maya):
    body = {"name": "Greenway Stroller Crew", "blurb": "Parents with strollers", "next_meeting": "Tue 9 AM"}
    assert client.post("/api/groups", json=body).status_code == 401
    r = client.post("/api/groups", headers=maya, json=body)
    assert r.status_code == 201 and r.json()["joined"] is True and r.json()["members"] == 1


def test_challenge_map_and_logging(client, maya):
    c = client.get("/api/people", headers=maya).json()["challenge"]
    assert [a["name"] for a in c["areas"]][0] == "North"
    west = next(a for a in c["areas"] if a["name"] == "West")
    assert west["percent"] == 76 and c["my_area"] == "West" and c["my_miles"] >= 6.2
    after = client.post("/api/challenge/log", headers=maya, json={"miles": 3}).json()
    assert after["my_miles"] == c["my_miles"] + 3
    assert client.post("/api/challenge/log", headers=maya, json={"miles": -1}).status_code == 422
    assert client.post("/api/challenge/log", json={"miles": 1}).status_code == 401


# ------------------------------------------------------------ Act 3: Voice -> county -> built
def test_voice_landing(client):
    v = client.get("/api/voice").json()
    assert v["announcements"] and v["ideas"] and v["projects"] and v["meetings"]
    boc = next(x for x in v["meetings"] if x["slug"] == "board-of-commissioners")
    assert "110 East Main Street" in boc["location"] and not boc["sample"]


def test_report_problem_and_vote_then_county_acts(client, maya, county):
    # 1. report a problem
    assert client.post("/api/issues", json={"title": "No sidewalk to the park"}).status_code == 401
    r = client.post("/api/issues", headers=maya, json={"title": "No sidewalk to the park", "category": "sidewalk", "location": "[STREET NAME]"})
    assert r.status_code == 201
    issue = r.json()
    assert issue["code"].startswith("MHD-") and issue["status"] == "Sent" and issue["area"] == "West"
    assert issue["similar_count"] >= 25  # seeded neighbors reported the same kind of problem in West
    assert client.post("/api/issues", headers=maya, json={"title": "x"}).status_code == 422

    mine = client.get("/api/issues", headers=maya).json()
    assert any(i["code"] == issue["code"] for i in mine)
    # strangers cannot read someone else's report
    other = client.post("/api/auth/register", json={"email": fresh_email(), "password": "longenough1", "name": "Other"}).json()["token"]
    assert client.get(f"/api/issues/{issue['code']}", headers={"Authorization": f"Bearer {other}"}).status_code == 404

    # 2. back an idea (tapping again takes it back; switching changes the side)
    idea = client.get("/api/voice", headers=maya).json()["ideas"][0]
    s1 = client.post(f"/api/ideas/{idea['id']}/vote", headers=maya, json={"stance": "support"}).json()
    assert s1["my_vote"] == "support" and s1["support"] == idea["support"] + 1
    s2 = client.post(f"/api/ideas/{idea['id']}/vote", headers=maya, json={"stance": "concern"}).json()
    assert s2["support"] == idea["support"] and s2["concerns"] == idea["concerns"] + 1
    s3 = client.post(f"/api/ideas/{idea['id']}/vote", headers=maya, json={"stance": "concern"}).json()
    assert s3["my_vote"] is None and s3["concerns"] == idea["concerns"]

    # 3. county staff see the pattern - residents cannot
    assert client.get("/api/county/pulse", headers=maya).status_code == 403
    pulse = client.get("/api/county/pulse", headers=county).json()
    west = next(a for a in pulse["by_area"] if a["area"] == "West")
    assert west["count"] == max(a["count"] for a in pulse["by_area"])  # West is the hot spot
    assert pulse["by_category"][0]["category"] == "sidewalk"
    # the suggestion Maya just sent is listed for county staff, newest first
    assert pulse["recent"][0]["code"] == issue["code"] and pulse["recent"][0]["by"] == "Maya"

    # 4. county publishes an update; matching reports move to "Planned"
    assert client.post("/api/county/updates", headers=maya, json={"title": "Sidewalk on X approved"}).status_code == 403
    out = client.post("/api/county/updates", headers=county, json={
        "title": "Sidewalk on [STREET NAME] approved for design", "body": "Thanks neighbors.",
        "category": "sidewalk", "set_status": "Planned"}).json()
    assert out["reports_updated"] >= 25
    seen = client.get(f"/api/issues/{issue['code']}", headers=maya).json()
    assert seen["status"] == "Planned" and seen["step_index"] == 2
    assert client.get("/api/voice").json()["announcements"][0]["title"].startswith("Sidewalk on")


def test_flow_search_to_save_end_to_end(client):
    """A brand-new neighbor goes from a sentence to a saved option, in one test."""
    token = client.post("/api/auth/register", json={"email": fresh_email(), "password": "longenough1", "name": "Sam"}).json()["token"]
    h = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/search", params={"q": "stuck in bed after knee surgery, high schooler"}, headers=h).json()
    assert res["route"] == "care"
    opt = client.get(f"/api/options/{res['topics'][0]['options'][0]['slug']}", headers=h).json()
    pick = opt["resources"][0]
    client.put("/api/saved", headers=h, json={"type": "resource", "id": pick["id"]})
    stuff = client.get("/api/mystuff", headers=h).json()
    assert stuff["counts"]["options"] == 1 and stuff["options"][0]["slug"] == pick["slug"]


# ---------------------------------------------------------------- Oct 2026 corrections
def test_remote_learning_has_official_links_and_no_video_option(client, maya):
    o = client.get("/api/options/remote-learning", headers=maya).json()
    titles = [r["title"] for r in o["resources"]]
    assert not any("video" in t.lower() for t in titles)
    by = {r["slug"]: r for r in o["resources"]}
    assert by["georgia-virtual-school"]["url"] == "https://gavs.geniussis.com/PublicStudentAdd.aspx"
    assert by["forsyth-virtual-academy"]["url"] == "https://ace.forsyth.k12.ga.us/forsyth-virtual-academy/our-program"


def test_start_jogging_again_only_offers_move_and_exercise(client, maya):
    d = client.get("/api/search", params={"q": "I want to start jogging again"}, headers=maya).json()
    assert [t["slug"] for t in d["topics"]] == ["move-exercise"]
    # the injury story still finds Recovery & Rehab
    k = client.get("/api/search", params={"q": "stuck in bed after knee surgery"}, headers=maya).json()
    assert k["topics"][0]["slug"] == "recovery-rehab"


def test_whole_list_questions_return_the_same_lists_the_pages_show(client, maya):
    ev = client.get("/api/search", params={"q": "What's happening this week?"}, headers=maya).json()
    assert ev["route"] == "people" and len(ev["events"]) >= 3 and not ev["topics"]
    pr = client.get("/api/search", params={"q": "What is the county building?"}, headers=maya).json()
    assert pr["route"] == "voice"
    assert len(pr["projects"]) == len(client.get("/api/voice", headers=maya).json()["projects"])
    # a sidewalk complaint is still a problem report, not a project list
    sw = client.get("/api/search", params={"q": "the road to the park has no sidewalk"}, headers=maya).json()
    assert sw["route"] == "voice"


def test_jogging_places_link_to_official_pages_and_google_maps(client, maya):
    o = client.get("/api/options/jogging-track-locator", headers=maya).json()
    assert len(o["resources"]) >= 10
    for r in o["resources"]:
        assert r["url"].startswith("https://www.forsythco.com/locations/") and r["url"].endswith("/"), r["title"]
        assert r["map_query"] and "Cumming" in r["map_query"], r["title"]
    parks = client.get("/api/options/parks-directory", headers=maya).json()["resources"]
    assert all(r["url"].startswith("https://www.forsythco.com/locations/") for r in parks)
    assert not any("sketch" in (r["description"] or "").lower() for r in o["resources"])


def test_events_are_real_dated_and_sourced(client, maya):
    from sqlalchemy import select

    from app import models as m
    from app.db import SessionLocal

    with SessionLocal() as db:
        rows = db.scalars(select(m.Event)).all()
    assert rows and all(e.verified and e.source_url.startswith("https://") for e in rows)
    assert any("NAMI" in e.title for e in rows)  # a mental health support group is listed
    home = client.get("/api/home", headers=maya).json()
    assert home["calendar_url"] == "https://www.forsythco.com/calendar/?event_category=165"
    assert not any("Sample event" in (e["blurb"] or "") for e in home["events"])
    assert client.get("/api/people", headers=maya).json()["calendar_url"] == home["calendar_url"]


def test_voice_shows_current_and_recently_finished_county_projects(client, maya):
    v = client.get("/api/voice", headers=maya).json()
    statuses = [p["status"] for p in v["projects"]]
    assert any(s.startswith("Completed") for s in statuses) and any(not s.startswith("Completed") for s in statuses)
    assert all(not p["sample"] and p["source_url"].startswith("https://") for p in v["projects"])
    assert {"Freedom Park county administration campus", "Bennett Park renovation"} <= {p["title"] for p in v["projects"]}
    assert len(v["announcements"]) == 4 and all(a["official"] for a in v["announcements"])


def test_sample_data_is_only_reloaded_when_its_version_changes():
    from app.seed import ensure_current

    assert ensure_current() is False  # same version: leaves the database (and its accounts) alone
