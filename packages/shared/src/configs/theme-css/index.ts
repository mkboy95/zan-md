/** CSS theme strings for JavaScript consumers */

import type { MarketplaceThemeKey } from '../../types/marketplace'
import baseCSS from './base.css?raw'
import defaultCSS from './default.css?raw'
import dopamineCSS from './dopamine.css?raw'
import emeraldCSS from './emerald.css?raw'
import graceCSS from './grace.css?raw'
import inkCSS from './ink.css?raw'
import morandiCSS from './morandi.css?raw'
import orangeCSS from './orange.css?raw'
import roseCSS from './rose.css?raw'
import safflowerCSS from './safflower.css?raw'
import sakuraCSS from './sakura.css?raw'
import simpleCSS from './simple.css?raw'
import techblueCSS from './techblue.css?raw'
import weikeCSS from './weike.css?raw'

export const baseCSSContent = baseCSS

export const themeMap = {
  default: defaultCSS,
  grace: graceCSS,
  simple: simpleCSS,
  weike: weikeCSS,
  dopamine: dopamineCSS,
  rose: roseCSS,
  orange: orangeCSS,
  ink: inkCSS,
  safflower: safflowerCSS,
  morandi: morandiCSS,
  techblue: techblueCSS,
  sakura: sakuraCSS,
  emerald: emeraldCSS,
} as const

export type BuiltinThemeName = keyof typeof themeMap

/** Built-in theme id, or marketplace theme key (`mp:<id>`). */
export type ThemeName = BuiltinThemeName | MarketplaceThemeKey

export function isBuiltinThemeName(name: string): name is BuiltinThemeName {
  return Object.keys(themeMap).includes(name)
}
