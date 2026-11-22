# הצילום מהמערכת האמיתית

הקבצים כאן מתלבשים על צ'קאאוט של `yigal-uidb/aaa`:

```bash
cp -r apps/emek-moked /path/to/aaa/apps/
```

```bash
cp -r demo /path/to/aaa/
```

אחר כך, בתיקיית `aaa` (צריך Node 22 ו-PostgreSQL 16, וקובץ `.env` עם `DATABASE_URL`):

```bash
npm ci && npm run build
```

```bash
npx tsx --env-file=.env demo/seed-emek.ts
```

```bash
npx tsx --env-file=.env demo/seed-build.ts
```

```bash
pg_dump -Fc "$DATABASE_URL" > demo/snap.dump
```

```bash
demo/restart.sh
```

```bash
node demo/rec/run.cjs build
```

```bash
npx tsx --env-file=.env demo/after-build.ts
```

```bash
node demo/rec/run.cjs tour viewas bot guided approve
```

```bash
node demo/rec/run.cjs home flow requests intake manager morning close automation public overview change publish
```

- `seed-emek.ts` יוצר את הארגון "מועצה אזורית עמק יזרעאל". האנשים בו בדויים, והסיסמה של כולם `demo1234`. נוצרים גם 14 יישובים, 5 מחלקות ו-126 פניות, שני בוטים, והאפליקציה באוויר.
- `seed-build.ts` יוצר עותק נוסף של המועצה בלי אפליקציות. בו מצולמת הבנייה בשיחה: תיאור הצורך, שאלות מכוונות, אפיון, תיקון, אישור ובנייה אמיתית של הגרסה הראשונה. אחריו `after-build.ts` משייך תפקידים ומוסיף פניות לדוגמה לסביבת הבדיקה.
- `serve.ts` מריץ את AAA עם מודל מתוסרט במקום Claude. הניסוח של העוזר מוכן מראש, אבל כל פעולה שהוא מבצע (חיפוש, פתיחת פנייה, חסימת בוט לקריאה בלבד, בניית גרסה) רצה במערכת באמת.
- `restart.sh` מחזיר את המסד לנקודת ההתחלה, כי כל צילום בונה על הקודם לו.
- הצילומים נשמרים ב-`/home/user/aaa-emek-video/clips`. משם מעתיקים אותם ל-`emek-yizrael-video/public/clips` (הנתיב מוגדר בראש `rec/run.cjs`).

לפני הצילום של מסך האוטומציה, `run.cjs` מסמן את המייל לתושב כ"נשלח", כי בהדגמה לא מוגדר שירות דואר.
