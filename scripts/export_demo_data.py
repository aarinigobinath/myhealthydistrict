"""Rebuild frontend/src/demo/data.json (the preview-mode copy of the sample data) from the seeded database.

Run from the backend folder after seeding:
    MHD_DATABASE_URL=postgresql+psycopg2://mhd:mhd_dev_pw@localhost:5432/mhd_test python ../scripts/export_demo_data.py
"""
import json
import os
import sys
from collections import Counter

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from sqlalchemy import select  # noqa: E402

from app import models as m  # noqa: E402
from app.db import SessionLocal  # noqa: E402
from app.seed import SEED_VERSION  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), "..", "frontend", "src", "demo", "data.json")


def main():
    with SessionLocal() as db:
        topics = db.scalars(select(m.Topic).order_by(m.Topic.sort)).all()
        tslug = {t.id: t.slug for t in topics}
        options = db.scalars(select(m.Option).order_by(m.Option.sort)).all()
        oslug = {o.id: o.slug for o in options}
        data = {
            "seed_version": SEED_VERSION,
            "topics": [dict(id=t.id, slug=t.slug, title=t.title, blurb=t.blurb, icon=t.icon, keywords=t.keywords, sort=t.sort) for t in topics],
            "options": [dict(id=o.id, topic=tslug[o.topic_id], slug=o.slug, title=o.title, summary=o.summary, keywords=o.keywords, layout=o.layout, sort=o.sort) for o in options],
            "resources": [dict(id=r.id, option=oslug[r.option_id], slug=r.slug, title=r.title, description=r.description, good_if=r.good_if,
                               address=r.address, phone=r.phone, hours=r.hours, url=r.url, source_url=r.source_url, map_query=r.map_query,
                               tags=r.tags, lat=r.lat, lng=r.lng, verified=r.verified, sort=r.sort)
                          for r in db.scalars(select(m.Resource).order_by(m.Resource.sort)).all()],
            "groups": [dict(id=g.id, slug=g.slug, name=g.name, blurb=g.blurb, next_meeting=g.next_meeting, base_members=g.base_members,
                            teen_safe=g.teen_safe, tags=g.tags, verified=g.verified) for g in db.scalars(select(m.Group).order_by(m.Group.id)).all()],
            "events": [dict(id=e.id, slug=e.slug, title=e.title, starts_at=e.starts_at.isoformat(), location=e.location, blurb=e.blurb,
                            base_going=e.base_going, source_url=e.source_url, tags=e.tags, verified=e.verified)
                       for e in db.scalars(select(m.Event).order_by(m.Event.starts_at)).all()],
            "announcements": [dict(id=a.id, title=a.title, body=a.body, source_url=a.source_url, published_at=a.published_at.isoformat(),
                                   official=a.official, verified=a.verified) for a in db.scalars(select(m.Announcement).order_by(m.Announcement.id)).all()],
            "projects": [dict(id=p.id, slug=p.slug, title=p.title, status=p.status, summary=p.summary, source_url=p.source_url, verified=p.verified)
                         for p in db.scalars(select(m.Project).order_by(m.Project.id)).all()],
            "meetings": [dict(id=x.id, slug=x.slug, title=x.title, schedule=x.schedule, location=x.location, blurb=x.blurb, source_url=x.source_url,
                              verified=x.verified) for x in db.scalars(select(m.Meeting).order_by(m.Meeting.id)).all()],
            "ideas": [dict(id=i.id, slug=i.slug, title=i.title, body=i.body, status=i.status, base_support=i.base_support,
                           base_concerns=i.base_concerns, verified=i.verified) for i in db.scalars(select(m.Idea).order_by(m.Idea.id)).all()],
            "areas": [dict(name=a.name, base_miles=a.base_miles, goal_miles=a.goal_miles) for a in db.scalars(select(m.ChallengeArea).order_by(m.ChallengeArea.id)).all()],
        }
        c = Counter((i.area, i.category) for i in db.scalars(select(m.Issue)).all())
        data["issue_matrix"] = [dict(area=a, category=cat, n=n) for (a, cat), n in sorted(c.items())]
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print("wrote", os.path.relpath(OUT), {k: len(v) for k, v in data.items() if isinstance(v, list)})


main()
