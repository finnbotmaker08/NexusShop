# VENTEX

VENTEX is een digitale webshop met een productcatalogus, winkelmand,
klantaccount, orderoverzicht en een afgeschermde beheeromgeving. De shop
gebruikt Next.js en Supabase. Producten en categorieën komen uit je eigen
Supabase-database; er worden geen nep-producten, reviews of verkoopcijfers
getoond.

## Snel starten

1. Installeer Node.js en npm.
2. Open de projectmap in een terminal en voer `npm install` uit.
3. Kopieer `.env.example` naar `.env.local`.
4. Vul in `.env.local` minimaal je Supabase-project-URL en publishable key in:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://luddvahaacrkqczkgjob.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_r85RwxEraanIok2wBhuCRg_j8ltiMNr
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

5. Voer de database-migraties uit in de Supabase SQL Editor, in deze
   volgorde:

   - [`20261006000000_store_management.sql`](./supabase/migrations/20261006000000_store_management.sql)
   - [`20261007000000_commerce_foundation.sql`](./supabase/migrations/20261007000000_commerce_foundation.sql)
   - [`20261008000000_public_product_catalog.sql`](./supabase/migrations/20261008000000_public_product_catalog.sql)
   - [20261009000000_reseller_portal.sql](./supabase/migrations/20261009000000_reseller_portal.sql)
   - [20261017000000_reseller_portal_credentials.sql](./supabase/migrations/20261017000000_reseller_portal_credentials.sql)

6. Start de website met `npm run dev` en open <http://localhost:3000>.

De migrations bouwen voort op de bestaande `products`-tabel. Die tabel moet
minimaal een unieke `id`-kolom hebben. De migrations maken de extra
winkel-, order- en leveringstabellen, maar vullen je catalogus niet automatisch.
De catalogusmigratie geeft bezoekers leesrechten op alleen gepubliceerde
producten; concepten blijven verborgen.

### Producten verschijnen niet in de shop?

- Controleer in `/admin` of het product de status **Published** heeft en
  **Published in the storefront** is aangevinkt.
- Controleer in Supabase **Table Editor → products** of het product bestaat en
  `is_active` op `true` staat.
- Voer alle drie de migraties hierboven uit in de genoemde volgorde. Vooral de
  laatste migratie maakt actieve producten leesbaar voor bezoekers.
- Herstart na wijzigingen aan `.env.local` de Next.js-server en controleer of
  `NEXT_PUBLIC_SUPABASE_URL` en de publishable key bij hetzelfde Supabase-project
  horen.

## Geen KvK-nummer nodig om de website in te stellen

In deze code en het VENTEX-beheer staat geen KvK-nummer- of bedrijfsregistratieveld.
Voor e-mail kun je een gewoon Gmail-adres gebruiken; je hebt daarvoor geen
eigen domein nodig. Betalingen lopen via apart ingestelde betaaldiensten. Zet
live betalingen pas aan nadat de gekozen aanbieder jouw account en producten
heeft geaccepteerd; die technische onboarding staat los van de Gmail-instelling.

## Eigen domein: ventexshop.nl

Koppel `nexussuppliers.nl` eerst aan je hostingprovider met de DNS-records die die
provider voor jouw project opgeeft en schakel HTTPS/SSL in. Stel vervolgens bij
de hostingprovider de productievariabele `NEXT_PUBLIC_SITE_URL` in op
`https://nexussuppliers.nl`. Laat `http://localhost:3000` alleen staan in je lokale
`.env.local`. Als je code via GitHub uitrolt, controleer dan ook dat het domein
aan het juiste productieproject is gekoppeld.

Zorg dat de website op het hoofddomein uitkomt. Als je `ww.nexussuppliers.nl` ook
gebruikt, stel dan bij je hosting een redirect in naar `nexussuppliers.nl`; anders
moet je de `www`-URL's ook apart toestaan in Supabase Auth.

## Beheerder aanmelden met Google

De `/login`-pagina gebruikt Google OAuth via Supabase. Toegang tot `/admin` is
aan de serverkant beperkt tot de geverifieerde Google-accounts:

- `dirksfinn43@gmail.com`
- `dirksfj@gmail.com`

Google OAuth instellen:

1. Open in Supabase **Authentication → Providers → Google**, schakel Google in
   en voeg de OAuth-client-ID en het clientgeheim toe.
2. Stel in Google Cloud de door Supabase getoonde redirect-URI in. Deze lijkt
   meestal op `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Open in Supabase **Authentication → URL Configuration**:
   - Stel **Site URL** in op `https://nexussuppliers.nl`.
   - Voeg aan **Redirect URLs** toe:
     `https://nexussuppliers.nl/auth/callback` en
     `https://nexussuppliers.nl/auth/customer-callback`.
   - Voeg voor lokale tests ook
     `http://localhost:3000/auth/callback` en
     `http://localhost:3000/auth/customer-callback` toe.
