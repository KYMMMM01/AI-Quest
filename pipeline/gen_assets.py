# 나르미의 입찰 도장 그림 일괄 생성 (Codex exec, 3개 동시)
import subprocess, os, sys, json, concurrent.futures as cf, time

CODEX = os.path.expandvars(r"%LOCALAPPDATA%\OpenAI\Codex\bin\5449c1f0f26f1f98\codex.exe")
ROOT = r"C:\Project\AI-Quest"
OUT = os.path.join(ROOT, "assets_src", "gen")
PROMPTS = os.path.join(ROOT, "assets_src", "prompts")
REF_MASCOT = r"D:\기타\공모전\에셋\조달청 나르미와 달이 3D.png"
REF_STYLE = os.path.join(ROOT, "assets_src", "style_test", "style_test_office_pair.png")

STYLE = """Art direction (apply strictly): soft 3D clay render, matte clay material, rounded chunky shapes, soft studio lighting, gentle soft shadows, bright pastel palette with a clean blue accent (#1F4E9E), friendly and cheerful, same look as the attached reference images (official mascots and an approved style test). Strict rules: no text, no letters, no numbers, no logos, no watermarks, no signatures, no frames or borders, nothing cut off at the edges, do not draw the mascots unless asked, do not imitate any existing game's art."""

PAIR = """Layout: one landscape image 1536x1024, split into exactly two equal side-by-side panels with a thin white gap between them. Each panel must fill the full image height (no empty white bands above or below). Both panels use the exact same camera angle and composition; only the described differences change."""

ICON = """Layout: an even grid on a fully transparent background (PNG alpha). If transparency is impossible, use a flat pure white #FFFFFF background with no shadows on the background. Every item is centered in its own grid cell, the same size, separated by wide empty space so cells can be cut apart cleanly, and nothing touches a cell edge."""

