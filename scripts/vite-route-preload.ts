import type { Plugin, ResolvedConfig } from 'vite'

/** A page whose code should start downloading with the first bundle, not after it. */
export interface PreloadRoute {
  /** Tested against `location.pathname`. */
  pattern: RegExp
  /** Source files whose chunks the page needs, relative to the project root. */
  modules: string[]
}

type Chunk = { type: 'chunk'; fileName: string; imports: string[]; facadeModuleId: string | null; isEntry: boolean }

/**
 * A single-page app finds out what a page needs only after its main bundle has
 * downloaded and run. On a slow phone that is a whole extra wait before the
 * page's own code, and then its data and images, can even be requested.
 *
 * This adds a few lines to index.html that look at the address and start
 * those downloads straight away, alongside the main bundle. It only names
 * files; nothing runs earlier than it otherwise would.
 */
export function routePreload({ routes, everywhereButHome }: { routes: PreloadRoute[]; everywhereButHome: string[] }): Plugin {
  let config: ResolvedConfig
  return {
    name: 'kollide:route-preload',
    apply: 'build',
    configResolved(resolved) {
      config = resolved
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, context) {
        const bundle = context.bundle
        if (!bundle) return html
        const chunks = Object.values(bundle).filter((item): item is Chunk & typeof item => item.type === 'chunk') as unknown as Chunk[]
        const entry = chunks.find((chunk) => chunk.isEntry)
        if (!entry) return html
        // Everything the entry imports statically is already preloaded by Vite.
        const alreadyLoaded = new Set([entry.fileName, ...entry.imports])
        const byFile = new Map(chunks.map((chunk) => [chunk.fileName, chunk]))

        const filesFor = (modules: string[]): string[] => {
          const files = new Set<string>()
          const visit = (chunk: Chunk | undefined) => {
            if (!chunk || files.has(chunk.fileName) || alreadyLoaded.has(chunk.fileName)) return
            files.add(chunk.fileName)
            for (const imported of chunk.imports) visit(byFile.get(imported))
          }
          for (const module of modules) {
            const found = chunks.find((chunk) => chunk.facadeModuleId?.replaceAll('\\', '/').endsWith(module))
            if (!found) console.warn(`route-preload: no chunk for ${module}`)
            visit(found)
          }
          return [...files]
        }

        const table = routes.map((route) => [route.pattern.source, filesFor(route.modules)])
        const common = filesFor(everywhereButHome)
        const script = `;(function () {
  var base = ${JSON.stringify(config.base)}, path = location.pathname, head = document.head, seen = {}
  function preload(file) {
    if (seen[file]) return
    seen[file] = 1
    var link = document.createElement('link')
    link.rel = 'modulepreload'
    link.href = base + file
    head.appendChild(link)
  }
  var routes = ${JSON.stringify(table)}
  if (path !== base) ${JSON.stringify(common)}.forEach(preload)
  for (var i = 0; i < routes.length; i++) if (new RegExp(routes[i][0]).test(path)) { routes[i][1].forEach(preload); break }
})()`

        return [{ tag: 'script', children: script, injectTo: 'head' }]
      },
    },
  }
}
