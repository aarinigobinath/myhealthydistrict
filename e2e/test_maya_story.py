"""One long click-through that follows the storyboard: Act 1, Act 2, Act 3, then the county answers."""
import re
import uuid

from playwright.sync_api import expect

from conftest import sign_in


def test_signed_out_visitors_are_sent_to_login(page):
    page.goto(page.base + "/care")
    expect(page.get_by_role("heading", name="Sign in")).to_be_visible()


def test_bad_password_then_register_new_account(page):
    sign_in(page, "maya@example.com", "wrong-password-1")
    expect(page.get_by_role("alert")).to_contain_text("not right")
    page.get_by_role("link", name="Create an account").click()
    email = f"e2e-{uuid.uuid4().hex[:6]}@example.com"
    page.get_by_label("First name").fill("Riley")
    page.get_by_label("Email").fill(email)
    page.get_by_label(re.compile("Password")).fill("longenough1")
    page.get_by_label("Part of the county").select_option("North")
    page.get_by_role("button", name="Create account").click()
    expect(page.get_by_role("heading", name=re.compile("Hi Riley"))).to_be_visible()
    # a refresh keeps you signed in
    page.reload()
    expect(page.get_by_role("heading", name=re.compile("Hi Riley"))).to_be_visible()
    page.get_by_role("button", name="Sign out").click()
    expect(page.get_by_role("heading", name="Sign in")).to_be_visible()


