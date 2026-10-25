import os
import random
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from . import config
from . import models as m
from . import serializers as s
from .db import Base, engine, get_db
from .search import search as run_search
from .security import current_user, hash_password, make_token, optional_user, verify_password

app = FastAPI(title="MyHealthyDistrict API", version="1.0.0")
app.add_middleware(
    CORSMiddleware, allow_origins=config.ALLOWED_ORIGINS, allow_methods=["*"], allow_headers=["*"],
)

AREAS = ["North", "West", "Central", "South"]


@app.on_event("startup")
def create_tables():
    Base.metadata.create_all(engine)


@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    db.execute(select(1))
    return {"ok": True, "time": datetime.now(timezone.utc).isoformat()}


# ---------------------------------------------------------------- auth
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    name: str = Field(min_length=1, max_length=120)
    neighborhood: str = Field(default="", max_length=120)
    area: Literal["North", "West", "Central", "South"] = "Central"


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ProfileIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    tagline: str | None = Field(default=None, max_length=200)
    neighborhood: str | None = Field(default=None, max_length=120)
    area: Literal["North", "West", "Central", "South"] | None = None


@app.post("/api/auth/register", status_code=201)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    email = body.email.lower()
    if db.scalar(select(m.User).where(m.User.email == email)):
        raise HTTPException(409, "An account with that email already exists")
    u = m.User(email=email, name=body.name.strip(), password_hash=hash_password(body.password),
               neighborhood=body.neighborhood, area=body.area)
    db.add(u)
    db.commit()
    return {"token": make_token(u), "user": s.user(u)}


