"""Fill the database with Forsyth County, GA starter data.

Run:  python -m app.seed          (wipes and refills the tables)

Honesty rules for this data:
  * verified=True  -> taken from a public source listed in source_url (names, addresses, phones).
  * verified=False -> invented example for the demo. The web app shows a "Sample" tag on these.
  * Anything we could not confirm is written as a [BRACKETED PLACEHOLDER].
Phone numbers, hours and dates change - always call or check the source before relying on them.
"""
import random
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy.orm import Session

from . import models as m
from .db import Base, SessionLocal, engine
from .security import hash_password



class _EasternFallback(timezone.__mro__[1]):  # tzinfo
    """US Eastern time with daylight saving, used when Windows has no timezone database."""

    @staticmethod
    def _nth_sunday(year, month, n):
        d = datetime(year, month, 1)
        d += timedelta(days=(6 - d.weekday()) % 7)
        return d + timedelta(weeks=n - 1)

    def _is_dst(self, dt):
        naive = dt.replace(tzinfo=None)
        start = self._nth_sunday(naive.year, 3, 2).replace(hour=2)
        end = self._nth_sunday(naive.year, 11, 1).replace(hour=2)
        return start <= naive < end

    def utcoffset(self, dt):
        return timedelta(hours=-4 if self._is_dst(dt) else -5)

    def dst(self, dt):
        return timedelta(hours=1 if self._is_dst(dt) else 0)

    def tzname(self, dt):
        return "EDT" if self._is_dst(dt) else "EST"

    def fromutc(self, dt):
        naive = dt.replace(tzinfo=None)
        start = self._nth_sunday(naive.year, 3, 2).replace(hour=7)   # 2am EST = 07:00 UTC
        end = self._nth_sunday(naive.year, 11, 1).replace(hour=6)    # 2am EDT = 06:00 UTC
        off = -4 if start <= naive < end else -5
        return (naive + timedelta(hours=off)).replace(tzinfo=self)


try:
    ET = ZoneInfo("America/New_York")
except ZoneInfoNotFoundError:
    ET = _EasternFallback()
# Bump this whenever the sample data changes: the launcher re-loads the database when it differs.
SEED_VERSION = "2026-10-23-a"

PARK = "https://www.forsythco.com/locations/"   # official Forsyth County park pages: PARK + name + "/"
SRC_NAMI = "https://namifdl.org/events/"
SRC_CITY_CENTER = "https://discoverfoco.com/events/"
SRC_CALENDAR = "https://www.forsythco.com/calendar/?event_category=165"
SRC_OAR = "https://www.forsythco.com/government/major-construction-projects/old-atlanta-road-widening-phases-4-5/"
SRC_WATER = "https://www.forsythco.com/waterprojects"
SRC_CIP = "https://www.forsythco.com/Portals/0/DeptDoc/Finance/Budget/Capital%20Improvement%20Program/2026-2030%20Forsyth%20County%205%20year%20Capital%20Improvement%20Program.pdf"
SRC_FREEDOM = "https://www.forsythco.com/News/forsyth-county-to-dedicate-new-freedom-park-campus-and-provide-open-houses-to-public"
SRC_BENNETT = "https://hoodline.com/2026/04/forsyth-s-oldest-park-gets-25-8m-glow-up-as-bennett-reopens-big-for-families/"
SRC_MATT = "https://www.forsythco.com/news/2026/05/ribbon-cutting-ceremony-held-for-opening-of-matt-schoolhouse-community-building/"
SRC_WTP = "https://www.forsythco.com/news/2026/06/ribbon-cutting-ceremony-held-for-forsyth-county-water-treatment-plant-upgrades/"
SRC_SAWNEE = "https://www.forsythco.com/News/ribbon-cutting-ceremony-held-for-renovations-at-sawnee-mountain-preserve"
SRC_RRB = "https://www.forsythco.com/news/2024/06/video-ronald-reagan-boulevard-extension-now-open/"
SRC_AGING = "https://www.forsythco.com/news/2026/04/senior-services-hosting-22nd-annual-aging-well-expo-on-april-23/"
SRC_GAVS = "https://gavs.geniussis.com/PublicStudentAdd.aspx"
SRC_FVA = "https://ace.forsyth.k12.ga.us/forsyth-virtual-academy/our-program"
SRC_GREENWAY_PAGE = "https://www.forsythco.com/locations/big-creek-greenway/"


def et(y, mo, d, h, mi=0) -> datetime:
    """A Forsyth County (Eastern) wall-clock time, stored as UTC."""
    return datetime(y, mo, d, h, mi, tzinfo=ET).astimezone(timezone.utc)


SRC_GREENWAY_TRAILHEAD = "https://www.forsythco.com/News/big-creek-greenway-trailhead-reopens-after-renovations2"
SRC_GREENWAY_PHASE5 = "https://www.forsythco.com/News/ribbon-cutting-ceremony-set-for-big-creek-greenway-extension2"
SRC_DISCOVER = "https://discoverfoco.com/things-to-do/"
SRC_HEALTH = "http://forsythhd.com/"
SRC_FOOD = "https://ampleharvest.org/food-pantries/the-place-of-forsyth-food-pantry-427/"
SRC_LIBRARY = "https://forsythpl.org/sharon-forks-library"
SRC_NORTHSIDE = "https://www.northside.com/locations/northside-hospital-forsyth-outpatient-rehabilitation-services/1000"
SRC_SENIORS = "https://www.forsythco.com/seniors"
SRC_BOC = "https://www.forsythco.com/boc"
SRC_HHB_RULE = "https://www.law.cornell.edu/regulations/georgia/Ga-Comp-R-Regs-R-160-4-2-.31"
SRC_FCS_ONLINE = "https://alliance.forsyth.k12.ga.us/student-support/counseling-department/online-courses-hs-courses-only"


