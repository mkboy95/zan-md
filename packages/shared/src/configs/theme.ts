import type { IConfigOption } from '../types'
import type { ThemeName } from './theme-css'

export {
  baseCSSContent,
  type BuiltinThemeName,
  isBuiltinThemeName,
  themeMap,
  type ThemeName,
} from './theme-css'

export const themeOptionsMap = {
  default: {
    label: `经典`,
    value: `default`,
    desc: ``,
  },
  grace: {
    label: `优雅`,
    value: `grace`,
    desc: `@brzhang`,
  },
  simple: {
    label: `简洁`,
    value: `simple`,
    desc: `@okooo5km`,
  },
  // 超赞绿。id 沿用上游移植时的 `weike`：本地存储与云同步里的主题偏好都按 id 落盘，
  // 改 id 会让已选中的偏好失效，所以只改展示名。
  weike: {
    label: `超赞绿`,
    value: `weike`,
    desc: `绿丝带标题`,
  },
}

export const themeOptions: IConfigOption<ThemeName>[] = [
  {
    label: `经典`,
    value: `default`,
    desc: ``,
  },
  {
    label: `优雅`,
    value: `grace`,
    desc: `@brzhang`,
  },
  {
    label: `简洁`,
    value: `simple`,
    desc: `@okooo5km`,
  },
  {
    label: `超赞绿`,
    value: `weike`,
    desc: `绿丝带标题`,
  },
]
