# Supply Generation Dashboard

Tablero interno de Seeds para medir el **funnel semanal de generación de talento**
(proyecto interárea **Marketing × Attraction**). Acceso abierto, sin contraseña.

- **Funnel semanal** con métricas globales y gráfico combinado (línea = views, barras = postulaciones).
- **Semanas desplegables** con detalle de oportunidades (rol, empresa, seniority,
  postulaciones / presentados / confirmados), contenidos por canal (LinkedIn / Instagram / TikTok)
  con views y vínculo contenido ↔ oportunidad, e insights editoriales por semana.
- **Carga manual** en `/cargar`. El funnel se calcula automáticamente desde el detalle.

## Stack
Next.js 16 · React 19 · Tailwind 4 · Recharts · Supabase.

## Setup
1. Crear las tablas: correr `supabase-schema.sql` en el SQL Editor de Supabase.
2. Variables de entorno (en Vercel y/o `.env.local`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. `npm install && npm run dev` → http://localhost:3000

## Deploy
Proyecto independiente en Vercel. Importar este repo, setear las dos variables de
entorno y deployar. El link resultante es público (sin login).

<!-- deploy: supply-app root para Vercel -->