def next_dow(dow: int, hour: int, minute: int = 0, weeks_ahead: int = 0) -> datetime:
    """Next given weekday (Mon=0) at a local time, as UTC."""
    t = datetime.now(ET).replace(hour=hour, minute=minute, second=0, microsecond=0)
    t += timedelta(days=(dow - t.weekday()) % 7 or 7)
    t += timedelta(weeks=weeks_ahead)
    return t.astimezone(timezone.utc)


TOPICS = [
    # slug, title, blurb, icon, keywords
    ("move-exercise", "Move & Exercise", "Jogging tracks, classes, races and ways to stay active.", "run",
     ["jog", "jogging", "run", "running", "walk", "walking", "exercise", "fitness", "workout", "track", "trail", "bike", "gym", "active", "sports", "race", "5k", "stay active", "start again"]),
    ("preventive-care", "Preventive Care", "Shots, check-ups and screenings.", "care",
     ["flu", "shot", "shots", "vaccine", "immunization", "checkup", "check-up", "screening", "dental", "wic"]),
    ("recovery-rehab", "Recovery & Rehab", "Healing after surgery or injury, and keeping up while you do.", "bandage",
     ["surgery", "injury", "injured", "knee", "recover", "recovery", "rehab", "therapy", "cast", "crutches", "broken", "bed", "hospital", "sprain", "concussion"]),
    ("mental-wellbeing", "Mental Wellbeing", "Peer groups, counseling and crisis lines.", "smile",
     ["stress", "stressed", "anxious", "anxiety", "sad", "lonely", "isolated", "counseling", "counselor", "depress", "mental", "mood", "stuck", "overwhelmed", "crisis"]),
    ("nutrition-food", "Nutrition & Food", "Food help, healthy eating and WIC.", "apple",
     ["food", "eat", "eating", "meal", "hungry", "pantry", "groceries", "budget", "diet", "nutrition", "hydration", "wic"]),
    ("family-child", "Family & Child Health", "Care for kids, teens and new parents.", "people",
     ["baby", "newborn", "parent", "child", "kids", "toddler", "pregnant", "teen", "library", "school"]),
    ("seniors", "Seniors’ Health", "Programs for staying active and connected as you age.", "people",
     ["senior", "seniors", "elderly", "dad", "mom", "older", "retired", "aging", "grandparent", "72"]),
    ("living-with-condition", "Living with a Condition", "Support for diabetes, asthma and other long-term conditions.", "care",
     ["diabetes", "asthma", "chronic", "condition", "blood pressure", "heart", "cancer", "arthritis"]),
    ("parks-outdoors", "Parks & Outdoors", "County parks, preserves and lake access.", "pin",
     ["park", "parks", "outdoor", "outdoors", "nature", "hike", "hiking", "lake", "camp", "picnic", "playground", "dog"]),
    ("quit-recovery", "Quit & Recovery Support", "Help quitting smoking, vaping or substances.", "smile",
     ["quit", "smoking", "vaping", "alcohol", "addiction", "drugs", "sober"]),
    ("getting-to-care", "Getting to Care", "Rides, telehealth and finding the right clinic.", "car",
     ["ride", "appointment", "transportation", "telehealth", "insurance", "doctor", "clinic", "surgery", "hospital", "get to"]),
    ("groups-events", "Groups & Events", "Find neighbors to move, heal and learn with.", "people",
     ["group", "event", "club", "meetup", "class"]),
]

# option: (topic, slug, title, summary, keywords, layout)
OPTIONS = [
    ("recovery-rehab", "remote-learning", "Remote learning options", "Ways to keep up with school while you recover.", ["school", "class", "classes", "homework", "student", "high school", "high schooler", "teacher", "study", "exams", "grades", "homebound", "virtual", "learn", "learning", "surgery"], "cards"),
    ("recovery-rehab", "physical-therapy", "Physical therapy clinics", "Clinics that help you rebuild strength and movement.", ["physical therapy", "pt", "rehab", "knee", "sports medicine"], "cards"),
    ("recovery-rehab", "mobility-equipment", "Mobility equipment", "Crutches, braces and other gear.", ["crutches", "brace", "wheelchair", "equipment"], "cards"),
    ("recovery-rehab", "at-home-exercises", "At-home exercises", "Gentle routines you can do from bed or a chair.", ["exercises", "stretch", "stretching", "bed"], "cards"),
    ("mental-wellbeing", "crisis-and-peer-support", "Peer groups, counseling & crisis lines", "People to talk to, any time.", ["peer", "counseling", "988", "crisis", "talk"], "cards"),
    ("getting-to-care", "rides-and-telehealth", "Rides to appointments & telehealth", "Getting to a clinic, or seeing one from home.", ["ride", "rides", "telehealth", "appointment"], "cards"),
    ("preventive-care", "clinics-and-shots", "Health department clinic & shots", "County public health services.", ["clinic", "flu", "shot", "immunization", "vaccine"], "cards"),
    ("move-exercise", "jogging-track-locator", "Jogging track locator", "Paths and parks around Forsyth where you can run or walk.", ["jog", "jogging", "run", "running", "track", "trail", "path", "greenway"], "map"),
    ("move-exercise", "fitness-classes", "Fitness classes", "Classes and rec centers.", ["class", "classes", "gym", "fitness"], "cards"),
    ("move-exercise", "events-and-races", "Outdoor events and races", "Where to find walks, runs and races.", ["race", "5k", "event", "events"], "cards"),
    ("move-exercise", "adaptive-sports", "Adaptive sports", "Programs for every ability.", ["adaptive", "disability", "wheelchair"], "cards"),
    ("nutrition-food", "food-help", "Food pantries & WIC", "Free groceries and nutrition help.", ["pantry", "food", "hungry", "wic", "groceries"], "cards"),
    ("nutrition-food", "healthy-eating", "Healthy eating on a budget", "Meal ideas and tips.", ["budget", "meal", "recipes"], "cards"),
    ("family-child", "kids-and-teens", "Kids & teens", "Clinic, dental and library programs.", ["kids", "child", "teen", "library", "dental"], "cards"),
    ("seniors", "senior-programs", "Senior Services programs", "Classes, trips and support.", ["senior", "fitness", "older"], "cards"),
    ("living-with-condition", "managing-conditions", "Managing a long-term condition", "Care, therapy and support.", ["diabetes", "asthma", "chronic"], "cards"),
    ("parks-outdoors", "parks-directory", "County parks & preserves", "Where to play, hike and relax.", ["park", "parks", "hike", "lake", "playground"], "cards"),
    ("quit-recovery", "quit-lines", "Quit lines & recovery help", "Free coaching and crisis support.", ["quit", "smoking", "vaping", "alcohol"], "cards"),
]

