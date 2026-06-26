# Supply Generation Dashboard · Seeds

Tablero interno del proyecto interárea **Supply Generation** (Marketing × Attraction).
Mide, semana a semana, si los canales de contenido activados están generando un flujo
constante de talento calificado (Data, Tech e IA) para las búsquedas abiertas.

- **Sitio público, sin login** (cualquiera con el link entra, ve y carga datos).
- Carga de datos **100% manual** desde el propio tablero.
- Stack: **Next.js 16 (App Router, TS) · Tailwind CSS v4 · Recharts · Supabase (Postgres) · Vercel**.

## Vistas

- **Funnel semanal** — métricas acumuladas, gráfico combinado (línea de views + barras de
  postulaciones, con scroll horizontal) y acordeón de semanas con insights, oportunidades y contenidos.
- **Cargar datos** — alta/edición/borrado manual de semanas, insights, oportunidades y contenidos,
  con vínculo muchos-a-muchos entre contenidos y oportunidades.

El funnel de cada semana se **calcula automáticamente** a partir del detalle cargado.

---

## 🚀 Puesta en marcha (paso a paso, sin tecnicismos)

### A. Subir el código a GitHub (repo nuevo e independiente)

1. Entrá a <https://github.com/new> y creá un repositorio nuevo, por ejemplo
   `supply-generation-dashboard`. Dejalo **vacío** (sin README, sin .gitignore).
2. En tu computadora, dentro de la carpeta del proyecto, corré:
   ```bash
   git init
   git add .
   git commit -m "Supply Generation dashboard"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/supply-generation-dashboard.git
   git push -u origin main
   ```
   > Si ya estás trabajando este código en otro repo, alcanza con crear el repo nuevo
   > en GitHub y hacer `push` ahí.

### B. Crear la base de datos en Supabase

1. Entrá a <https://supabase.com> → **New project**. Elegí un nombre y una contraseña
   para la base (guardala). Esperá ~1 minuto a que se cree.
2. En el menú izquierdo → **SQL Editor** → **New query**.
3. Abrí el archivo [`supabase-schema.sql`](./supabase-schema.sql) de este proyecto,
   copiá **todo** su contenido, pegalo en el editor y apretá **Run**. Crea las tablas,
   índices y permisos.
4. Andá a **Project Settings → API** y copiá estos dos valores (los usás en el paso C):
   - **Project URL** → será `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** / **publishable key** → será `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### C. Deployar en Vercel (público, sin contraseña)

1. Entrá a <https://vercel.com> e iniciá sesión con tu cuenta de GitHub.
2. **Add New → Project** → elegí el repo `supply-generation-dashboard` → **Import**.
3. En **Environment Variables** agregá las dos variables del paso B4:
   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | la Project URL de Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la anon/publishable key |
4. Apretá **Deploy**. En 1–2 minutos vas a tener una URL pública (ej:
   `supply-generation-dashboard.vercel.app`). **No tiene contraseña**: cualquiera con el
   link entra y puede ver y cargar datos. Compartila con Marketing y Attraction.

> Si cambiás las variables de entorno en Vercel, hacé **Redeploy** para que tomen efecto.

---

## 💻 Correr en local (opcional, para probar antes)

```bash
npm install
cp .env.example .env.local   # y completá las dos variables con tus valores de Supabase
npm run dev                  # http://localhost:3000
```

## Modelo de datos

- `weeks` — una fila por semana (lunes + insights).
- `opportunities` — búsquedas mostradas esa semana (rol, empresa, seniority, postulaciones,
  presentados, confirmados, fecha opcional).
- `contents` — piezas publicadas (canal, título, views, URL opcional).
- `content_opportunities` — tabla puente: qué oportunidades aparecieron en cada contenido.

No hay autenticación: el sitio es público a propósito (herramienta interna).
