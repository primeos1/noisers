import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { PAGES, SITE_URL, playerMeta, renderHead, type PageMeta } from './src/seo.ts'

// As positionNames in src/lib/clubData.ts (which needs the DOM, so can't load here).
const POSITIONS = { GK: 'Goalkeeper', DEF: 'Defender', MID: 'Midfielder', FWD: 'Forward' }
type Position = keyof typeof POSITIONS
const positionNames = (p: { position: Position; secondaryPosition: Position | null }) =>
  p.secondaryPosition ? `${POSITIONS[p.position]} / ${POSITIONS[p.secondaryPosition]}` : POSITIONS[p.position]

interface ApiPlayer {
  id: number
  number: number
  name: string
  position: Position
  secondaryPosition: Position | null
  photoUrl: string | null
  active: boolean
  appearances: number
  goals: number
  assists: number
  cleanSheets: number
}

async function fetchPlayers(apiUrl: string): Promise<ApiPlayer[]> {
  try {
    const res = await fetch(`${apiUrl}/players`, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return ((await res.json()) as { data: ApiPlayer[] }).data
  } catch (err) {
    console.warn(`[seo] Couldn't load players from ${apiUrl} — skipping player pages (${err})`)
    return []
  }
}

// Writes a copy of index.html per public page and player, each with its own
// <head> (renderHead in src/seo.ts), plus sitemap.xml and robots.txt. The
// app itself is unchanged; start.js serves these at their clean URLs.
function seoPlugin(apiUrl: string): Plugin {
  const SEO_BLOCK = /<!--seo-->[\s\S]*?<!--\/seo-->/
  const block = (meta: PageMeta, pathname: string) => `<!--seo-->\n    ${renderHead(meta, pathname)}\n    <!--/seo-->`
  let outDir = 'dist'
  let isBuild = false

  return {
    name: 'noisers-seo',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
      isBuild = config.command === 'build'
    },
    transformIndexHtml: (html) => html.replace(SEO_BLOCK, () => block(PAGES[0], '/')),
    async closeBundle() {
      if (!isBuild) return
      const template = await readFile(path.join(outDir, 'index.html'), 'utf8')
      const write = async (pathname: string, meta: PageMeta) => {
        const file = path.join(outDir, `${pathname.slice(1)}.html`)
        await mkdir(path.dirname(file), { recursive: true })
        await writeFile(file, template.replace(SEO_BLOCK, () => block(meta, pathname)))
      }

      for (const page of PAGES.slice(1)) await write(page.path, page)

      const players = await fetchPlayers(apiUrl)
      for (const p of players) {
        await write(`/squad/${p.id}`, playerMeta({ ...p, positionName: positionNames(p) }))
      }

      const urls = [
        ...PAGES.map((p) => ({ loc: `${SITE_URL}${p.path}`, changefreq: p.changefreq, priority: p.priority })),
        ...players
          .filter((p) => p.active)
          .map((p) => ({ loc: `${SITE_URL}/squad/${p.id}`, changefreq: 'weekly', priority: 0.6 })),
      ]
      const lastmod = new Date().toISOString().slice(0, 10)
      const sitemap = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...urls.map(
          (u) =>
            `  <url><loc>${u.loc}</loc><lastmod>${lastmod}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority.toFixed(1)}</priority></url>`,
        ),
        '</urlset>',
        '',
      ].join('\n')
      await writeFile(path.join(outDir, 'sitemap.xml'), sitemap)

      const robots = [
        'User-agent: *',
        'Allow: /',
        'Disallow: /admin',
        'Disallow: /portal',
        'Disallow: /login',
        'Disallow: /player-login',
        'Disallow: /join',
        '',
        `Sitemap: ${SITE_URL}/sitemap.xml`,
        '',
      ].join('\n')
      await writeFile(path.join(outDir, 'robots.txt'), robots)

      console.log(`[seo] Wrote ${PAGES.length - 1} pages, ${players.length} player pages, sitemap.xml (${urls.length} URLs) and robots.txt`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const apiUrl = env.VITE_API_URL || 'https://api.noisersfc.com/api'
  return {
    plugins: [react(), tailwindcss(), seoPlugin(apiUrl)],
  }
})
