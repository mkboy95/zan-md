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
  // 以下五套为新增模板主题（mdnice 一系高人气用色 + 多巴胺撞色的重排）
  dopamine: {
    label: `多巴胺`,
    value: `dopamine`,
    desc: `高饱和撞色`,
  },
  rose: {
    label: `蔷薇紫`,
    value: `rose`,
    desc: `优雅柔紫`,
  },
  orange: {
    label: `橙心`,
    value: `orange`,
    desc: `暖橙活力`,
  },
  ink: {
    label: `墨黑`,
    value: `ink`,
    desc: `黑白极简`,
  },
  safflower: {
    label: `山吹`,
    value: `safflower`,
    desc: `暖金黄`,
  },
  morandi: {
    label: `莫兰迪`,
    value: `morandi`,
    desc: `低饱和灰调`,
  },
  techblue: {
    label: `科技蓝`,
    value: `techblue`,
    desc: `现代科技感`,
  },
  sakura: {
    label: `樱花粉`,
    value: `sakura`,
    desc: `柔和粉色`,
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
  {
    label: `多巴胺`,
    value: `dopamine`,
    desc: `高饱和撞色`,
  },
  {
    label: `蔷薇紫`,
    value: `rose`,
    desc: `优雅柔紫`,
  },
  {
    label: `橙心`,
    value: `orange`,
    desc: `暖橙活力`,
  },
  {
    label: `墨黑`,
    value: `ink`,
    desc: `黑白极简`,
  },
  {
    label: `山吹`,
    value: `safflower`,
    desc: `暖金黄`,
  },
  {
    label: `莫兰迪`,
    value: `morandi`,
    desc: `低饱和灰调`,
  },
  {
    label: `科技蓝`,
    value: `techblue`,
    desc: `现代科技感`,
  },
  {
    label: `樱花粉`,
    value: `sakura`,
    desc: `柔和粉色`,
  },
]