# resource: (option_slug, slug, title, description, good_if, address, phone, hours, url, source, tags, verified)
R = []


def res(option, slug, title, description, good_if="", address="", phone="", hours="", url="", source="", tags=(), verified=True, map_query=""):
    R.append((option, slug, title, description, good_if, address, phone, hours, url, source, list(tags), verified, map_query))


# ---- Remote learning (Act 1)
res("remote-learning", "hospital-homebound-instruction", "A teacher comes to you (Hospital/Homebound)",
    "Georgia’s Hospital/Homebound (HHB) rule lets a student who will miss at least 10 school days (or has repeated 3-day absences from a chronic condition) get instruction at home. A treating physician signs a referral form, and the student must get at least 3 hours of instruction per school week. An adult must be present for each home session if the student is under 18.",
    "you can’t sit up for long or can’t travel, and your doctor says you can still learn at home.",
    phone="", url="", source=SRC_HHB_RULE, tags=["teacher-visits", "doctor-note"],
    hours="Ask your school counselor [COUNSELOR NAME] how Forsyth County Schools starts a referral.")
res("remote-learning", "georgia-virtual-school", "Georgia Virtual School (GAVS)",
    "Forsyth County Schools lists Georgia Virtual School as an online course option for high schoolers. You complete the FCS Online Course Application in Infinite Campus first, then create your GAVS student account on the official sign-up page and add courses (A courses in fall, B in spring). Courses are only approved after the FCS application is done.",
    "recovery may last a semester or more and you want to earn credit online at your own pace.",
    url=SRC_GAVS, source=SRC_FCS_ONLINE, tags=["online-credit", "semester"])
res("remote-learning", "forsyth-virtual-academy", "Forsyth Virtual Academy (FVA)",
    "A virtual program run by Forsyth County Schools’ Academies of Creative Education (ACE). It offers virtual courses for middle and high school (grades 6–12), with counseling, mentoring and getting-started guides. Registration windows are set each year, so check the page or ask your school counselor.",
    "you want a school-run online option and can check dates and courses with your counselor.",
    url=SRC_FVA, source=SRC_FVA, tags=["online-credit", "school-run"])
# ---- Physical therapy
res("physical-therapy", "northside-forsyth-outpatient-rehab", "Northside Hospital Forsyth Outpatient Rehabilitation",
    "Outpatient physical, occupational and speech therapy. Physical therapy services include sports medicine, orthopedics and spine, neuromuscular rehab, aquatic therapy, balance and gait analysis.",
    "you need a clinic for knee or sports-injury rehab.",
    address="2000 Howard Farm Drive, Suite 120, Cumming, GA 30041", phone="770-844-3650",
    hours="Monday–Friday, 8:00 a.m.–5:00 p.m.", url=SRC_NORTHSIDE, source=SRC_NORTHSIDE, tags=["physical-therapy", "sports-medicine"])
res("mobility-equipment", "equipment-loans", "Crutches, braces and loaner equipment",
    "Many surgeons’ offices and hospitals can tell you where to get or borrow mobility equipment. [Add a Forsyth County equipment loan program here after confirming it exists.]",
    "you were just told you’ll need crutches or a brace.", tags=["equipment"], verified=False)
res("at-home-exercises", "gentle-routine", "A gentle routine from your physical therapist",
    "Your PT or surgeon can give you safe exercises for the bed or a chair. Ask for a written or video plan before you leave the clinic.",
    "you are cleared for gentle movement but can’t get to a clinic yet.", tags=["at-home"], verified=False)
# ---- Mental wellbeing
res("crisis-and-peer-support", "988-lifeline", "988 Suicide & Crisis Lifeline",
    "Call or text 988, any time, for free and confidential support in a crisis. In an emergency, call 911.",
    "you or someone you know is in emotional distress.", phone="988", hours="24 hours a day, every day",
    url="https://988lifeline.org", source="https://988lifeline.org", tags=["crisis", "free"])
res("crisis-and-peer-support", "georgia-crisis-access-line", "Georgia Crisis & Access Line (GCAL)",
    "Georgia’s 24/7 line for behavioral health crisis help and referrals.",
    "you want help finding mental health or substance use services in Georgia.", phone="1-800-715-4225",
    hours="24 hours a day, every day", url="https://dbhdd.georgia.gov", source="https://dbhdd.georgia.gov", tags=["crisis", "free"])
res("crisis-and-peer-support", "school-counselor", "Your school counselor",
    "Counselors can talk with you about stress, school and next steps. [COUNSELOR NAME]",
    "school stress is part of what you’re feeling.", tags=["school"], verified=False)
# ---- Rides / telehealth
res("rides-and-telehealth", "rides-to-appointments", "Rides to appointments",
    "[Add a Forsyth County ride program here after confirming it exists and who it serves.] Ask your clinic whether it offers or arranges rides.",
    "you can’t drive after surgery.", tags=["rides"], verified=False)
res("rides-and-telehealth", "telehealth-visits", "Telehealth visits",
    "Ask your doctor’s office whether follow-up visits can be done by video.",
    "traveling is hard right now.", tags=["telehealth"], verified=False)
# ---- Health dept
res("clinics-and-shots", "health-department-immunizations", "Forsyth County Health Department (Clinical Services)",
    "Public health clinic with Child and Adolescent Health, Women’s Health, Children’s Dental Clinic, Adult Health, a Travel Clinic and WIC. Some services are by appointment only, so call first. Ask about flu and other shots.",
    "you want vaccines or a low-barrier public health clinic.", address="428 Canton Hwy, Cumming, GA 30040",
    phone="770-781-6900", hours="Mon, Wed, Thu 8–5; Tue 8–7; Fri 8–12 (closed 12:30–1 Mon–Thu). Closes some days each month, so call.",
    url=SRC_HEALTH, source=SRC_HEALTH, tags=["vaccines", "wic", "county"])
