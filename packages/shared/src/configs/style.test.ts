import { describe, expect, it } from 'vitest'
import { defaultPerThemeSettings, defaultStyleConfig, perThemeDefaultSettings, perThemeSettingOverrides } from './style'

describe(`perThemeDefaultSettings`, () => {
  it(`gives 超赞绿 its own green primary colour instead of the generic blue`, () => {
    const settings = perThemeDefaultSettings(`weike`)
    expect(settings.primaryColor).toBe(`#21A675`)
    expect(settings.primaryColor).not.toBe(defaultStyleConfig.primaryColor)
  })

  it(`uses the serif stack the 超赞绿 design was ported with`, () => {
    expect(perThemeDefaultSettings(`weike`).fontFamily).toContain(`Optima`)
  })

  it(`merges overrides onto the generic defaults, filling every field`, () => {
    const settings = perThemeDefaultSettings(`weike`)
    expect(settings).toEqual({ ...defaultPerThemeSettings(), ...perThemeSettingOverrides.weike })
    expect(settings.fontSize).toBe(defaultStyleConfig.fontSize)
    expect(settings.isMacCodeBlock).toBe(defaultStyleConfig.isMacCodeBlock)
  })

  it(`keeps the generic defaults for themes without overrides`, () => {
    expect(perThemeDefaultSettings(`default`)).toEqual(defaultPerThemeSettings())
    expect(perThemeDefaultSettings(`grace`)).toEqual(defaultPerThemeSettings())
    expect(perThemeDefaultSettings(`simple`)).toEqual(defaultPerThemeSettings())
  })
})
