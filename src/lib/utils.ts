import { createCn } from 'cn/engine'

import tables from './cn-tables'

/**
 * Class-name merging, fitted to this project.
 *
 * `cn-tables.ts` is generated from the source files and the theme in
 * `src/styles`, so it knows the Kollide type scale (`text-h1` is a size, not a
 * colour) and ships only the rules the app uses. The Vite plugin keeps it up to
 * date in development, and `npm run build` regenerates it.
 */
export const cn = createCn(tables)
