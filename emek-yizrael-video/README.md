# סרטון הדגמה: AAA למועצה אזורית עמק יזרעאל

סרטון של כ-3 דקות עם קריין בעברית. הוא מדגים את מערכת "פניות תושבים" כפי שהיא רצה ב-AAA: בוטים, MCP מתוך Claude, הרשאות, גרסאות ואישור לפני עלייה לאוויר. המסכים צולמו מהמערכת האמיתית, שרצה מקומית עם נתוני דוגמה.

## מבנה
- `script/scenes.json`: טקסט הקריינות לכל סצנה, וסוג התצוגה שלה.
- `public/clips/*.mp4`: צילומי המסך מהמערכת. מקור הצילומים: `aaa/demo/rec/run.cjs`.
- `public/audio/*.mp3`: הקריינות (ElevenLabs, הקול Brian, eleven_v3, מואץ ב-8%, כמו בסרטון הקודם).
- `public/music.m4a`: מוזיקת רקע, נוצרה בקוד (`scripts/music.py`). אין בה דגימות ואין לה רישיון.
- `src/Film.tsx`: הסרטון ב-Remotion.

## הרצה
```bash
npm install
```
```bash
ELEVENLABS_API_KEY=... npx tsx scripts/tts.ts
```
```bash
npx tsx scripts/timeline.ts
```
```bash
npx remotion render src/index.ts Film out/aaa-emek-yizrael.mp4 --concurrency=4
```
`timeline.ts` קובע את משך כל סצנה לפי אורך הקריינות. בלי קובצי שמע הוא מעריך את המשך לפי אורך הטקסט. הוא כותב גם כתוביות ל-`out/aaa-emek-yizrael.srt`.

## הצילומים מחדש
במאגר `aaa`: `demo/seed-emek.ts` יוצר את המועצה ואת הנתונים. `demo/serve.ts` מריץ את השרת עם מודל מתוסרט במקום Claude, אבל כל פעולה שהעוזר מבצע רצה באמת. `demo/restart.sh` מחזיר את המסד לנקודת ההתחלה. `node demo/rec/run.cjs` מצלם את כל הסצנות.
