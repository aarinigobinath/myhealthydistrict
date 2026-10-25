"""Turn database rows into the JSON the web app expects."""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import models as m

SAVE_TYPES = {
    "resource": m.Resource,
    "group": m.Group,
    "event": m.Event,
    "idea": m.Idea,
    "project": m.Project,
    "meeting": m.Meeting,
}


def saved_set(db: Session, user) -> set[tuple[str, int]]:
    if not user:
        return set()
    rows = db.execute(select(m.Saved.item_type, m.Saved.item_id).where(m.Saved.user_id == user.id)).all()
    return {(t, i) for t, i in rows}


def resource(r: m.Resource, saved: set) -> dict:
    return {
        "type": "resource", "id": r.id, "slug": r.slug, "title": r.title,
        "description": r.description, "good_if": r.good_if, "address": r.address,
        "phone": r.phone, "hours": r.hours, "url": r.url, "source_url": r.source_url,
        "map_query": r.map_query, "tags": r.tags or [], "lat": r.lat, "lng": r.lng, "sample": not r.verified,
        "option_slug": r.option.slug if r.option else None,
        "saved": ("resource", r.id) in saved,
    }


def option_brief(o: m.Option) -> dict:
    return {"slug": o.slug, "title": o.title, "summary": o.summary, "layout": o.layout}


def topic(t: m.Topic, with_options=True) -> dict:
    d = {"slug": t.slug, "title": t.title, "blurb": t.blurb, "icon": t.icon}
    if with_options:
        d["options"] = [option_brief(o) for o in t.options]
    return d


def group(db: Session, g: m.Group, user, saved: set) -> dict:
    n = db.scalar(select(func.count()).select_from(m.GroupMember).where(m.GroupMember.group_id == g.id)) or 0
    joined = False
    if user:
        joined = db.scalar(select(m.GroupMember.id).where(
            m.GroupMember.group_id == g.id, m.GroupMember.user_id == user.id)) is not None
    return {
        "type": "group", "id": g.id, "slug": g.slug, "name": g.name, "blurb": g.blurb,
        "next_meeting": g.next_meeting, "members": g.base_members + n, "teen_safe": g.teen_safe,
        "tags": g.tags or [], "sample": not g.verified, "joined": joined,
        "saved": ("group", g.id) in saved,
    }


def event(db: Session, e: m.Event, user, saved: set) -> dict:
    n = db.scalar(select(func.count()).select_from(m.Rsvp).where(m.Rsvp.event_id == e.id)) or 0
    going = False
    if user:
        going = db.scalar(select(m.Rsvp.id).where(m.Rsvp.event_id == e.id, m.Rsvp.user_id == user.id)) is not None
    return {
        "type": "event", "id": e.id, "slug": e.slug, "title": e.title,
        "starts_at": e.starts_at.isoformat(), "location": e.location, "blurb": e.blurb,
        "going_count": e.base_going + n, "going": going, "source_url": e.source_url,
        "tags": e.tags or [], "sample": not e.verified, "saved": ("event", e.id) in saved,
    }


def idea(db: Session, i: m.Idea, user, saved: set) -> dict:
    rows = dict(db.execute(select(m.IdeaVote.stance, func.count()).where(m.IdeaVote.idea_id == i.id)
                           .group_by(m.IdeaVote.stance)).all())
    sup = i.base_support + rows.get("support", 0)
    con = i.base_concerns + rows.get("concern", 0)
    mine = None
    if user:
        mine = db.scalar(select(m.IdeaVote.stance).where(m.IdeaVote.idea_id == i.id, m.IdeaVote.user_id == user.id))
    total = sup + con
    return {
        "type": "idea", "id": i.id, "slug": i.slug, "title": i.title, "body": i.body,
        "status": i.status, "support": sup, "concerns": con, "responses": total,
        "support_pct": round(100 * sup / total) if total else 0, "my_vote": mine,
        "sample": not i.verified, "saved": ("idea", i.id) in saved,
    }


def project(p: m.Project, saved: set) -> dict:
    return {"type": "project", "id": p.id, "slug": p.slug, "title": p.title, "status": p.status,
            "summary": p.summary, "source_url": p.source_url, "sample": not p.verified,
            "saved": ("project", p.id) in saved}


def meeting(x: m.Meeting, saved: set) -> dict:
    return {"type": "meeting", "id": x.id, "slug": x.slug, "title": x.title, "schedule": x.schedule,
            "location": x.location, "blurb": x.blurb, "source_url": x.source_url,
            "sample": not x.verified, "saved": ("meeting", x.id) in saved}


def announcement(a: m.Announcement) -> dict:
    return {"id": a.id, "title": a.title, "body": a.body, "source_url": a.source_url,
            "published_at": a.published_at.isoformat(), "official": a.official, "sample": not a.verified}


STATUS_STEPS = ["Sent", "Seen", "Planned", "Fixed"]


def issue(db: Session, x: m.Issue, user=None) -> dict:
    flags = db.scalar(select(func.count()).select_from(m.IssueFlag).where(m.IssueFlag.issue_id == x.id)) or 0
    similar = db.scalar(select(func.count()).select_from(m.Issue).where(
        m.Issue.area == x.area, m.Issue.category == x.category)) or 0
    mine_flag = False
    if user:
        mine_flag = db.scalar(select(m.IssueFlag.id).where(
            m.IssueFlag.issue_id == x.id, m.IssueFlag.user_id == user.id)) is not None
    return {
        "code": x.code, "title": x.title, "description": x.description, "category": x.category,
        "location": x.location, "area": x.area, "status": x.status, "steps": STATUS_STEPS,
        "step_index": STATUS_STEPS.index(x.status) if x.status in STATUS_STEPS else 0,
        "created_at": x.created_at.isoformat(), "flag_count": flags, "similar_count": similar,
        "i_flagged": mine_flag,
    }


def user(u: m.User) -> dict:
    return {"id": u.id, "email": u.email, "name": u.name, "tagline": u.tagline,
            "neighborhood": u.neighborhood, "area": u.area, "is_admin": u.is_admin}