# ---- Jogging track locator (real parks/trails). url = the park's official Forsyth County page;
# map_query = what Google Maps searches for. Facts come from the county and Visit Forsyth pages.
res("jogging-track-locator", "big-creek-greenway", "Big Creek Greenway",
    "Forsyth’s flagship paved trail: just over 16.5 miles from Halcyon to Sawnee Mountain Preserve for walking, running and biking, with about one mile of boardwalk near Union Hill. Trailheads: Halcyon (6265 Cortland Walk), Union Hill (5259 Union Hill Rd), Fowler Park (4110 Carolene Way), Bethelview (5120 Bethelview Rd), Sawnee Mountain Preserve (4075 Spot Rd). A section from Fowler Park north to the Bethelview Trailhead has been closed for renovation since Feb. 25, 2026, so check the county page before you go. A roughly one-mile gap along SR 20 is planned to be connected with GDOT’s Canton Highway widening.",
    "you want a long, flat, mostly shaded run you can shorten whenever you need to.",
    address="Trailheads: Halcyon, Union Hill, Fowler Park, Bethelview, Sawnee", url=PARK + "big-creek-greenway/",
    source=SRC_GREENWAY_PHASE5, tags=["paved", "flat", "boardwalk"], map_query="Big Creek Greenway Fowler Park Trailhead, 4110 Carolene Way, Cumming, GA")
res("jogging-track-locator", "fowler-park", "Fowler Park",
    "County park with sports fields, a skate park, a dog park and trails; it is also a Big Creek Greenway trailhead.",
    "you want an easy first outing with parking and restrooms nearby.", address="4110 Carolene Way, Cumming, GA",
    url=PARK + "fowler-park/", source=SRC_DISCOVER, tags=["paved", "trail", "parking"], map_query="Fowler Park, 4110 Carolene Way, Cumming, GA")
res("jogging-track-locator", "central-park-recreation-center", "Central Park Recreation Center",
    "Recreation center with sports fields and disc golf, and home of Senior Services wellness programs.",
    "you want a rec center and fields in one place.", address="2300 Keith Bridge Rd, Cumming, GA",
    url=PARK + "central-park/", source=SRC_DISCOVER, tags=["rec-center", "fields"], map_query="Central Park, 2300 Keith Bridge Rd, Cumming, GA")
res("jogging-track-locator", "bennett-park", "Bennett Park",
    "The county’s oldest park, reopened in April 2026 after a $25.8 million renovation. It now has new paved and nature trails, plus turf fields, courts, a playground and a community building.",
    "you want a short paved loop at a newly renovated park.",
    address="6050 Burruss Mill Rd, Cumming, GA", url=PARK + "bennett-park/", source=SRC_BENNETT, tags=["paved", "trail"],
    map_query="Bennett Park, 6050 Burruss Mill Rd, Cumming, GA")
res("jogging-track-locator", "eagles-beak-park", "Eagle’s Beak Park",
    "A 1.25-mile easy paved loop, a little over a mile of dirt nature trail and a kayak launch on the Etowah River.",
    "you want a short, easy loop.", address="Cumming, GA (tap the map link for directions)", url=PARK + "eagles-beak-park/", source=SRC_DISCOVER,
    tags=["paved", "under-2-miles", "trail"], map_query="Eagle's Beak Park, Cumming, GA")
res("jogging-track-locator", "caney-creek-preserve", "Caney Creek Preserve",
    "A 1.2-mile easy wooded loop.", "you want a short, soft-surface walk or jog.", address="2755 Caney Rd, Cumming, GA",
    url=PARK + "caney-creek-preserve/", source=SRC_DISCOVER, tags=["under-2-miles", "trail"], map_query="Caney Creek Preserve, 2755 Caney Rd, Cumming, GA")
res("jogging-track-locator", "sharon-springs-park", "Sharon Springs Park",
    "Tennis, a paved trail and a playground.", "you want a paved path near other activities.", address="1950 Sharon Rd, Cumming, GA",
    url=PARK + "sharon-springs-park/", source=SRC_DISCOVER, tags=["paved"], map_query="Sharon Springs Park, 1950 Sharon Rd, Cumming, GA")
res("jogging-track-locator", "windermere-park", "Windermere Park",
    "A dog park, nature path and paved trail.", "you want a paved path and a quieter nature path.", address="3355 Windermere Pkwy, Cumming, GA",
    url=PARK + "windermere-park/", source=SRC_DISCOVER, tags=["paved", "trail"], map_query="Windermere Park, 3355 Windermere Pkwy, Cumming, GA")
res("jogging-track-locator", "ducktown-park", "Ducktown Park",
    "A pavilion, fitness playground and running path.", "you want a path plus outdoor fitness equipment.", address="5895 Heardsville Rd, Cumming, GA",
    url=PARK + "ducktown-park/", source=SRC_DISCOVER, tags=["running-path"], map_query="Ducktown Park, 5895 Heardsville Rd, Cumming, GA")
res("jogging-track-locator", "midway-park", "Midway Park",
    "Sports fields, tennis and a walking trail.", "you want an easy walking route.", address="5100 Post Rd, Cumming, GA",
    url=PARK + "midway-park/", source=SRC_DISCOVER, tags=["trail"], map_query="Midway Park, 5100 Post Rd, Cumming, GA")
res("jogging-track-locator", "sawnee-mountain-preserve", "Sawnee Mountain Preserve – Indian Seats Trail",
    "A 4-mile, moderate trail with about 500 feet of climbing to an overlook; the out-and-back from the visitor center is about 1.5 miles. Dogs are not allowed on the trails.",
    "you are further along and want hills and views.", address="4075 Spot Rd, Cumming, GA", url=PARK + "sawnee-mountain-preserve/", source=SRC_DISCOVER,
    tags=["hilly", "trail"], map_query="Sawnee Mountain Preserve, 4075 Spot Rd, Cumming, GA")
