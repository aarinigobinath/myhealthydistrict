from datetime import datetime, timezone

from sqlalchemy import (
    ARRAY, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    tagline: Mapped[str] = mapped_column(String(200), default="")
    neighborhood: Mapped[str] = mapped_column(String(120), default="")
    area: Mapped[str] = mapped_column(String(30), default="Central")  # challenge area
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class AppMeta(Base):
    """Tiny key/value table; remembers which version of the sample data is loaded."""
    __tablename__ = "app_meta"
    key: Mapped[str] = mapped_column(String(60), primary_key=True)
    value: Mapped[str] = mapped_column(String(200), default="")


# ---------- Care ----------
class Topic(Base):
    __tablename__ = "topics"
    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(120))
    blurb: Mapped[str] = mapped_column(String(300), default="")
    icon: Mapped[str] = mapped_column(String(30), default="care")
    keywords: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    sort: Mapped[int] = mapped_column(Integer, default=0)
    options: Mapped[list["Option"]] = relationship(back_populates="topic", order_by="Option.sort")


class Option(Base):
    """A kind of help inside a topic, e.g. 'Remote learning options'."""
    __tablename__ = "options"
    id: Mapped[int] = mapped_column(primary_key=True)
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id"))
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(160))
    summary: Mapped[str] = mapped_column(Text, default="")
    keywords: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    layout: Mapped[str] = mapped_column(String(20), default="cards")  # cards | map
    sort: Mapped[int] = mapped_column(Integer, default=0)
    topic: Mapped[Topic] = relationship(back_populates="options")
    resources: Mapped[list["Resource"]] = relationship(back_populates="option", order_by="Resource.sort")


class Resource(Base):
    """A concrete thing someone can use: a trail, a program, a clinic."""
    __tablename__ = "resources"
    id: Mapped[int] = mapped_column(primary_key=True)
    option_id: Mapped[int] = mapped_column(ForeignKey("options.id"))
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    good_if: Mapped[str] = mapped_column(Text, default="")
    address: Mapped[str] = mapped_column(String(250), default="")
    phone: Mapped[str] = mapped_column(String(60), default="")
    hours: Mapped[str] = mapped_column(String(250), default="")
    url: Mapped[str] = mapped_column(String(500), default="")
    source_url: Mapped[str] = mapped_column(String(500), default="")
    map_query: Mapped[str] = mapped_column(String(300), default="")  # what Google Maps should search for
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    verified: Mapped[bool] = mapped_column(Boolean, default=True)  # False => show "Sample" tag
    sort: Mapped[int] = mapped_column(Integer, default=0)
    option: Mapped[Option] = relationship(back_populates="resources")


# ---------- People ----------
class Group(Base):
    __tablename__ = "groups"
    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160))
    blurb: Mapped[str] = mapped_column(Text, default="")
    next_meeting: Mapped[str] = mapped_column(String(120), default="")
    base_members: Mapped[int] = mapped_column(Integer, default=0)
    teen_safe: Mapped[bool] = mapped_column(Boolean, default=False)
    topic_slug: Mapped[str] = mapped_column(String(80), default="")
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)


class GroupMember(Base):
    __tablename__ = "group_members"
    __table_args__ = (UniqueConstraint("user_id", "group_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"))


class Event(Base):
    __tablename__ = "events"
    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    location: Mapped[str] = mapped_column(String(250), default="")
    blurb: Mapped[str] = mapped_column(Text, default="")
    base_going: Mapped[int] = mapped_column(Integer, default=0)
    source_url: Mapped[str] = mapped_column(String(500), default="")
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)


class Rsvp(Base):
    __tablename__ = "rsvps"
    __table_args__ = (UniqueConstraint("user_id", "event_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"))


class ChallengeArea(Base):
    __tablename__ = "challenge_areas"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(30), unique=True)
    base_miles: Mapped[float] = mapped_column(Float, default=0)
    goal_miles: Mapped[float] = mapped_column(Float, default=100)


class ChallengeLog(Base):
    __tablename__ = "challenge_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    miles: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


# ---------- Voice ----------
class Announcement(Base):
    __tablename__ = "announcements"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(250))
    body: Mapped[str] = mapped_column(Text, default="")
    source_url: Mapped[str] = mapped_column(String(500), default="")
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    official: Mapped[bool] = mapped_column(Boolean, default=False)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(40), default="Planning")
    summary: Mapped[str] = mapped_column(Text, default="")
    source_url: Mapped[str] = mapped_column(String(500), default="")
    verified: Mapped[bool] = mapped_column(Boolean, default=False)


class Meeting(Base):
    __tablename__ = "meetings"
    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    schedule: Mapped[str] = mapped_column(String(250), default="")
    location: Mapped[str] = mapped_column(String(250), default="")
    blurb: Mapped[str] = mapped_column(Text, default="")
    source_url: Mapped[str] = mapped_column(String(500), default="")
    verified: Mapped[bool] = mapped_column(Boolean, default=True)


class Idea(Base):
    __tablename__ = "ideas"
    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(40), default="Open")
    base_support: Mapped[int] = mapped_column(Integer, default=0)
    base_concerns: Mapped[int] = mapped_column(Integer, default=0)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)


class IdeaVote(Base):
    __tablename__ = "idea_votes"
    __table_args__ = (UniqueConstraint("user_id", "idea_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    idea_id: Mapped[int] = mapped_column(ForeignKey("ideas.id", ondelete="CASCADE"))
    stance: Mapped[str] = mapped_column(String(10))  # support | concern


class Issue(Base):
    __tablename__ = "issues"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(40), default="other")
    location: Mapped[str] = mapped_column(String(250), default="")
    area: Mapped[str] = mapped_column(String(30), default="Central")
    status: Mapped[str] = mapped_column(String(30), default="Sent")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    flags: Mapped[list["IssueFlag"]] = relationship(cascade="all, delete-orphan")


class IssueFlag(Base):
    """'Me too' – a neighbor confirming the same problem."""
    __tablename__ = "issue_flags"
    __table_args__ = (UniqueConstraint("user_id", "issue_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    issue_id: Mapped[int] = mapped_column(ForeignKey("issues.id", ondelete="CASCADE"))


# ---------- MyStuff ----------
class Saved(Base):
    __tablename__ = "saved_items"
    __table_args__ = (UniqueConstraint("user_id", "item_type", "item_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    item_type: Mapped[str] = mapped_column(String(20))  # resource|group|event|idea|project|meeting
    item_id: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
