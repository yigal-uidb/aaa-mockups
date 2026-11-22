---
name: aaa-demo-film
description: Create a narrated Hebrew demo film of the AAA platform for a specific prospective client (a council, a factory, a retail chain...), recorded from the real running system. The film shows the client's system being built in conversation with the AAA assistant, then a short look at the finished system in daily use. Use whenever asked for a demo video, film, סרטון, or mockup video of AAA for a client, or to update an existing one after the platform changed. Each client gets a different domain, emphasis and needs; the platform keeps evolving, so always check what it can do today.
---

# A demo film of AAA for a client

The reference implementation is the film for מועצה אזורית עמק יזרעאל in this repo:
- `aaa-demo/`: the client's app, the seed scripts, the scripted demo server and the recording script. These files are dropped into a checkout of `yigal-uidb/aaa`.
- `emek-yizrael-video/`: the Remotion project: script, timeline, narration, music, film.

For a new client, copy both into new folders (`aaa-demo-<client>/`, `<client>-video/`) and adapt. Don't start from scratch.

## 1. Before anything: the brief

Ask only what you cannot decide yourself. Usually:
- Who the client is, and what system they need (for example: resident relations, special orders, maintenance calls).
- What to emphasize for this client (for example: permissions and control for a public body, speed for a small business, bots for a call center).
- Length (about 3 minutes is the default), and the narrator voice if it should differ from the default.

Defaults, unless told otherwise:
- No brand colors and no use of the client's website.
- All people and data are fictional. Use the client's real name only as the organization in the film.

## 2. What the platform can do today

The platform changes from film to film. Read the `aaa` repo's `README.md` (the "מה יש במערכת" section) and `ROADMAP.md`. Pick the capabilities worth showing this client, and don't show anything that isn't built yet.

## 3. The story: building first, the result second

The hero of the film is the build process. That is what makes AAA unique; a finished system on its own looks like any other product. The order that worked:

1. Opening card: the client's name, and one line about building a system in conversation.
2. "אפליקציה חדשה": first clearly show that a new app is being created, then the chat in a normal view, with the need described in plain words.
3. Guiding questions from the assistant, answered by clicking.
4. A spec for approval, a fix in conversation (for example, adding a public form), then approval.
5. The build itself (the building animation), and version 1 in the test environment.
6. The app that was built: screens, the workflow diagram, a rule changed without a programmer.
7. View-as: how each role sees it.
8. A bot defined in conversation, with who it's open to and what it may do.
9. Guided test, a go-live request, and approval by a second manager.
10. A change request that becomes a new version, and the same conversation from Claude over MCP (short).
11. A card "ככה זה נראה / כשמסיימים לבנות", then a short montage of daily use: each scene a few seconds.
12. A closing card with 3–4 value points, and the AAA logo.

Wording:
- Never say the result takes "weeks" or any long time. Say "כך יכולה להיראות המערכת כשמסיימים לבנות אותה".
- Write "טריפל איי" and "קלוד" in the narration text, so the voice pronounces them right. Write any number as words.

## 4. The client's app

Write the app the way the assistant would: `app.json`, `server.js`, `ui/index.jsx` and `seed.json`, modeled on `aaa-demo/apps/emek-moked` and the apps in the `aaa` repo. Check every screen for polish before recording:
- Every modal body needs padding. Use a `k-form` wrapper; a bare label in a `Modal` sticks to the edges.
- A `MapView` must render only after its records loaded. Otherwise it fits to an empty list and shows all of Israel.
- A public form can't take `ref`, `user`, `file` or `image` fields, and a location field shows up there as plain text. Use a text field for the address.

## 5. Two organizations and real actions

