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
pg_dump -Fc "$DATABASE_URL" > demo/snap.dump
```

```bash
demo/restart.sh
```

```bash
node demo/rec/run.cjs
```

- `seed-emek.ts` יוצר את הארגון "מועצה אזורית עמק יזרעאל". האנשים בו בדויים, והסיסמה של כולם `demo1234`. נוצרים גם 14 יישובים, 5 מחלקות ו-126 פניות, שני בוטים, והאפליקציה באוויר.
- `serve.ts` מריץ את AAA עם מודל מתוסרט במקום Claude. הניסוח של העוזר מוכן מראש, אבל כל פעולה שהוא מבצע (חיפוש, פתיחת פנייה, חסימת בוט לקריאה בלבד, בניית גרסה) רצה במערכת באמת.
- `restart.sh` מחזיר את המסד לנקודת ההתחלה, כי כל צילום בונה על הקודם לו.
- הצילומים נשמרים ב-`/home/user/aaa-emek-video/clips`. משם מעתיקים אותם ל-`emek-yizrael-video/public/clips` (הנתיב מוגדר בראש `rec/run.cjs`).

לפני הצילום של מסך האוטומציה, `run.cjs` מסמן את המייל לתושב כ"נשלח", כי בהדגמה לא מוגדר שירות דואר.