4. Laat in Google Cloud de door Supabase getoonde URI staan als de
   **Authorized redirect URI** (meestal
   `https://<project-ref>.supabase.co/auth/v1/callback`). Voeg
   `nexussuppliers.nl` toe als **Authorized domain** als Google Cloud daarom vraagt.
   Vervang de Supabase-redirect-URI niet door de VENTEX callback-URL.
5. Meld je aan via `https://nexussuppliers.nl/login` met een van de hierboven
   genoemde Google-accounts. Klanten melden zich aan via
   `https://nexussuppliers.nl/account/login`.

Zonder de OAuth-provider en callback-URL's kan Google aanmelden niet worden
afgerond.

De login-knop gebruikt automatisch het domein waarop de bezoeker de website
heeft geopend. Supabase moet daarom bovenstaande callback-URL's toestaan. Gebruik
steeds `nexussuppliers.nl`; als je ook `www.nexussuppliers.nl` gebruikt, stel dan een
vaste redirect naar het hoofddomein in bij je hosting en voeg anders ook de
twee `www` callback-URL's aan Supabase toe.

## Gmail voor ordermails

VENTEX kan order- en betaalstatusmails via Gmail versturen. Gebruik hiervoor
een Google-app-wachtwoord, niet het normale wachtwoord van je Google-account.
Je hebt een Google-account met tweestapsverificatie nodig. Maak daarna een
app-wachtwoord aan via [Google App Passwords](https://myaccount.google.com/apppasswords).

Voeg deze servervariabelen toe aan `.env.local` en aan je hostingomgeving:

```env
GMAIL_USER=jouw-adres@gmail.com
GMAIL_APP_PASSWORD=jouw-google-app-wachtwoord
```

Houd het app-wachtwoord geheim: zet het niet in browservariabelen, deel het
niet in chats en commit het niet naar Git. Gmail heeft verzendlimieten en kan
berichten als spam behandelen. Test de mailfunctie voordat je echte orders
verwerkt.

Stel voor de live website bij je hosting ook `NEXT_PUBLIC_SITE_URL` in op
`https://nexussuppliers.nl`. Gebruik `http://localhost:3000` alleen lokaal. De
variabele wordt onder andere gebruikt voor ordermails en herinneringslinks.

Optioneel kun je `NEXT_PUBLIC_SUPPORT_EMAIL` instellen om een contactadres op
de support- en privacypagina's te tonen.

## Wat je in `/admin` kunt beheren

- Producten en categorieën toevoegen, aanpassen en activeren.
- Beschrijvingen, prijzen, saleprijzen, voorraad en leveringstype beheren.
- Leveringsinstructies en een productbestemmingslink instellen.
- Digitale sleutels toevoegen aan de afgeschermde voorraad.
- Orders bekijken en beschikbare sleutels opnieuw laten toewijzen.
- Betaalinstellingen voor beschikbare betaalmethoden beheren.
- Discord-community en Discord-supportlinks instellen.
- Een Discord-webhook instellen en een testmelding versturen.
- Onderhoudsmodus en het bericht voor bezoekers instellen.
- Reselleraccounts uitnodigen en membership/accountstatus beheren via
  `/admin/resellers`.

## Resellerportal

De publieke programmapagina staat op `/reseller`. Beheerders kunnen een reseller
handmatig uitnodigen via `/admin/resellers`; daarvoor moeten Supabase Auth Admin
API en de bestaande Gmail-variabelen zijn ingesteld. Supabase maakt het
invite-token aan; VENTEX mailt de activeringslink via Gmail. De callback-URL
`/auth/reseller-callback` moet als redirect-URL in Supabase Auth zijn toegestaan
(lokaal `http://localhost:3000/auth/reseller-callback`, live
`https://nexussuppliers.nl/auth/reseller-callback`). Stel in Supabase Auth de
uitnodigingstoken-levensduur ook in op maximaal zeven dagen; de database weigert
activatie na zeven dagen.

Een reseller kan aanmelden op `/reseller/login` met een apart portalwachtwoord.
Dit wachtwoord wordt server-side gehasht opgeslagen en verandert het gewone
Supabase- of shopwachtwoord niet. De eenmalige mail-link bevestigt het
e-mailadres; dit werkt ook voor bestaande Supabase-gebruikers. Na het toepassen
van de credentials-migratie kan een beheerder via `/admin/resellers` opnieuw
een link versturen, zodat een bestaande reseller het portalwachtwoord instelt.
Blokkeren of intrekken beëindigt ook bestaande portalsessies.

De resellerplannen tonen Basic voor € 1,50 en Premium voor € 8 (eenmalig).
Dit zijn weergegeven planprijzen; er is geen reseller-checkout gekoppeld.

Een dashboardrequest controleert de actieve accountstatus. Het dashboard toont
orders van het bestaande Supabase-account en actieve rewards, claims, tickets en
giveaways vanuit de nieuwe reseller-tabellen. Rewardclaims genereren een
eenmalig getoonde willekeurige sleutel waarvan alleen de SHA-256-hash wordt
opgeslagen; voorraad, membership en dubbele claims worden atomisch gecontroleerd
in PostgreSQL. Beheerders kunnen claimkeys controleren op `/admin/claims` en
statussen auditen. Rewards zijn vanuit `/admin/rewards` aan te maken, te
bewerken, te pauzeren en veilig te verwijderen zolang er geen claims aan hangen.
Resellers openen tickets in het portal; medewerkers beheren antwoorden en interne notities op `/admin/tickets`. Giveawaydeelname is uniek
per account en membership wordt server-side gecontroleerd. De CRUD-beheerpagina's
voor rewards en giveaways en uitgebreide resellerprofielnotities zijn nog niet
onderdeel van deze eerste implementatiestap.

Klanten melden zich apart aan via `/account`. Daar zien ze hun eigen orderstatus,
betaalinformatie en beschikbare digitale levering. De winkelmand leest actuele
prijzen en voorraad opnieuw uit de database voordat checkout begint.

## Betalingen

De betaalmethoden zijn afhankelijk van de serverinstellingen en accounts die
je zelf configureert. De checkout controleert productprijzen server-side.
Paddle-orders worden pas als betaald verwerkt na een geldige, ondertekende
Paddle-webhook. Sleutels worden na bevestiging aan de order gekoppeld. Als er
geen sleutels beschikbaar zijn, blijft de order zichtbaar voor handmatige
afhandeling.

Paddle staat standaard uit. Gebruik eerst sandboxgegevens en laat
`PADDLE_CHECKOUT_ENABLED=false` staan tot de database, checkout en webhook zijn
getest:

1. Maak EUR-prijzen aan in Paddle en vul de bijbehorende `pri_...`-ID's in bij
   de producten in `/admin`.
2. Stel de Paddle-default-betaallink in op `https://<jouw-domein>/pay`.
3. Stel de benodigde servervariabelen in:
   `SUPABASE_SERVICE_ROLE_KEY`, `PADDLE_API_KEY`,
   `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`, `PADDLE_WEBHOOK_SECRET` en
   `PADDLE_ENVIRONMENT=sandbox`.
4. Stel de Paddle-webhook in op
   `https://<jouw-domein>/api/paddle/webhook` en abonneer deze op
   `transaction.completed`, `transaction.updated` en `adjustment.updated`.
5. Test een volledige aankoop en webhook eerst in de sandbox. Zet
   `PADDLE_CHECKOUT_ENABLED=true` alleen aan als de provider je account en de
   producten heeft geaccepteerd en je tests slagen.

Voor handmatige betaalmethoden moeten de betaalinstellingen in `/admin` zijn
ingesteld. Crypto-betalingen worden gecontroleerd, maar vereisen nog steeds
goedkeuring voordat een order wordt geleverd. Tikkie-betalingen worden
handmatig nagekeken.

## Omgevingsvariabelen

| Variabele | Gebruik |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL van je Supabase-project |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publieke Supabase publishable key (of legacy anon key) |
| `NEXT_PUBLIC_SITE_URL` | Basis-URL; lokaal `http://localhost:3000`, live `https://nexussuppliers.nl` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side toegang voor beveiligde order- en mailverwerking |
| `GMAIL_USER` | Gmail-adres voor ordermails |
| `GMAIL_APP_PASSWORD` | Google-app-wachtwoord voor ordermails |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Optioneel publiek supportadres |
| `PADDLE_API_KEY` | Optioneel; Paddle-servertoegang |
| `PADDLE_WEBHOOK_SECRET` | Optioneel; ondertekeningsgeheim voor Paddle-webhooks |
| `PADDLE_ENVIRONMENT` | `sandbox` tijdens testen, `production` na configuratie |
| `PADDLE_CHECKOUT_ENABLED` | Checkout-schakelaar; standaard `false` |
| `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` | Publieke Paddle-clienttoken |
| `BLOCKCYPHER_TOKEN` | Optioneel server-side token voor blockchaincontroles |
| `CRON_SECRET` | Geheim voor de beveiligde herinnerings-cronroute |

Bewaar alle geheime waarden alleen in `.env.local` of de beveiligde
omgevingsinstellingen van je hosting. Variabelen met `NEXT_PUBLIC_` zijn
zichtbaar voor de browser en mogen geen geheimen bevatten.

## Commando's

- `npm run dev` — start de lokale ontwikkelserver.
- `npm run lint` — voer ESLint uit.
- `npm run build` — maak een productiebuild.
- `npm run start` — start de productiebuild lokaal.
