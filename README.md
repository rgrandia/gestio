# gestió — Departament d'Estudis Polítics i Estratègia

Eina interna de supervisió de projectes. L'especificació de referència és
[`CLAUDE.md`](CLAUDE.md); aquest fitxer explica com posar-la en marxa i on
la implementació se n'aparta (i per què).

Stack: Next.js 16 (App Router, TypeScript) · Supabase (Postgres + Auth) ·
Tailwind · Vercel.

## Estructura

```
supabase/migrations/   esquema, RLS, triggers/RPC i vistes (en aquest ordre)
supabase/tests/        verificacio.sql (§7.3) + stub d'auth per provar en local
scripts/prova-sql.sh   aplica les migracions en un Postgres buit i verifica
src/lib/auth/          TOT el que depèn del proveïdor d'autenticació
src/lib/accions.ts     totes les escriptures (server actions, sense service_role)
src/app/(app)/         les quatre pantalles: setmana, projectes, idees, clients
```

## Posada en marxa

1. **Projecte Supabase a la regió europea** (Frankfurt `eu-central-1` o
   París `eu-west-3`). La regió no es pot canviar després.
2. **Migracions**: amb la CLI (`supabase link` + `supabase db push`) o
   enganxant els quatre fitxers de `supabase/migrations/` per ordre a
   l'editor SQL.
3. **Verificació abans de desplegar**: executa
   `supabase/tests/verificacio.sql` a l'editor SQL. Fa tot dins d'una
   transacció que es desfà. Si acaba amb
   `verificacio: totes les comprovacions superades`, l'RLS i els triggers
   fan el que diu §7.3.
4. **Autenticació** (Authentication → Providers / Settings):
   - Pla B (email + contrasenya): desactiva *Allow new users to sign up*,
     longitud mínima de contrasenya **12**. Crea els tres usuaris des de
     *Users → Add user*.
   - Entra ID: configura el proveïdor *Azure* amb l'app registration de
     l'IT de GESOP, afegeix `https://<domini>/auth/callback` a *Redirect
     URLs* i posa `NEXT_PUBLIC_AUTH_PROVIDER=azure`.
5. **Activar els perfils.** Tot usuari nou rep un perfil **inactiu** (vegeu
   les desviacions). Per a Roc, Rocío i Aina, un cop creats:
   ```sql
   update perfils set actiu = true, nom = 'Roc'   where email = '...';
   update perfils set actiu = true, nom = 'Rocío' where email = '...';
   update perfils set actiu = true, nom = 'Aina'  where email = '...';
   ```
6. **Vercel**: importa el repositori i defineix les variables de
   `.env.example`. La connexió a Supabase va per `GESTIO_SUPABASE_URL` i
   `GESTIO_SUPABASE_ANON_KEY`, no per les `NEXT_PUBLIC_SUPABASE_*`
   habituals: la integració de Supabase del Marketplace de Vercel injecta
   aquestes últimes apuntant al seu propi projecte i trepitja les teves sense
   que es vegi. **No connectis aquesta integració**: també posa la clau
   `service_role` a les variables de Vercel. `vercel.json` fixa les funcions a `fra1` perquè les
   dades no surtin de la UE en trànsit. **No** afegeixis mai la clau
   `service_role`: l'app no la necessita.

> Avís per als usuaris (pla B): no reutilitzeu la contrasenya corporativa.

### En local

```bash
cp .env.example .env.local   # i omple-ho
npm install
npm run dev
```

`npm run test:sql` aplica les migracions sobre un Postgres local buit i
executa la verificació (cal `psql`; usa les variables `PG*` habituals). La CI
fa el mateix a cada PR.

## Desviacions respecte a CLAUDE.md

Totes són correccions d'errors del text de referència o decisions que el
text no tancava. Cap amplia l'abast. Estan comentades al codi on s'apliquen.

**Errors de seguretat corregits**

1. **Vistes sense `security_invoker`.** A Postgres una vista s'executa amb
   els permisos del propietari i se salta l'RLS. Les vistes `v_safata` i
   `v_projectes_muts` de §5, tal com estaven, eren llegibles per qualsevol
   usuari autenticat encara que no fos membre. Ara porten
   `with (security_invoker = true)` i la verificació ho comprova.
2. **"Sense política de delete, Postgres el denega"** és cert a mitges: el
   `delete` no falla, esborra 0 files en silenci. Per complir la
   comprovació 2 de §7.3 (que falli), es revoca el privilegi `DELETE` a
   `anon` i `authenticated`.
3. **Un usuari desactivat es podia reactivar ell mateix** amb la política
   `editar_propi_perfil` (`update perfils set actiu = true`). Ara només es
   pot modificar la columna `nom`.
4. **Funcions `security definer` sense `search_path` fix**: corregit.

**Errors de lògica corregits**

5. **Snooze de 8 dies, no 7**: `revisat_el < current_date - 7` amagava
   l'element 8 dies. Ara un element revisat dilluns torna el dilluns següent.
6. **Projectes muts des del primer dia**: una consultoria nova sense cap
   contacte tenia darrer senyal = 1900 i sortia muda en crear-la. Ara el
   rellotge comença a `data_inici` (o a la data de creació).
7. **Zona horària**: Supabase treballa en UTC; `current_date` canviava de
   dia a les 22:00/23:00. La base de dades es fixa a `Europe/Madrid`.

**Decisions que el text no tancava (cal validar-les)**

8. **Perfils nous inactius.** §7.1 no diu com es creen els perfils. Amb
   Entra ID, qualsevol persona del tenant de GESOP que hi entrés tindria
   accés a tot si el perfil naixés actiu. Ara es crea automàticament però
   inactiu; s'activa a mà (pas 5).
9. **Primera planificació sense motiu.** Passar una data de buida a
   definida (p. ex. les sis fases, que neixen sense data) es registra a
   l'historial com a "planificació inicial" sense demanar motiu. Qualsevol
   canvi posterior, o esborrar la data, sí que l'exigeix. Sense això, ningú
   posaria dates a les fases.
10. **`projectes.data_fi_prevista` també té historial.** El comentari de
    `historial_dates.taula` ja preveia `projectes`, però el trigger no la
    cobria.
11. **`fet` exigeix `data_real`** (check a la base de dades). És la regla
    central de §4.1 feta impossible de saltar.
12. **Marcar fet = dos clics** (obrir + confirmar la data). §5 demana la
    data i l'antic contracte visual deia que una acció de dos clics no es farà servir: són
    incompatibles. La data ve posada a avui, així que és clic + Enter.
    "revisat" i "cancel·lar" són d'un sol clic, sense confirmació.

## Què no hi ha (a propòsit)

Res de §2: ni microdades, ni hores, ni sincronització, ni correu, ni gràfics,
ni notificacions, ni pujada de fitxers (només enllaços `https://`), ni app
nativa. Mode fosc: no.