def test_the_whole_story(page):
    # ---------- Act 1: describe a situation, see options
    sign_in(page, "maya@example.com", "MayaDemo2026!")
    expect(page.get_by_role("heading", name=re.compile("Hi Maya"))).to_be_visible()
    page.get_by_placeholder("Describe your situation").fill("I’m a high schooler, stuck in bed after knee surgery")
    page.get_by_role("button", name="Show my options").click()
    expect(page.get_by_role("heading", name="What’s available for you")).to_be_visible()
    expect(page.get_by_text(re.compile("Because you said"))).to_contain_text("surgery")
    page.get_by_role("link", name=re.compile("Remote learning options")).click()
    expect(page.get_by_role("heading", name="Remote learning options")).to_be_visible()
    cards = page.get_by_test_id("resource-card")
    assert cards.count() >= 3
    expect(page.get_by_text("Join your class by video")).to_have_count(0)  # that option was removed
    gavs = cards.filter(has_text="Georgia Virtual School (GAVS)")
    expect(gavs.get_by_role("link", name=re.compile("Official page"))).to_have_attribute("href", "https://gavs.geniussis.com/PublicStudentAdd.aspx")
    fva = cards.filter(has_text="Forsyth Virtual Academy")
    expect(fva.get_by_role("link", name=re.compile("Official page"))).to_have_attribute(
        "href", "https://ace.forsyth.k12.ga.us/forsyth-virtual-academy/our-program")
    gavs.get_by_role("button", name="Save to MyStuff").click()
    expect(gavs.get_by_role("button", name="Saved to MyStuff")).to_be_visible()

    # ---------- Act 2: Care tab, jogging
    page.get_by_role("link", name="Care", exact=True).click()
    page.get_by_placeholder("What do you want help with?").fill("I want to start jogging again")
    page.get_by_role("button", name="Search", exact=True).click()
    expect(page.get_by_text(re.compile("Because you said"))).to_contain_text("jogging")
    expect(page.get_by_test_id("topic-card")).to_have_count(1)  # only Move & Exercise: no Recovery & Rehab
    expect(page.get_by_text("Recovery & Rehab")).to_have_count(0)
    page.get_by_role("link", name=re.compile("Jogging track locator")).click()
    expect(page.get_by_role("heading", name="Jogging track locator")).to_be_visible()
    # a real Google Map, official Google Maps links and each park's own county page
    expect(page.get_by_title(re.compile("Google Map of Big Creek Greenway"))).to_have_attribute("src", re.compile(r"^https://maps\.google\.com/maps\?output=embed&z=14&q="))
    fowler = page.get_by_test_id("resource-card").filter(has=page.get_by_role("heading", name="Fowler Park", exact=True))
    expect(fowler.get_by_role("link", name=re.compile("Open in Google Maps"))).to_have_attribute("href", re.compile(r"^https://www\.google\.com/maps/search/\?api=1&query=Fowler"))
    expect(fowler.get_by_role("link", name=re.compile("Official page"))).to_have_attribute("href", "https://www.forsythco.com/locations/fowler-park/")
    page.get_by_role("button", name="Show Fowler Park on the map").click()
    expect(page.get_by_title("Google Map of Fowler Park")).to_be_visible()
    all_count = page.get_by_test_id("resource-card").count()
    page.get_by_role("button", name="Paved").click()
    expect(page.get_by_text("Big Creek Greenway", exact=True)).to_be_visible()
    page.wait_for_function(f"document.querySelectorAll('[data-testid=resource-card]').length < {all_count}")
    greenway = page.get_by_test_id("resource-card").filter(has_text="Big Creek Greenway").first
    greenway.get_by_role("button", name="Save to MyStuff").click()
    expect(greenway.get_by_role("button", name="Saved to MyStuff")).to_be_visible()

    # People: join a group, RSVP, log miles
    page.get_by_role("link", name="Find people to run with →").click()
    expect(page.get_by_role("heading", name="Find your people")).to_be_visible()
    runners = page.get_by_test_id("group-card").filter(has_text="Weekend Runners Club").first
    runners.get_by_role("button", name="Join").click()
    expect(runners.get_by_role("button", name="Joined ✓")).to_be_visible()
    runners.get_by_role("button", name="Save to MyStuff").click()
    cards_now = page.get_by_test_id("event-card")
    if cards_now.count():  # real events come and go with the calendar
        walk = cards_now.first
        walk.get_by_role("button", name=re.compile("I’m going")).click()
        expect(walk.get_by_role("button", name="I’m going ✓")).to_be_visible()
    expect(page.get_by_role("link", name=re.compile("full official county calendar"))).to_have_attribute(
        "href", "https://www.forsythco.com/calendar/?event_category=165")
    page.get_by_label("Log miles").fill("2.5")
    page.get_by_role("button", name="Add", exact=True).click()
    expect(page.get_by_text(re.compile("You’ve added 8.7 miles for West"))).to_be_visible()
    page.get_by_role("link", name=re.compile("Suggest it to the county")).click()

    # ---------- Act 3: make a suggestion, back an idea
    expect(page.get_by_role("heading", name="Make a suggestion")).to_be_visible()
    page.get_by_label("What’s your suggestion?").fill("No sidewalk to the park")
    page.get_by_label("Type").select_option("sidewalk")
    page.get_by_label(re.compile("Where")).fill("Near the park entrance")
    page.get_by_role("button", name="Send suggestion").click()
    expect(page.get_by_role("heading", name="Suggestion sent to Forsyth County")).to_be_visible()
    code = page.get_by_test_id("tracking-id").inner_text()
    assert re.fullmatch(r"MHD-\d{4}", code)
    page.get_by_role("link", name=re.compile("Back an idea")).click()
    idea = page.get_by_test_id("idea-card").filter(has_text="A safe walk to the park")
    idea.get_by_role("button", name="I support this").click()
    expect(idea.get_by_role("button", name="I support this")).to_have_attribute("aria-pressed", "true")
    idea.get_by_role("button", name="Save to MyStuff").click()

    # ---------- MyStuff shows everything
    page.get_by_role("link", name="MyStuff", exact=True).click()
    expect(page.get_by_role("heading", name="MyStuff")).to_be_visible()
    rows = page.get_by_test_id("saved-row")
    for text in ["Georgia Virtual School (GAVS)", "Big Creek Greenway", "Weekend Runners Club", "A safe walk to the park"]:
        expect(rows.filter(has_text=text)).to_have_count(1)
    page.get_by_role("button", name=re.compile(r"^Options")).click()
    expect(page.get_by_test_id("saved-row")).to_have_count(2)
    page.get_by_test_id("saved-row").filter(has_text="Big Creek Greenway").get_by_role("button", name="Saved to MyStuff").click()
    expect(page.get_by_test_id("saved-row")).to_have_count(1)
    page.get_by_role("button", name="Edit profile").click()
    page.get_by_label("Neighborhood").fill("Halcyon")
    page.get_by_role("button", name="Save", exact=True).click()
    expect(page.get_by_text(re.compile("Halcyon"))).to_be_visible()

    # ---------- County staff see the pattern and answer
    page.get_by_role("button", name="Sign out").click()
    sign_in(page, "county@example.com", "CountyDemo2026!")
    page.get_by_role("link", name="County", exact=True).click()
    expect(page.get_by_role("heading", name="District Pulse")).to_be_visible()
    assert int(page.get_by_test_id("total-reports").inner_text()) >= 75
    # the suggestion Maya just sent is visible to county staff
    expect(page.get_by_test_id("suggestion-row").filter(has_text="No sidewalk to the park").first).to_be_visible()
    page.get_by_label("Headline").fill("Sidewalk on [STREET NAME] approved for design")
    page.get_by_role("button", name="Publish official update").click()
    expect(page.get_by_role("status")).to_contain_text("Published")
    page.get_by_role("button", name="Sign out").click()

    # ---------- Maya comes back and sees "Planned"
    sign_in(page, "maya@example.com", "MayaDemo2026!")
    page.get_by_role("link", name="Voice", exact=True).click()
    expect(page.get_by_text("Sidewalk on [STREET NAME] approved for design").first).to_be_visible()
    page.get_by_role("link", name="My suggestions").click()
    tracker = page.get_by_test_id("tracker").filter(has_text=code)
    expect(tracker.locator(".step.done").last).to_have_text("Planned")


