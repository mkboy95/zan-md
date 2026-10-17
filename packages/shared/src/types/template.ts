export interface Template {
  id: string
  name: string
  content: string
  description?: string
  createdAt: number
  updatedAt: number
  tags?: string[]
  /** 应用该模板时自动切换到的主题 id（用于内置版式模板）。 */
  theme?: string
  /** 内置模板：随应用分发，不可编辑/删除。 */
  builtin?: boolean
}

export interface CreateTemplateParams {
  name: string
  content: string
  description?: string
  tags?: string[]
}

export interface UpdateTemplateParams {
  name?: string
  content?: string
  description?: string
  tags?: string[]
}