- `seed-<client>.ts`: the client "after the build", with its app live and realistic data. That means about 120 records over 6 months, mostly closed, about 30 open, and only a few overdue, with varied titles. It also adds the shared and personal bots. Put the data in the live environment and give users roles; regular users only see live apps.
- `seed-build.ts`: a second copy of the client with no apps, where the build is recorded. `after-build.ts` then gives users roles and adds sample records to the new app's test environment.
- `serve.ts`: AAA with a scripted model in place of Claude. The wording is prepared, but every tool call runs for real: questions, spec, `write_file`, `publish_version`, `create_record`, a read-only bot being blocked.
  - Scenarios match on the user's text. A follow-up after a question or a spec arrives as `tool_result` plus text and continues the `pending` chain.
  - The match text must be unique: a bot's goals are injected into the conversation, so don't match on words that appear in them.
- Start it with `ANTHROPIC_API_KEY=scripted-demo` (so the UI thinks the assistant is connected), and with `RESEND_API_KEY`/`AAA_MAIL_FROM` set to dummy values, so the "mail not configured" warning doesn't show.
- `restart.sh` restores the database snapshot. Clips build on each other, so record them in order after a restore.

## 6. Recording: the screen must match the film

This was the biggest lesson. Record the browser at the film's proportions:
- Viewport 1440×810, `deviceScaleFactor: 4/3`, which makes 1920×1080 frames. A whole screen fits the frame and the text is readable.
- Never record a large screen and zoom into it afterwards: that crops the frame and lands on empty areas.

Other recording rules:
- Use the CDP screencast (`rec/lib.cjs`). It gives sharp frames and builds a 30fps MP4.
- Draw the cursor in the page, glide it to every target, and show a ripple on each click.
- Type at a human pace (`insertText` per character).
- Native `<select>` dropdowns don't show in a recording. Use `pickFromList`, which draws the real options as an open list under the select, highlights the pick, then selects it.
- Close popups (notifications) before moving on.
- Every clip writes time marks (`marker`) to `clips/marks.json`. Set the zooms from those marks, not by guessing.
- The phone scene (public form) is recorded as a mobile viewport (430 wide, DSF 2, frames 860×1800) and shown inside a phone frame.

## 7. The film (Remotion)

- `script/scenes.json` holds each scene's narration and its `visual`. `scripts/timeline.ts` sets each scene's length from the narration audio, and writes the `.srt`.
- `SCENES` in `src/Film.tsx`: each scene is segments of recordings (seconds from–to) with focus points.
  - Zoom at most 1.25, and only to bring a panel closer while keeping its context.
  - The playback rate is set so the segments fit the narration. Montage scenes may go up to 2.4–2.6×.
- Scene titles are a small label in the empty middle of the app's top bar, shown for about 4 seconds, never over the content.
- No subtitles burned into the picture: they cover the chat input. The `.srt` goes alongside.
- Music: `scripts/music.py` generates calm original music, with no samples and no licensing. It's ducked under the voice.
- The Claude scene is an animation (there is no real Claude window to record). Its content must match the real data.

## 8. Narration

ElevenLabs, with the same voice as the previous films: Brian (`nPczCjzI2devNBz1zQrb`), `eleven_v3`, sped up 8%.
- Run `ELEVENLABS_API_KEY=... npx tsx scripts/tts.mts`. The key goes only in an environment variable, never in a file or a commit.
- After the narration is generated, rebuild the timeline and check the zooms against the new scene lengths.

## 9. Checks before delivery

- Render a half-scale preview: `--scale=0.5`.
- Make contact sheets with timestamps for each clip and for the film: `ffmpeg ... fps=1/3,drawtext=%{pts\:hms},tile=5x5`. Look at every scene:
  - Is anything cut off?
  - Does each click show?
  - Is the zoom on something relevant?
  - Is any popup without padding?
  - Do the titles and subtitles cover anything?
- Tell the requester plainly what is real (every action in the system) and what is staged (the assistant's wording, the email status if no mail service is set, the Claude scene).

## 10. Delivery

- Render at full resolution, then run `ffmpeg loudnorm` (I=-16).
- The film is too large for email. Upload it to Google Drive, share it with the recipients, and email them the link with a short summary.
- Commit the project to this repo, with no keys and no `node_modules`.
