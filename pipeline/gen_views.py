# 트리포 멀티뷰용 다각도 그림 생성(Codex exec, 캐릭터마다 1장, 동시에 2개)
import subprocess, os, concurrent.futures as cf, time

CODEX = os.path.expandvars(r"%LOCALAPPDATA%\OpenAI\Codex\bin\5449c1f0f26f1f98\codex.exe")
ROOT = r"C:\Project\AI-Quest"
OUT = os.path.join(ROOT, "assets_src", "tripo", "views")
REF = os.path.join(ROOT, "assets_src", "tripo", "ref")

COMMON = """Layout: one landscape image 1536x1024 with exactly three equal panels side by side, all on the same flat plain light gray #E6E6E6 background (no gradient, no floor, no cast shadow, no frames, no text). Orthographic turnaround view of the SAME character at the SAME scale in every panel: the character's feet touch the same baseline near the bottom and the top of the head is at the same height in every panel, each panel shows the full body with margin, nothing cut off.
Panel 1 (left): LEFT SIDE view, the camera looks at the character's left side, so the character faces toward the RIGHT edge of the image, exact 90 degree profile.
Panel 2 (middle): BACK view, exactly from behind.
Panel 3 (right): RIGHT SIDE view, the camera looks at the character's right side, so the character faces toward the LEFT edge of the image, exact 90 degree profile.
Style: identical to the attached 3D render: soft 3D clay/vinyl toy render, matte material, soft even studio light, same colors and proportions. Neutral standing pose exactly like the front render (do not change the pose, no new expressions, no props). Strict: no text, no letters, no logos, no watermark, do not add any accessory that is not described."""

JOBS = {
    "narumi_views": ([os.path.join(REF, "narumi_front_3d.png"), os.path.join(REF, "narumi_2d_back.png"), os.path.join(REF, "narumi_2d_side_a.png")],
        f"""Character: Narumi, the official mascot of a Korean public agency, a round white stork-like bird (first attached image is the official 3D front render; the other attached line drawings are the official 2D turnaround, use them ONLY for the shape of the back and side: the large egg-shaped white head, the curled feather crest at the top back of the head, the white tail feather with black tip sticking out at the back, black wing tips, orange feet).
Light-blue transparent goggles wrap around the face only at the front (from the side the goggle band is visible at the side of the head; from the back no goggle strap unless the 2D drawing shows one, it does not). Red scarf knotted at the character's left front of the neck, the red band visible all around the neck from the back.
{COMMON}"""),
    "dari_views": ([os.path.join(REF, "dari_front_3d.png")],
        f"""Character: Dari, the official mascot partner, a cute round orange squirrel (the attached image is the official 3D front render). Keep: big round head with round ears with white inner ear, three darker orange stripes on top of the head that continue over the top to the back of the head, white muzzle and cheeks area, white belly patch, short arms and legs, and a big fluffy orange tail with a white tip that rises up behind the body on the character's left side.
The character wears a small simple dark brown rounded backpack on the back: the front render shows only its two dark brown shoulder straps; from the side the backpack is a thin rounded brown shape on the back, and from the back it is a simple plain rounded dark brown backpack with no logo, no pockets details, no zipper text, sitting between the shoulders above the tail.
{COMMON}"""),
}

def run(name):
    out_png = os.path.join(OUT, f"{name}.png")
    if os.path.exists(out_png):
        return name, "skip(exists)"
    refs, prompt = JOBS[name]
    full = f"""Use your native image generation tool ($imagegen) to create exactly ONE image and save it as a PNG at:
{out_png}
Do not draw it with code, PIL, SVG or any procedural method. Do not edit or overwrite any other file. If native image generation is unavailable, create no file and reply exactly: IMAGEGEN_UNAVAILABLE

{prompt}

After saving, reply with the saved path and the image dimensions."""
    open(os.path.join(OUT, f"{name}.prompt.txt"), "w", encoding="utf-8").write(full)
    args = [CODEX, "exec", "--skip-git-repo-check", "-C", ROOT, "-s", "workspace-write"]
    for r in refs:
        args += ["-i", r]
    args += ["-o", os.path.join(OUT, f"{name}.last.txt"), "--json", "-"]
    t0 = time.time()
    p = subprocess.run(args, input=full.encode("utf-8"), stdout=open(os.path.join(OUT, f"{name}.log.jsonl"), "wb"), stderr=subprocess.STDOUT)
    return name, f"exit={p.returncode} ok={os.path.exists(out_png)} {int(time.time()-t0)}s"

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    with cf.ThreadPoolExecutor(max_workers=2) as ex:
        for name, res in ex.map(run, list(JOBS)):
            print(name, res, flush=True)
