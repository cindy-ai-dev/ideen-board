# Ideen-Board veröffentlichen (Vercel)

Einmalige Schritte, um die App ins Netz zu bringen. Danach ist sie
unter einer echten Adresse erreichbar – auch vom Handy.

## Vorbereitung (einmalig)

1. **Account anlegen:** https://vercel.com → "Sign Up" → kostenloser
   Hobby-Plan reicht. (Anmeldung per E-Mail oder GitHub.)

2. **Terminal öffnen** und ins Projekt wechseln:

   ```
   cd ~/Documents/ideen-board
   ```

3. **Anmelden** (öffnet den Browser zur Bestätigung):

   ```
   npx vercel login
   ```

4. **Projekt verknüpfen und erstes Deploy:**

   ```
   npx vercel
   ```

   Alle Fragen mit Enter bestätigen (Vorschläge passen).

5. **API-Key hinterlegen** (der Server braucht ihn, Besucher sehen ihn nie):

   ```
   npx vercel env add OPENAI_API_KEY
   ```

   → Key einfügen (derselbe wie in .env.local), bei der Frage nach
   Environments **Production** auswählen (Leertaste, dann Enter).

6. **Datenbank-Verbindung hinterlegen**:

   ```
   npx vercel env add DATABASE_URL
   ```

   → Die Neon-Postgres-Connection-String aus `.env.local` einfügen und
   ebenfalls **Production** auswählen.

7. **Live schalten:**

   ```
   npx vercel --prod
   ```

   Am Ende steht die fertige Adresse (https://ideen-board-….vercel.app).
   Die kannst du am Handy öffnen und als Lesezeichen/Homescreen-Icon anlegen.

## Später: neue Version veröffentlichen

Nur noch ein Befehl:

```
cd ~/Documents/ideen-board && npx vercel --prod
```

## Wichtig zu wissen

- **Boards werden in Neon/Postgres gespeichert.** Was du am Handy sammelst,
  ist nach dem Öffnen derselben Board-URL auch am Mac sichtbar.
- **.env.local bleibt privat.** Sie wird nie hochgeladen (.vercelignore)
  und ist nur für die lokale Entwicklung (npm run dev).
- Lokal entwickeln geht weiter wie immer mit `npm run dev`.