# ---- Fitness / events
res("fitness-classes", "senior-fitness-classes", "Senior Services fitness classes",
    "Fitness classes every weekday at no charge to members, plus art classes, lifelong learning, day trips and social groups.",
    "you or a family member is a senior who wants to stay active.", address="Sexton Hall, 2115 Chloe Rd, Cumming, GA 30041; Central Park, 2300 Keith Bridge Rd",
    phone="(770) 781-2178", url=SRC_SENIORS, source=SRC_SENIORS, tags=["seniors", "free-for-members"])
res("events-and-races", "parks-and-rec-events", "Forsyth County Parks & Recreation",
    "The county’s parks department posts activity guides and events. Check it for current races, walks and classes.",
    "you want to see what’s on this season.", url="https://parks.forsythco.com", source="https://parks.forsythco.com", tags=["events"])
res("adaptive-sports", "adaptive-programs", "Adaptive sports programs",
    "[Add an adaptive sports program here after confirming one in Forsyth County.] Ask Parks & Recreation what exists.",
    "you want to play sports with equipment or rules made for your body.", tags=["adaptive"], verified=False)
# ---- Food
res("food-help", "the-place-of-forsyth-food-pantry", "The Place of Forsyth – food pantry",
    "A nonprofit in Cumming serving the county since 1975. Client-choice food pantry; first-time visitors get an emergency bag of food and paperwork to register. The listing’s hours may be out of date, so call first.",
    "you need groceries this week.", address="2550 The Place Circle, Cumming, GA 30040", phone="770-887-1098",
    hours="Listed as Tue–Thu 9 a.m.–1 p.m. (call to confirm)", url="https://ampleharvest.org/food-pantries/the-place-of-forsyth-food-pantry-427/", source=SRC_FOOD,
    tags=["free", "groceries"])
res("food-help", "wic-health-department", "WIC at the Forsyth County Health Department",
    "Nutrition support for pregnant and new moms, babies and young children, offered at the county health department.",
    "you’re pregnant or caring for a child under 5.", address="428 Canton Hwy, Cumming, GA 30040", phone="770-781-6900",
    url=SRC_HEALTH, source=SRC_HEALTH, tags=["wic", "county"])
res("healthy-eating", "budget-meals", "Healthy meals on a budget",
    "[Add a local nutrition class or recipe resource here after confirming one.]", "you’re cooking for a family on a tight budget.", tags=["budget"], verified=False)
# ---- Kids/teens + seniors + conditions
res("kids-and-teens", "health-dept-child-health", "Child & Adolescent Health and Children’s Dental Clinic",
    "Offered through the Forsyth County Health Department. Some services are by appointment only.",
    "your child needs routine care or dental care.", address="428 Canton Hwy, Cumming, GA 30040", phone="770-781-6900",
    url=SRC_HEALTH, source=SRC_HEALTH, tags=["children", "dental"])
res("kids-and-teens", "sharon-forks-library", "Forsyth County Public Library – Sharon Forks Library",
    "Library programs, quiet study space and free events. Other branches: Cumming, Denmark, Hampton Park, Post Road, and a Bookmobile.",
    "you want a free place to study, read or join a program.", address="2820 Old Atlanta Road, Cumming, GA 30041",
    phone="770-781-9840, option 7", hours="Mon–Thu 9–9, Fri–Sat 10–5:30, Sun 1:30–5:30 (week of Oct 19, 2026)",
    url=SRC_LIBRARY, source=SRC_LIBRARY, tags=["library", "free"])
res("senior-programs", "senior-services", "Forsyth County Senior Services",
    "Two centers with fitness, art, lifelong learning, day trips, hikes and social groups.",
    "you or a parent wants to stay active and connected.", address="Sexton Hall, 2115 Chloe Rd, Cumming, GA 30041 · Central Park, 2300 Keith Bridge Rd",
    phone="(770) 781-2178", url=SRC_SENIORS, source=SRC_SENIORS, tags=["seniors"])
res("managing-conditions", "adult-health-clinic", "Adult Health at the county health department",
    "Adult health services at the county clinic. Call to ask what is available for your condition.",
    "you need a low-cost starting point for long-term care.", address="428 Canton Hwy, Cumming, GA 30040", phone="770-781-6900",
    url=SRC_HEALTH, source=SRC_HEALTH, tags=["adult"])
# ---- Parks
for slug, page, title, desc, addr, tags in [
    ("sawnee-mountain-preserve-park", "sawnee-mountain-preserve", "Sawnee Mountain Preserve", "963 acres of ridge and forest with hiking trails, a zipline and a climbing tower. Dogs are not allowed on the trails.", "4075 Spot Rd, Cumming, GA", ["hiking"]),
    ("charleston-park", "charleston-park", "Charleston Park", "Lake Lanier boat ramps and picnic areas; about 5.5 miles of rolling singletrack along the shoreline.", "5850 Charleston Park Rd, Cumming, GA", ["lake", "mountain-biking"]),
    ("haw-creek-park", "haw-creek-park", "Haw Creek Park", "Mountain bike trails.", "2205 Echols Rd, Cumming, GA", ["mountain-biking"]),
    ("matt-community-park", "matt-community-park", "Matt Community Park", "Mountain bike trails.", "6555 Wallace Tatum Rd, Cumming, GA", ["mountain-biking"]),
    ("coal-mountain-park", "coal-mountain-park", "Coal Mountain Park", "Ball fields, tennis, a walking trail and a dog park.", "3560 Settingdown Rd, Cumming, GA", ["dog-park"]),
    ("old-atlanta-park", "old-atlanta-park", "Old Atlanta Park", "A splash pad.", "810 Nichols Rd, Suwanee, GA", ["splash-pad"]),
    ("chattahoochee-pointe", "chattahoochee-pointe", "Chattahoochee Pointe", "Chattahoochee River park with disc golf.", "5790 Chattahoochee Pointe Dr, Suwanee, GA", ["river"]),
]:
    res("parks-directory", slug, title, desc, "", addr, url=PARK + page + "/", source=SRC_DISCOVER, tags=tags, map_query=f"{title}, {addr}")