JOBS = {
 "bg_game": f"""{STYLE}
Image: 1536x1024 landscape background for the main play screen. A bright, clean, modern public-office workspace seen from a slightly elevated front angle, softly blurred (shallow depth of field) so UI can sit on top: light blue and cream walls, a large window with sky, a few plants, shelves. Keep the large central area and the bottom area calm and low-detail. No people, no screens with content.""",
 "bg_title": f"""{STYLE}
Image: 1536x1024 landscape title background. A cute clay diorama of a small friendly town: an elementary school, a fire station, a public health center, a library and a district office building, connected by gentle roads with small delivery trucks carrying boxes between them, blue sky with soft clouds. Leave the upper-middle third of the image open sky for a title, and leave the lower-left and lower-right corners calm for characters.""",
 "agencies": f"""{STYLE}
{ICON}
Image: 1024x1024, a 2x2 grid of four small isolated clay buildings, front three-quarter view, same scale: top-left an elementary school with a small clock tower and flag pole, top-right a red fire station with a garage door, bottom-left a public health center with a green cross shape on a white wall (cross shape only, no text), bottom-right a district office building with columns and a blue roof.""",
 "office_pair_b": f"""{STYLE}
{PAIR}
Subject: a small company's office room, different from the reference style test (different furniture layout and colors: mint green and cream).
LEFT panel: busy and tidy, a long shared desk with two laptops, a whiteboard with blank colored sticky notes, a shelf of boxes and binders, plants, warm light. Active and trustworthy. No people.
RIGHT panel: the same room empty and abandoned: bare desk, empty shelf, very large obvious cobwebs in the corners, big grey dust clouds on the floor, and a large blank paper sign taped to the wall covering about a quarter of the panel (the sign is blank, no letters). The emptiness must be obvious even as a tiny thumbnail.""",
 "office_pair_c": f"""{STYLE}
{PAIR}
Subject: a small workshop-office of a manufacturing company, different from the other offices (peach and light blue colors).
LEFT panel: active and tidy: a work table with tools and small product prototypes, a computer desk, labeled-looking bins (no actual text), a big window, plants.
RIGHT panel: the same room empty and abandoned: bare tables, very large obvious cobwebs, big grey dust clouds, and a large blank paper sign taped to the wall covering about a quarter of the panel (blank, no letters). Obvious even as a thumbnail.""",
 "office_single_d": f"""{STYLE}
Image: 1024x1024 square. A cozy, tidy small office of a startup company: two desks facing each other with computers, a bookshelf, a sofa corner, many plants, a big bright window, lavender and cream colors. Active and trustworthy. No people. The room fills the whole image with no white bands.""",
 "delivery_pair": f"""{STYLE}
{PAIR}
Subject: delivery inspection scenes. In each panel, one closed cardboard delivery box sits on the floor at the lower-left area, turned so a LARGE BLANK WHITE SQUARE LABEL on its front faces the camera directly; the blank label must be flat, clearly visible, about one fifth of the panel height, and completely empty (no marks). The right half of each panel's floor is left open and empty (an item will be placed there later).
LEFT panel: an elementary school hallway with lockers and children's drawings shapes (no text).
RIGHT panel: a public health center room with a bed and a white cabinet.
These two panels are different rooms, but the box is at the same position and size in both.""",
 "site_pair_a": f"""{STYLE}
{PAIR}
Subject: a construction site of a small public library building, clay style. One clay construction worker stands large in the center foreground on a raised scaffold platform, facing the camera.
LEFT panel (safe): the worker wears a bright fluorescent orange hard hat and a safety vest, the scaffold has yellow guardrails, safety net on the building.
RIGHT panel (unsafe): identical scene, but the worker has NO hard hat (bare head with dark hair, clearly visible), no vest, and the scaffold edge has NO guardrail. The missing hard hat must be obvious even as a tiny thumbnail.""",
 "site_pair_b": f"""{STYLE}
{PAIR}
Subject: a construction site of a children's playground and small park, clay style. One clay construction worker stands large in the center operating near a tall structure, facing the camera.
LEFT panel (safe): fluorescent orange hard hat, safety vest, orange safety cones and a fence around the work area.
RIGHT panel (unsafe): identical scene but the worker has NO hard hat (bare head clearly visible), no vest, no cones, no fence. Obvious even as a thumbnail.""",
 "site_pair_c": f"""{STYLE}
{PAIR}
Subject: a construction site of a small river footbridge, clay style. One clay construction worker stands large in the center on the bridge deck, facing the camera.
LEFT panel (safe): fluorescent orange hard hat, harness, safety vest, guardrails on the bridge edge.
RIGHT panel (unsafe): identical scene but the worker has NO hard hat (bare head clearly visible), no harness, no vest, and NO guardrail on the edge. Obvious even as a thumbnail.""",
 "icons_items": f"""{STYLE}
{ICON}
Image: 1536x1024, a 4 columns x 3 rows grid of 12 clay product icons, front three-quarter view, same scale:
row 1: (1) red fire extinguisher with a round bright green inspection sticker on its body, (2) the SAME red fire extinguisher with NO sticker, (3) blue office chair, (4) the same chair in bright pink.
row 2: (5) a wide wooden school desk, (6) the same desk but clearly much smaller and shorter, (7) a white first-aid kit with a red cross shape, (8) a grey laptop.
row 3: (9) a white air purifier, (10) a solar-powered street lamp, (11) a digital thermometer, (12) a wooden bookshelf.""",
 "icons_marks": f"""{STYLE}
{ICON}
Image: 1024x1024, a 3x3 grid of 9 clay icons, same scale:
row 1: (1) a small library building icon, (2) a playground slide-and-swing icon, (3) a small arch footbridge icon.
row 2: three round badge medals: (4) innovation badge, a glowing yellow light bulb with a small star on a blue round badge, (5) green product badge, a green leaf on a white round badge with green rim, (6) safety certification badge, a shield with a check shape on an orange round badge.
row 3: (7) a big round green rubber stamp imprint shaped like a bold circle (an O shape, not text), (8) a big orange rubber stamp imprint shaped like a magnifying glass, (9) a blue investigation document tray box with a magnifying glass on it.""",
 "logos": f"""{STYLE}
{ICON}
Image: 1536x1152, a 4 columns x 3 rows grid of 12 cute round company-mascot logo badges for fictional small companies. Each badge is a circle with a distinct bright background color and one friendly animal face in clay style: bear, rabbit, cat, dog, penguin, fox, panda, owl, turtle, frog, lion, hedgehog. Do not use a stork or a squirrel. All twelve badge colors clearly different from each other. No text.""",
 "ladder": f"""{STYLE}
Image: 1536x1024 landscape. A cheerful clay staircase of exactly four wide steps rising from lower-left to upper-right, each step a distinct pastel color platform (step 1 mint, step 2 sky blue, step 3 lavender, step 4 gold), with empty flat tops so small badges can stand on them. At the top right, a small globe and a little airplane hint at going overseas. Soft sky background. Nothing written on the steps.""",
 "worldmap": f"""{STYLE}
Image: 1536x1024 landscape. A soft clay world map: rounded continents in pastel green on a light blue ocean, simplified and friendly, with about eight small unlit round lamp posts or light dots placed on different continents (unlit, grey). South Korea area marked by a small blue pin. No text, no country borders lines.""",
}

def run(name, prompt):
    out_png = os.path.join(OUT, f"{name}.png")
    if os.path.exists(out_png):
        return name, "skip(exists)"
    full = f"""Use your native image generation tool ($imagegen) to create exactly ONE image and save it as a PNG at:
{out_png}
Do not draw it with code, PIL, SVG or any procedural method. Do not edit or overwrite any other file. If native image generation is unavailable, create no file and reply exactly: IMAGEGEN_UNAVAILABLE

{prompt}

After saving, reply with the saved path and the image dimensions."""
    with open(os.path.join(PROMPTS, f"{name}.txt"), "w", encoding="utf-8") as f:
        f.write(full)
    log = os.path.join(OUT, f"{name}.log.jsonl")
    last = os.path.join(OUT, f"{name}.last.txt")
    t0 = time.time()
    p = subprocess.run([CODEX, "exec", "--skip-git-repo-check", "-C", ROOT, "-s", "workspace-write",
                        "-i", REF_MASCOT, "-i", REF_STYLE, "-o", last, "--json", "-"],
                       input=full.encode("utf-8"), stdout=open(log, "wb"), stderr=subprocess.STDOUT)
    ok = os.path.exists(out_png)
    return name, f"exit={p.returncode} ok={ok} {int(time.time()-t0)}s"

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True); os.makedirs(PROMPTS, exist_ok=True)
    names = sys.argv[1:] or list(JOBS)
    with cf.ThreadPoolExecutor(max_workers=3) as ex:
        for name, res in ex.map(lambda n: run(n, JOBS[n]), names):
            print(name, res, flush=True)
