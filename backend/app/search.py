"""Plain keyword search that decides which tab a sentence belongs in.

No AI needed: every Topic/Option/Resource/Group carries keywords, and a few word lists
decide between Care, People and Voice. Easy to explain, easy to test.
"""
import re
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from . import models as m
from . import serializers as s

VOICE_WORDS = [
    "report", "pothole", "sidewalk", "crosswalk", "unsafe", "dark", "streetlight", "street light",
    "broken", "county", "commissioner", "meeting", "petition", "idea", "complain", "traffic",
    "speed", "no sidewalk", "public comment", "vote", "ordinance", "trail extension", "litter",
    "hazard", "flooded", "overgrown", "project", "projects", "construction", "building",
]
# Questions like "what's happening this week?" or "what is the county building?" ask for a whole list.
EVENT_INTENT = re.compile(r"\b(this week|what'?s on|what is on|happening|events?|things to do|calendar)\b", re.I)
PROJECT_INTENT = re.compile(r"\b(projects?|construction|county news)\b|\bwhat(?:'?s| is| are) the county\b|\bcounty\b.*\b(building|working on)\b", re.I)
PEOPLE_WORDS = [
    "group", "club", "friend", "join", "meet", "buddy", "buddies", "team", "event", "events",
    "lonely", "together", "walkers", "runners", "challenge", "volunteer", "community", "neighbors",
    "neighbour", "people like me", "social", "this week", "things to do", "calendar", "happening",
]
STOP = {"i", "im", "i'm", "a", "an", "the", "to", "and", "of", "in", "on", "my", "me", "is", "am",
        "want", "need", "after", "for", "with", "are", "be", "can", "how", "do", "what", "where",
        "some", "any", "get", "find", "looking", "help", "near", "stuck", "start", "again", "feel", "just",
        "have", "like", "going", "this", "week", "happening", "want", "know", "tell", "about"}


def _hits(text: str, words: list[str]) -> list[str]:
    found = []
    for w in words:
        if re.search(r"\b" + re.escape(w.lower()) + r"\w*", text):
            found.append(w)
    return found