# ---- Quit
res("quit-lines", "national-quitline", "1-800-QUIT-NOW",
    "Free coaching to help you quit smoking or vaping. Connects you to your state’s quit line.",
    "you want to quit tobacco or vaping.", phone="1-800-784-8669", url="https://smokefree.gov", source="https://smokefree.gov", tags=["free", "tobacco"])

GROUPS = [
    # slug, name, blurb, next_meeting, base_members, teen_safe, tags
    ("weekend-runners-club", "Weekend Runners Club", "Easy-pace group runs on the Big Creek Greenway. All paces welcome.", "Sun 7:30 AM", 85, False, ["running", "jogging", "greenway"]),
    ("forsyth-morning-walkers", "Forsyth Morning Walkers", "A friendly walking group that meets at local parks.", "Sat 9 AM", 127, False, ["walking", "morning", "seniors"]),
    ("recovery-buddies", "Recovery Buddies", "Teens getting back on their feet after injury or surgery. Moderated; no private messages between adults and teens.", "Wed 7 PM check-in (video)", 23, True, ["recovery", "surgery", "injury", "teens", "school"]),
    ("senior-fitness-friends", "Senior Fitness Friends", "Gentle strength and balance with neighbors.", "Weekdays 10 AM", 41, False, ["seniors", "fitness"]),
    ("forsyth-greenway-bikers", "Greenway Bikers", "Casual rides on Big Creek Greenway.", "Sat 8 AM", 58, False, ["biking", "greenway"]),
]