@app.post("/api/auth/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    u = db.scalar(select(m.User).where(m.User.email == body.email.lower()))
    if not u or not verify_password(body.password, u.password_hash):
        raise HTTPException(401, "Email or password is not right")
    return {"token": make_token(u), "user": s.user(u)}


@app.get("/api/me")
def me(u: m.User = Depends(current_user)):
    return s.user(u)


@app.patch("/api/me")
def update_me(body: ProfileIn, u: m.User = Depends(current_user), db: Session = Depends(get_db)):
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(u, k, v)
    db.commit()
    return s.user(u)


def this_week_events(db: Session, limit: int):
    """Events starting in the next 7 days; if there are none, the next few upcoming ones."""
    now = datetime.now(timezone.utc)
    q = select(m.Event).where(m.Event.starts_at >= now).order_by(m.Event.starts_at)
    week = db.scalars(q.where(m.Event.starts_at < now + timedelta(days=7)).limit(limit)).all()
    return week or db.scalars(q.limit(min(limit, 3))).all()


# ---------------------------------------------------------------- search + home
@app.get("/api/search")
def search(q: str = Query("", max_length=300), db: Session = Depends(get_db), u=Depends(optional_user)):
    return run_search(db, q, u)


@app.get("/api/home")
def home(db: Session = Depends(get_db), u=Depends(optional_user)):
    saved = s.saved_set(db, u)
    evs = this_week_events(db, 3)
    return {
        "suggestions": ["New parent", "Dad, 72, staying active", "Food on a budget", "Moving to Forsyth"],
        "events": [s.event(db, e, u, saved) for e in evs],
        "calendar_url": config.COUNTY_CALENDAR_URL,
    }


# ---------------------------------------------------------------- care
@app.get("/api/topics")
def topics(db: Session = Depends(get_db)):
    rows = db.scalars(select(m.Topic).options(selectinload(m.Topic.options)).order_by(m.Topic.sort)).all()
    return [s.topic(t) for t in rows]


@app.get("/api/popular")
def popular(db: Session = Depends(get_db), u=Depends(optional_user)):
    saved = s.saved_set(db, u)
    slugs = ["health-department-immunizations", "the-place-of-forsyth-food-pantry"]
    rows = db.scalars(select(m.Resource).options(selectinload(m.Resource.option)).where(m.Resource.slug.in_(slugs))).all()
    return {"searches": ["Flu shots", "Food pantries", "Start jogging again", "Counseling for teens", "Senior fitness"],
            "items": [s.resource(r, saved) for r in rows]}


@app.get("/api/options/{slug}")
def option_detail(slug: str, tag: list[str] = Query(default=[]), db: Session = Depends(get_db), u=Depends(optional_user)):
    o = db.scalar(select(m.Option).options(selectinload(m.Option.resources).selectinload(m.Resource.option),
                                           selectinload(m.Option.topic)).where(m.Option.slug == slug))
    if not o:
        raise HTTPException(404, "Option not found")
    saved = s.saved_set(db, u)
    res = o.resources
    if tag:
        res = [r for r in res if all(t in (r.tags or []) for t in tag)]
    all_tags = sorted({t for r in o.resources for t in (r.tags or [])})
    return {**s.option_brief(o), "topic": s.topic(o.topic, with_options=False), "tags": all_tags,
            "resources": [s.resource(r, saved) for r in res]}


# ---------------------------------------------------------------- people
@app.get("/api/people")
def people(db: Session = Depends(get_db), u=Depends(optional_user)):
    saved = s.saved_set(db, u)
    groups = db.scalars(select(m.Group).order_by(m.Group.base_members.desc())).all()
    evs = this_week_events(db, 8)
    return {"groups": [s.group(db, g, u, saved) for g in groups],
            "events": [s.event(db, e, u, saved) for e in evs],
            "calendar_url": config.COUNTY_CALENDAR_URL,
            "challenge": challenge_data(db, u)}


class GroupIn(BaseModel):
    name: str = Field(min_length=3, max_length=160)
    blurb: str = Field(default="", max_length=1000)
    next_meeting: str = Field(default="", max_length=120)


@app.post("/api/groups", status_code=201)
def create_group(body: GroupIn, u: m.User = Depends(current_user), db: Session = Depends(get_db)):
    slug = "".join(c if c.isalnum() else "-" for c in body.name.lower()).strip("-")[:80]
    slug = f"{slug}-{random.randint(1000, 9999)}"
    g = m.Group(slug=slug, name=body.name.strip(), blurb=body.blurb, next_meeting=body.next_meeting,
                created_by=u.id, base_members=0)
    db.add(g)
    db.flush()
    db.add(m.GroupMember(user_id=u.id, group_id=g.id))
    db.commit()
    return s.group(db, g, u, set())


@app.post("/api/groups/{group_id}/join")
def join_group(group_id: int, u: m.User = Depends(current_user), db: Session = Depends(get_db)):
    g = db.get(m.Group, group_id)
    if not g:
        raise HTTPException(404, "Group not found")
    row = db.scalar(select(m.GroupMember).where(m.GroupMember.group_id == g.id, m.GroupMember.user_id == u.id))
    if row:
        db.delete(row)  # tapping again leaves the group
    else:
        db.add(m.GroupMember(group_id=g.id, user_id=u.id))
    db.commit()
    return s.group(db, g, u, s.saved_set(db, u))


@app.post("/api/events/{event_id}/rsvp")
def rsvp(event_id: int, u: m.User = Depends(current_user), db: Session = Depends(get_db)):
    e = db.get(m.Event, event_id)
    if not e:
        raise HTTPException(404, "Event not found")
    row = db.scalar(select(m.Rsvp).where(m.Rsvp.event_id == e.id, m.Rsvp.user_id == u.id))
    if row:
        db.delete(row)
    else:
        db.add(m.Rsvp(event_id=e.id, user_id=u.id))
    db.commit()
    return s.event(db, e, u, s.saved_set(db, u))


def challenge_data(db: Session, u) -> dict:
    areas = db.scalars(select(m.ChallengeArea)).all()
    miles_by_area = dict(db.execute(
        select(m.User.area, func.coalesce(func.sum(m.ChallengeLog.miles), 0))
        .join(m.ChallengeLog, m.ChallengeLog.user_id == m.User.id).group_by(m.User.area)).all())
    rows = []
    for a in areas:
        total = a.base_miles + float(miles_by_area.get(a.name, 0))
        rows.append({"name": a.name, "miles": round(total, 1), "percent": min(100, round(100 * total / a.goal_miles))})
    rows.sort(key=lambda r: -r["percent"])
    for i, r in enumerate(rows):
        r["rank"] = i + 1
    mine = 0.0
    if u:
        mine = float(db.scalar(select(func.coalesce(func.sum(m.ChallengeLog.miles), 0)).where(m.ChallengeLog.user_id == u.id)))
    return {"areas": rows, "my_area": u.area if u else None, "my_miles": round(mine, 1)}


class MilesIn(BaseModel):
    miles: float = Field(gt=0, le=50)


@app.post("/api/challenge/log")
def log_miles(body: MilesIn, u: m.User = Depends(current_user), db: Session = Depends(get_db)):
    db.add(m.ChallengeLog(user_id=u.id, miles=body.miles))
    db.commit()
    return challenge_data(db, u)


# ---------------------------------------------------------------- voice
@app.get("/api/voice")
def voice(db: Session = Depends(get_db), u=Depends(optional_user)):
    saved = s.saved_set(db, u)
    ann = db.scalars(select(m.Announcement).order_by(m.Announcement.published_at.desc()).limit(4)).all()
    return {
        "announcements": [s.announcement(a) for a in ann],
        "ideas": [s.idea(db, i, u, saved) for i in db.scalars(select(m.Idea).order_by(m.Idea.id)).all()],
        "projects": [s.project(p, saved) for p in db.scalars(select(m.Project).order_by(m.Project.id)).all()],
        "projects_url": "https://www.forsythco.com/Capital-Projects/Parks-and-Recreation-Projects",
        "meetings": [s.meeting(x, saved) for x in db.scalars(select(m.Meeting).order_by(m.Meeting.id)).all()],
    }


class IssueIn(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(default="", max_length=2000)
    category: Literal["sidewalk", "lighting", "crossing", "trail", "park", "program", "event", "other"] = "other"
    location: str = Field(default="", max_length=250)


def new_code(db: Session) -> str:
    for _ in range(20):
        code = f"MHD-{random.randint(1000, 9999)}"
        if not db.scalar(select(m.Issue.id).where(m.Issue.code == code)):
            return code
    raise HTTPException(500, "Could not make a tracking number")


@app.post("/api/issues", status_code=201)
def create_issue(body: IssueIn, u: m.User = Depends(current_user), db: Session = Depends(get_db)):
    x = m.Issue(code=new_code(db), user_id=u.id, title=body.title.strip(), description=body.description,
                category=body.category, location=body.location, area=u.area)
    db.add(x)
    db.commit()
    return s.issue(db, x, u)


@app.get("/api/issues")
def my_issues(u: m.User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(m.Issue).where(m.Issue.user_id == u.id).order_by(m.Issue.created_at.desc())).all()
    return [s.issue(db, x, u) for x in rows]


@app.get("/api/issues/{code}")
def issue_detail(code: str, u: m.User = Depends(current_user), db: Session = Depends(get_db)):
    x = db.scalar(select(m.Issue).where(m.Issue.code == code))
    if not x or (x.user_id != u.id and not u.is_admin):
        raise HTTPException(404, "Suggestion not found")
    return s.issue(db, x, u)


class VoteIn(BaseModel):
    stance: Literal["support", "concern"]


@app.post("/api/ideas/{idea_id}/vote")
def vote(idea_id: int, body: VoteIn, u: m.User = Depends(current_user), db: Session = Depends(get_db)):
    i = db.get(m.Idea, idea_id)
    if not i:
        raise HTTPException(404, "Idea not found")
    row = db.scalar(select(m.IdeaVote).where(m.IdeaVote.idea_id == i.id, m.IdeaVote.user_id == u.id))
    if row and row.stance == body.stance:
        db.delete(row)  # same button again = take it back
    elif row:
        row.stance = body.stance
    else:
        db.add(m.IdeaVote(idea_id=i.id, user_id=u.id, stance=body.stance))
    db.commit()
    return s.idea(db, i, u, s.saved_set(db, u))


# ---------------------------------------------------------------- county dashboard (staff only)
def need_admin(u: m.User = Depends(current_user)):
    if not u.is_admin:
        raise HTTPException(403, "County staff only")
    return u


@app.get("/api/county/pulse")
def pulse(u=Depends(need_admin), db: Session = Depends(get_db)):
    by_area = dict(db.execute(select(m.Issue.area, func.count()).group_by(m.Issue.area)).all())
    by_cat = dict(db.execute(select(m.Issue.category, func.count()).group_by(m.Issue.category)).all())
    total = sum(by_area.values())
    open_n = db.scalar(select(func.count()).select_from(m.Issue).where(m.Issue.status != "Fixed")) or 0
    latest = db.scalars(select(m.Issue).order_by(m.Issue.created_at.desc(), m.Issue.id.desc()).limit(8)).all()
    recent = []
    for x in latest:  # newest suggestions first, so staff see what a resident just sent
        owner = db.get(m.User, x.user_id)
        recent.append({"code": x.code, "title": x.title, "description": x.description, "category": x.category,
                       "location": x.location, "area": x.area, "status": x.status,
                       "created_at": x.created_at.isoformat(), "by": owner.name if owner else "A resident"})
    return {
        "recent": recent,
        "total_reports": total, "open_reports": open_n,
        "by_area": [{"area": a, "count": by_area.get(a, 0)} for a in AREAS],
        "by_category": [{"category": c, "count": n} for c, n in sorted(by_cat.items(), key=lambda kv: -kv[1])],
        "ideas": [s.idea(db, i, u, set()) for i in db.scalars(select(m.Idea)).all()],
        "estimated_reach": db.scalar(select(func.count()).select_from(m.User)) or 0,
    }


class UpdateIn(BaseModel):
    title: str = Field(min_length=3, max_length=250)
    body: str = Field(default="", max_length=3000)
    category: Literal["sidewalk", "lighting", "crossing", "trail", "park", "program", "event", "other"] | None = None
    set_status: Literal["Seen", "Planned", "Fixed"] | None = None


@app.post("/api/county/updates", status_code=201)
def publish_update(body: UpdateIn, u=Depends(need_admin), db: Session = Depends(get_db)):
    a = m.Announcement(title=body.title, body=body.body, official=True, verified=False)
    db.add(a)
    changed = 0
    if body.category and body.set_status:
        rows = db.scalars(select(m.Issue).where(m.Issue.category == body.category, m.Issue.status != "Fixed")).all()
        for x in rows:
            x.status = body.set_status
        changed = len(rows)
    db.commit()
    return {"announcement": s.announcement(a), "reports_updated": changed}


# ---------------------------------------------------------------- MyStuff
class SaveIn(BaseModel):
    type: Literal["resource", "group", "event", "idea", "project", "meeting"]
    id: int


@app.put("/api/saved")
def save_item(body: SaveIn, u: m.User = Depends(current_user), db: Session = Depends(get_db)):
    if not db.get(s.SAVE_TYPES[body.type], body.id):
        raise HTTPException(404, "Nothing to save")
    exists = db.scalar(select(m.Saved).where(m.Saved.user_id == u.id, m.Saved.item_type == body.type, m.Saved.item_id == body.id))
    if not exists:
        db.add(m.Saved(user_id=u.id, item_type=body.type, item_id=body.id))
        db.commit()
    return {"saved": True}


@app.delete("/api/saved/{item_type}/{item_id}")
def unsave_item(item_type: str, item_id: int, u: m.User = Depends(current_user), db: Session = Depends(get_db)):
    row = db.scalar(select(m.Saved).where(m.Saved.user_id == u.id, m.Saved.item_type == item_type, m.Saved.item_id == item_id))
    if row:
        db.delete(row)
        db.commit()
    return {"saved": False}


@app.get("/api/mystuff")
def mystuff(u: m.User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(m.Saved).where(m.Saved.user_id == u.id).order_by(m.Saved.created_at.desc())).all()
    saved = {(r.item_type, r.item_id) for r in rows}
    out = {"communities": [], "projects": [], "events": [], "options": []}
    for r in rows:
        obj = db.get(s.SAVE_TYPES[r.item_type], r.item_id)
        if not obj:
            continue
        if r.item_type == "group":
            out["communities"].append(s.group(db, obj, u, saved))
        elif r.item_type == "idea":
            out["projects"].append(s.idea(db, obj, u, saved))
        elif r.item_type == "project":
            out["projects"].append(s.project(obj, saved))
        elif r.item_type == "event":
            out["events"].append(s.event(db, obj, u, saved))
        elif r.item_type == "meeting":
            out["events"].append(s.meeting(obj, saved))
        elif r.item_type == "resource":
            out["options"].append(s.resource(obj, saved))
    out["counts"] = {k: len(v) for k, v in out.items()}
    out["counts"]["all"] = sum(out["counts"].values())
    out["profile"] = s.user(u)
    return out


# ---------------------------------------------------------------- serve the built web app (optional)
_static = os.path.abspath(config.STATIC_DIR)
if os.path.isdir(_static):
    app.mount("/assets", StaticFiles(directory=os.path.join(_static, "assets")), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/"):
            raise HTTPException(404)
        f = os.path.join(_static, path)
        if path and os.path.isfile(f):
            return FileResponse(f)
        return FileResponse(os.path.join(_static, "index.html"))