def _tokens(q: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9']+", q.lower()) if t not in STOP and len(t) > 2]


def route_for(q: str) -> str:
    text = q.lower()
    v = len(_hits(text, VOICE_WORDS))
    p = len(_hits(text, PEOPLE_WORDS))
    c = 0
    # Care keywords come from the database, but a few obvious ones help the tie-break.
    c += len(_hits(text, ["surgery", "injury", "doctor", "clinic", "flu", "shot", "jog", "run", "walk",
                          "recover", "therapy", "food", "pantry", "health", "school", "learn", "exercise",
                          "sick", "anxiety", "stress", "senior", "baby", "diet"]))
    if v and v >= p and v >= c:
        return "voice"
    if p and p >= c:
        return "people"
    return "care"


def care_matches(db: Session, q: str):
    text = q.lower()
    toks = _tokens(q)
    topics = db.scalars(select(m.Topic).options(selectinload(m.Topic.options)).order_by(m.Topic.sort)).all()
    scored = []
    matched_words: list[str] = []
    for t in topics:
        words = list(t.keywords or [])
        for o in t.options:
            words += list(o.keywords or [])
        hits = _hits(text, words)
        # token fallback: query word is the start of a keyword (e.g. "jogging" -> "jog")
        for tok in toks:
            for w in words:
                if len(tok) >= 4 and (w.lower().startswith(tok[:4]) and w.lower() not in hits):
                    hits.append(w)
        if hits:
            scored.append((len(hits), t, hits))
            for h in hits:
                if h not in matched_words:
                    matched_words.append(h)
    scored.sort(key=lambda x: (-x[0], x[1].sort))
    return scored, matched_words


def tidy(text: str, words: list[str]) -> list[str]:
    """Words actually typed, longest form only ('jog' and 'jogging' -> 'jogging')."""
    typed = [w for w in words if re.search(r"\b" + re.escape(w.lower()), text)]
    keep = []
    for w in typed:
        if any(w != o and w.lower() in o.lower() for o in typed):
            continue
        keep.append(w)
    return keep[:4]


def search(db: Session, q: str, user) -> dict:
    q = (q or "").strip()
    saved = s.saved_set(db, user)
    out = {"query": q, "route": "care", "matched": [], "topics": [], "groups": [], "events": [],
           "ideas": [], "projects": [], "meetings": [], "resources": []}
    if not q:
        return out
    route = route_for(q)
    scored, matched = care_matches(db, q)
    text = q.lower()

    # People matches
    groups = db.scalars(select(m.Group)).all()
    for g in groups:
        blob = " ".join([g.name, g.blurb, " ".join(g.tags or [])]).lower()
        if any(re.search(r"\b" + re.escape(t[:5]), blob) for t in _tokens(q)):
            out["groups"].append(s.group(db, g, user, saved))
    events = db.scalars(select(m.Event).where(m.Event.starts_at >= datetime.now(timezone.utc)).order_by(m.Event.starts_at)).all()
    for e in events:
        blob = " ".join([e.title, e.blurb, " ".join(e.tags or [])]).lower()
        if any(re.search(r"\b" + re.escape(t[:5]), blob) for t in _tokens(q)):
            out["events"].append(s.event(db, e, user, saved))
    # Voice matches
    for i in db.scalars(select(m.Idea)).all():
        blob = (i.title + " " + i.body).lower()
        if any(t[:5] in blob for t in _tokens(q)):
            out["ideas"].append(s.idea(db, i, user, saved))
    for p in db.scalars(select(m.Project)).all():
        blob = (p.title + " " + p.summary).lower()
        if any(t[:5] in blob for t in _tokens(q)):
            out["projects"].append(s.project(p, saved))
    for x in db.scalars(select(m.Meeting)).all():
        blob = (x.title + " " + x.blurb).lower()
        if any(t[:5] in blob for t in _tokens(q)):
            out["meetings"].append(s.meeting(x, saved))
    # Concrete resources (e.g. a trail)
    for r in db.scalars(select(m.Resource).options(selectinload(m.Resource.option))).all():
        blob = " ".join([r.title, r.description, " ".join(r.tags or [])]).lower()
        if any(len(t) >= 4 and t[:5] in blob for t in _tokens(q)):
            out["resources"].append(s.resource(r, saved))
    out["resources"] = out["resources"][:6]

    # Never send a Care-style sentence to an empty People/Voice page.
    if route == "people" and not (out["groups"] or out["events"]):
        route = "care" if scored else "people"
    if route == "voice" and not (out["ideas"] or out["projects"] or out["meetings"]):
        route = "voice"  # the Voice tab still shows 'Report a problem' with the text pre-filled
    if route == "care" and not scored and (out["groups"] or out["events"]):
        route = "people"

    asks_projects = bool(PROJECT_INTENT.search(q)) and not re.search(r"\b(sidewalk|pothole|unsafe|dark)\b", text)
    asks_events = bool(EVENT_INTENT.search(q)) and not asks_projects
    if asks_projects:
        out["projects"] = [s.project(p, saved) for p in db.scalars(select(m.Project).order_by(m.Project.id)).all()]
        out["ideas"] = []
        route = "voice"
    elif asks_events:
        out["events"] = [s.event(db, e, user, saved) for e in events[:8]]
        route = "people"

    out["route"] = route
    if route == "voice":
        matched = _hits(text, VOICE_WORDS)
    elif route == "people":
        matched = _hits(text, PEOPLE_WORDS) or matched
    out["matched"] = tidy(text, matched)
    for k, (n, t, hits) in enumerate(scored[:3]):
        d = s.topic(t)
        d["open"] = k == 0
        d["matched"] = hits[:3]
        out["topics"].append(d)
    return out