def build(db: Session):
    # ---- topics / options / resources
    tmap, omap = {}, {}
    for i, (slug, title, blurb, icon, kw) in enumerate(TOPICS):
        t = m.Topic(slug=slug, title=title, blurb=blurb, icon=icon, keywords=kw, sort=i)
        db.add(t)
        tmap[slug] = t
    db.flush()
    for i, (tslug, slug, title, summary, kw, layout) in enumerate(OPTIONS):
        o = m.Option(topic_id=tmap[tslug].id, slug=slug, title=title, summary=summary, keywords=kw, layout=layout, sort=i)
        db.add(o)
        omap[slug] = o
    db.flush()
    for i, (opt, slug, title, desc, good, addr, phone, hours, url, src, tags, ver, mq) in enumerate(R):
        db.add(m.Resource(option_id=omap[opt].id, slug=slug, title=title, description=desc, good_if=good,
                          address=addr, phone=phone, hours=hours, url=url, source_url=src, tags=tags, verified=ver, map_query=mq, sort=i))

    # ---- people
    for slug, name, blurb, nm, n, teen, tags in GROUPS:
        db.add(m.Group(slug=slug, name=name, blurb=blurb, next_meeting=nm, base_members=n, teen_safe=teen, tags=tags, verified=False))
    # Real, dated events (checked Oct. 22, 2026). Always confirm on the host's page: dates and times change.
    # The county's own calendar (SRC_CALENDAR) blocked our automatic reader, so these come from the pages
    # that could be read: NAMI Forsyth/Dawson/Lumpkin and the Cumming City Center calendar.
    db.add_all([
        m.Event(slug="jazzercise-lawn-oct-23", title="Jazzercise Move & Groove on the Lawn", starts_at=et(2026, 10, 23, 8, 30),
                location="Lou Sobh Amphitheater, Cumming City Center, 423 Canton Rd, Cumming", base_going=0,
                blurb="8:30–9:30 a.m. A morning Jazzercise class for all fitness levels; bring water. Repeats weekly on Fridays. Presented by Cumming City Center.",
                source_url="https://discoverfoco.com/event/friday-mood-jazzercise-move-groove-on-the-lawn/2026-10-23/", tags=["fitness", "exercise", "class", "outdoor"], verified=True),
        m.Event(slug="cumming-farmers-market-oct-24", title="Cumming Farmers Market", starts_at=et(2026, 10, 24, 7, 0),
                location="Cumming City Center, 423 Canton Rd, Cumming", base_going=0,
                blurb="7–11 a.m. Fresh local produce and food.", source_url="https://discoverfoco.com/event/cumming-farmers-market-at-cumming-city-center/2026-10-24/",
                tags=["food", "nutrition", "healthy eating", "market"], verified=True),
        m.Event(slug="yoga-on-the-green-oct-26", title="Monday Mood: Yoga on the Green", starts_at=et(2026, 10, 26, 18, 0),
                location="Lou Sobh Amphitheater, Cumming City Center, 423 Canton Rd, Cumming", base_going=0,
                blurb="6–7 p.m. Outdoor yoga class. Presented by Cumming City Center.", source_url="https://discoverfoco.com/event/monday-mood-yoga-on-the-green/2026-10-26/",
                tags=["yoga", "fitness", "stress", "wellness", "outdoor"], verified=True),
        m.Event(slug="nami-connection-oct-27", title="NAMI Connection Support Group", starts_at=et(2026, 10, 27, 18, 45),
                location="Forsyth County United Way, 240 Elm St, Cumming", base_going=0,
                blurb="6:45–8:15 p.m. In-person peer support group for mental health, run by NAMI Forsyth, Dawson, Lumpkin. Meets the 2nd and 4th Tuesday of each month. No reservation needed.",
                source_url="https://namifdl.org/event/nami-connection-support-group-meeting-in-person-4th-tuesday/2026-10-27/", tags=["mental health", "support group", "stress", "stressed", "anxiety", "anxious", "depression", "depressed", "peer"], verified=True),
        m.Event(slug="nami-family-oct-27", title="NAMI Family Support Group", starts_at=et(2026, 10, 27, 18, 45),
                location="Forsyth County United Way, 240 Elm St, Cumming", base_going=0,
                blurb="6:45–8:15 p.m. In-person group for families and friends of someone with a mental health condition. 2nd and 4th Tuesdays. Run by NAMI Forsyth, Dawson, Lumpkin.",
                source_url="https://namifdl.org/event/nami-family-support-group-meeting-in-cumming-in-person-4th-tuesday/2026-10-27/", tags=["mental health", "support group", "family", "parent"], verified=True),
        m.Event(slug="nami-connection-nov-10", title="NAMI Connection Support Group", starts_at=et(2026, 11, 10, 18, 45),
                location="Forsyth County United Way, 240 Elm St, Cumming", base_going=0,
                blurb="6:45–8:15 p.m. In-person peer support group for mental health. 2nd and 4th Tuesdays. Run by NAMI Forsyth, Dawson, Lumpkin.",
                source_url="https://namifdl.org/event/nami-connection-support-group-meeting-in-person-2nd-tuesday/2026-11-10/", tags=["mental health", "support group", "stress", "stressed", "anxiety", "anxious", "depression", "depressed", "peer"], verified=True),
        m.Event(slug="nami-family-nov-10", title="NAMI Family Support Group", starts_at=et(2026, 11, 10, 18, 45),
                location="Forsyth County United Way, 240 Elm St, Cumming", base_going=0,
                blurb="6:45–8:15 p.m. In-person group for families and friends of someone with a mental health condition. Run by NAMI Forsyth, Dawson, Lumpkin.",
                source_url="https://namifdl.org/event/nami-family-support-group-meeting-in-cumming-in-person-2nd-tuesday/2026-11-10/", tags=["mental health", "support group", "family", "parent"], verified=True),
    ])
    for name, miles in [("North", 82), ("West", 69.8), ("Central", 64), ("South", 59)]:
        db.add(m.ChallengeArea(name=name, base_miles=miles, goal_miles=100))

    # ---- voice
    d_ = lambda y, mo, d: datetime(y, mo, d, 16, 0, tzinfo=timezone.utc)
    db.add_all([
        m.Announcement(title="Water treatment plant upgrades celebrated with a ribbon cutting (June 2026)",
                       body="Forsyth County held a ribbon-cutting ceremony for upgrades to the county’s water treatment plant.",
                       source_url=SRC_WTP, published_at=d_(2026, 6, 15), official=True, verified=True),
        m.Announcement(title="Matt Schoolhouse Community Building opens (May 2026)",
                       body="Forsyth County held a ribbon-cutting ceremony for the opening of the Matt Schoolhouse Community Building.",
                       source_url=SRC_MATT, published_at=d_(2026, 5, 15), official=True, verified=True),
        m.Announcement(title="Bennett Park reopens after a $25.8 million renovation (April 2026)",
                       body="The county’s oldest park reopened with two turf fields, three ball fields, two basketball courts, a playground, a community building, expanded parking and new paved and nature trails.",
                       source_url=SRC_BENNETT, published_at=d_(2026, 4, 30), official=True, verified=True),
        m.Announcement(title="New county administration campus at Freedom Park opens (March 2026)",
                       body="Open houses were held March 18 and 21, and county offices moved to 2435 Freedom Parkway on March 30. The campus also has a one-mile paved multi-use trail and a nature trail open to the public.",
                       source_url=SRC_FREEDOM, published_at=d_(2026, 3, 18), official=True, verified=True),
    ])
    db.add_all([
        m.Project(slug="greenway-renovation", title="Big Creek Greenway renovation (Fowler Park to Bethelview)", status="In progress",
                  summary="A section of the Greenway from Fowler Park north to the Bethelview Trailhead has been temporarily closed since Feb. 25, 2026 as the next renovation phase began. Check the county page for reopening news.",
                  source_url=SRC_GREENWAY_PAGE, verified=True),
        m.Project(slug="old-atlanta-road-widening", title="Old Atlanta Road widening, Phases 4 and 5", status="In progress",
                  summary="A county road-widening project. The county’s Capital Projects team posts progress updates and what drivers should expect.",
                  source_url=SRC_OAR, verified=True),
        m.Project(slug="lake-lanier-water-projects", title="Lake Lanier water intake and return flow projects", status="In progress",
                  summary="Work to bring the county closer to water independence, including return-flow pipeline construction at Sanders Road and Buford Dam Road, where lane closures were expected through March 2026.",
                  source_url=SRC_WATER, verified=True),
        m.Project(slug="greenway-sr20-gap", title="Close the ~1-mile Big Creek Greenway gap along SR 20", status="Planned with GDOT widening",
                  summary="A roughly one-mile segment parallel to SR 20 will connect the existing portions as part of GDOT’s planned Canton Highway widening.",
                  source_url=SRC_GREENWAY_PHASE5, verified=True),
        m.Project(slug="capital-improvement-program", title="Five-year Capital Improvement Program, 2026–2030", status="Plan published",
                  summary="The county’s five-year list of planned roads, parks, buildings and water projects.",
                  source_url=SRC_CIP, verified=True),
        m.Project(slug="water-treatment-plant-upgrades", title="Water treatment plant upgrades", status="Completed · June 2026",
                  summary="Upgrades to the county’s water treatment plant were celebrated with a ribbon cutting.", source_url=SRC_WTP, verified=True),
        m.Project(slug="matt-schoolhouse-community-building", title="Matt Schoolhouse Community Building", status="Completed · May 2026",
                  summary="A new community building, opened with a ribbon-cutting ceremony.", source_url=SRC_MATT, verified=True),
        m.Project(slug="bennett-park-renovation", title="Bennett Park renovation", status="Completed · April 2026",
                  summary="$25.8 million renovation of the county’s oldest park: turf and ball fields, courts, playground, community building, parking and new paved and nature trails.",
                  source_url=SRC_BENNETT, verified=True),
        m.Project(slug="freedom-park-campus", title="Freedom Park county administration campus", status="Completed · March 2026",
                  summary="A 135,000-square-foot administration building at 2435 Freedom Parkway, with a one-mile paved multi-use trail and a nature trail open to the public.",
                  source_url=SRC_FREEDOM, verified=True),
        m.Project(slug="sawnee-mountain-preserve-renovation", title="Sawnee Mountain Preserve renovation (Phase 4A)", status="Completed · December 2024",
                  summary="About $3 million for 50 more parking spaces, refreshed visitor center exhibits, new trail signs and maps, pavilions and a new walkway to the Big Creek Greenway.",
                  source_url=SRC_SAWNEE, verified=True),
        m.Project(slug="ronald-reagan-boulevard-extension", title="Ronald Reagan Boulevard extension", status="Completed · June 2024",
                  summary="The extension of Ronald Reagan Boulevard is open to traffic.", source_url=SRC_RRB, verified=True),
    ])
    db.add_all([
        m.Meeting(slug="board-of-commissioners", title="Board of Commissioners regular meeting",
                  schedule="First and third Thursdays, 5:00 p.m. (public hearings with the first-Thursday meeting)",
                  location="Commissioners’ Meeting Room, Suite 220, County Administration Building, 110 East Main Street, Cumming",
                  blurb="Open to the public. Watch online, or on TV Forsyth (Comcast 23, AT&T 99).", source_url=SRC_BOC, verified=True),
        m.Meeting(slug="boc-work-sessions", title="Board of Commissioners work session",
                  schedule="Second and fourth Tuesdays, 2:00 p.m.", location="Commissioners’ Conference Room, Suite 210, 110 East Main Street, Cumming",
                  blurb="Same building as regular meetings.", source_url=SRC_BOC, verified=True),
        m.Meeting(slug="board-of-health", title="Board of Health quarterly meeting",
                  schedule="2026: Jan 8, Apr 9, Jul 9, Oct 8 at 5:00 p.m.", location="Conference room, Forsyth County Health Department, 428 Canton Hwy",
                  blurb="Check forsythhd.com for next year’s dates.", source_url=SRC_HEALTH, verified=True),
        m.Meeting(slug="parks-trails-forum", title="Parks & Trails Planning Forum", schedule="[DATE] · sample",
                  location="[LOCATION]", blurb="Sample forum for the demo.", source_url="", verified=False),
    ])
    db.add_all([
        m.Idea(slug="safe-walk-to-the-park", title="A safe walk to the park",
               body="Add a sidewalk and lit crossing on [STREET NAME] so kids and neighbors can walk to the park.",
               status="Open", base_support=192, base_concerns=19, verified=False),
        m.Idea(slug="shade-and-water-on-greenway", title="Shade and water stops on the Greenway",
               body="More benches, shade and drinking fountains for long walks and runs.", status="Open", base_support=88, base_concerns=6, verified=False),
        m.Idea(slug="teen-recovery-network", title="School-to-home learning help for long recoveries",
               body="A county-wide way for students out for weeks to join class and get tutoring.", status="Open", base_support=61, base_concerns=3, verified=False),
    ])

    # ---- users
    maya = m.User(email="maya@example.com", name="Maya", password_hash=hash_password("MayaDemo2026!"),
                  tagline="Runner · back from injury", neighborhood="[YOUR NEIGHBORHOOD]", area="West")
    county = m.User(email="county@example.com", name="County Demo Staff", password_hash=hash_password("CountyDemo2026!"),
                    tagline="Demo county staff account", area="Central", is_admin=True)
    neighbor = m.User(email="neighbor@example.com", name="Sample Neighbor", password_hash=hash_password("NeighborDemo2026!"), area="West")
    db.add_all([maya, county, neighbor])
    db.flush()
    db.add(m.ChallengeLog(user_id=maya.id, miles=6.2))
    rnd = random.Random(42)
    plan = {"West": [("sidewalk", 24), ("lighting", 9), ("crossing", 5)],
            "North": [("trail", 6), ("park", 6), ("program", 4)],
            "Central": [("sidewalk", 7), ("lighting", 5), ("other", 3), ("event", 3)],
            "South": [("park", 5), ("other", 4), ("program", 3)]}
    # Sample suggestions from neighbors (health programs, events and places), shown to county staff as counts.
    titles = {"sidewalk": "Add a public running track or walking loop", "lighting": "Light the Greenway for evening runners",
              "crossing": "Safer crossing to the park", "trail": "Extend the Greenway trail",
              "park": "Add fitness stations at the park", "program": "Start a veterans wellness program",
              "event": "Hold a cancer awareness rally", "other": "Free weekend health screenings"}
    n = 1000
    for area, cats in plan.items():
        for cat, count in cats:
            for _ in range(count):
                n += rnd.randint(1, 7)
                db.add(m.Issue(code=f"MHD-{n}", user_id=neighbor.id, title=titles[cat], category=cat,
                               location="[PARK OR STREET NAME]", area=area, status="Sent"))
    # Examples for "My suggestions" when signed in as Maya.
    for code, title, desc, cat, where, status in [
        ("MHD-9101", "Add a running track at Central Park", "A 400-meter track would give runners and walkers a safe, even surface.", "park", "Central Park", "Seen"),
        ("MHD-9102", "Start a veterans wellness program", "Peer walks, a monthly health check day, and links to care for local veterans.", "program", "Forsyth County", "Sent"),
        ("MHD-9103", "Hold a cancer awareness rally", "A community walk with screening information and survivor stories.", "event", "Central Park", "Planned"),
    ]:
        db.add(m.Issue(code=code, user_id=maya.id, title=title, description=desc, category=cat, location=where,
                       area=maya.area, status=status))
    db.commit()


def reset_and_seed():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        build(db)
        db.add(m.AppMeta(key="seed_version", value=SEED_VERSION))
        db.commit()


def ensure_current() -> bool:
    """Load the sample data if the database is empty or holds an older version. Returns True if it reloaded."""
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        have = db.get(m.AppMeta, "seed_version")
        if have is not None and have.value == SEED_VERSION:
            return False
    reset_and_seed()
    return True


if __name__ == "__main__":
    reset_and_seed()
    print("Seeded Forsyth County sample data.")