def test_voice_sentence_goes_to_voice_tab(page):
    sign_in(page, "maya@example.com", "MayaDemo2026!")
    page.get_by_placeholder("Describe your situation").fill("the road to the park has no sidewalk")
    page.get_by_role("button", name="Show my options").click()
    expect(page.get_by_role("heading", name="Your voice in Forsyth")).to_be_visible()
    page.get_by_role("link", name="Suggest this").click()
    expect(page.get_by_label("What’s your suggestion?")).to_have_value("the road to the park has no sidewalk")


def test_resident_cannot_open_county_dashboard(page):
    sign_in(page, "maya@example.com", "MayaDemo2026!")
    page.goto(page.base + "/county")
    expect(page.get_by_role("alert")).to_contain_text("County staff only")
    page.set_viewport_size({"width": 390, "height": 844})  # phone width still works, no sideways scroll
    page.goto(page.base + "/care")
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")


def test_header_stays_on_one_row_with_county_dropdown_and_ai_button_on_every_page(page):
    sign_in(page, "maya@example.com", "MayaDemo2026!")
    for width in (1280, 900, 640):
        page.set_viewport_size({"width": width, "height": 800})
        for path in ("/", "/care", "/people", "/voice", "/mystuff"):
            page.goto(page.base + path)
            expect(page.get_by_role("combobox", name="County")).to_have_value("Forsyth")
            fab = page.get_by_role("link", name=re.compile("AI Assistant"))
            expect(fab).to_be_visible()
            ys = page.evaluate(
                "[...document.querySelectorAll('.topbar-in a, .topbar-in select, .topbar-in button')].map(e => Math.round(e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2))")
            assert max(ys) - min(ys) < 14, (width, path, ys)
            assert page.evaluate("document.querySelector('.topbar').getBoundingClientRect().height") < 80
            assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), (width, path)
            box = fab.bounding_box()
            assert box["x"] > width * 0.6 and box["y"] > 400  # bottom right
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(page.base + "/people")
    page.get_by_role("combobox", name="County").select_option("Cherokee")
    expect(page.get_by_text("only has Forsyth County information")).to_be_visible()
    expect(page.get_by_role("heading", name="Find your people")).to_be_visible()


def test_jogging_page_has_a_google_map(page):
    sign_in(page, "maya@example.com", "MayaDemo2026!")
    page.get_by_placeholder("Describe your situation").fill("i want to start jogging again")
    page.get_by_role("button", name="Show my options").click()
    page.get_by_role("link", name=re.compile("Jogging track locator")).click()
    frame = page.get_by_title(re.compile("Google Map of Big Creek Greenway"))
    expect(frame).to_be_visible()
    assert "maps.google.com/maps" in frame.get_attribute("src") and "output=embed" in frame.get_attribute("src")
    expect(page.get_by_role("link", name=re.compile("Open in Google Maps")).first).to_be_visible()
    page.get_by_role("button", name="Show Fowler Park on the map").click()
    expect(page.get_by_title("Google Map of Fowler Park")).to_be_visible()


def test_ai_assistant_answers_like_search(page):
    sign_in(page, "maya@example.com", "MayaDemo2026!")
    expect(page.get_by_label("Main").get_by_role("link", name=re.compile("Assistant"))).to_have_count(0)
    page.get_by_role("link", name=re.compile("AI Assistant")).click()
    expect(page.get_by_role("heading", name="AI Assistant")).to_be_visible()
    box = page.get_by_role("textbox", name="Ask the AI Assistant")
    box.fill("I want to start jogging again")
    page.get_by_role("button", name="Ask", exact=True).click()
    log = page.get_by_role("log")
    expect(log.get_by_text(re.compile("You said"))).to_contain_text("jogging")
    expect(log.get_by_test_id("topic-card")).to_have_count(1)
    expect(log.get_by_role("link", name=re.compile("Jogging track locator"))).to_be_visible()
    expect(log.get_by_text("Forsyth Virtual Academy")).to_have_count(0)  # no school options for a jogging question
    box.fill("What is the county building?")
    page.get_by_role("button", name="Ask", exact=True).click()
    expect(log.get_by_test_id("project-card").first).to_be_visible()
    box.fill("What's happening this week?")
    page.get_by_role("button", name="Ask", exact=True).click()
    expect(log.get_by_test_id("event-card").first).to_be_visible()
    box.fill("I feel anxious and stressed")
    page.get_by_role("button", name="Ask", exact=True).click()
    expect(log.get_by_text(re.compile("call or text 988")).first).to_be_visible()
    # the same option opens the same page as the normal search
    log.get_by_role("link", name=re.compile("Open the full results page")).last.click()
    expect(page.get_by_role("heading", name="What’s available for you")).to_be_visible()
