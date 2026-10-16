import type { PdfExportOptions } from '@/services/export'
import { t } from '@/i18n/translate'
import {
  copyZhihuHtml,
  DEFAULT_PNG_SEGMENT_HEIGHT,
  downloadMD,
  downloadZhihuHtmlFile,
  exportHTML,
  exportPDF,
  exportPNG,
  exportPNGPoster,
  exportPNGSegments,
  exportPureHTML,
  exportXiaohongshu,
  getHtmlContent,
} from '@/services/export'
import { usePostStore } from './post'
import { useUIStore } from './ui'

/** Export helpers: HTML, PDF, Markdown, card image, etc. */
export const useExportStore = defineStore(`export`, () => {
  const postStore = usePostStore()
  const uiStore = useUIStore()

  const editorContent2HTML = () => getHtmlContent()

  const exportEditorContent2HTML = async () => {
    const currentPost = postStore.currentPost
    if (!currentPost)
      return

    await exportHTML(currentPost.title)
  }

  const exportEditorContent2PureHTML = (content: string) => {
    const currentPost = postStore.currentPost
    if (!currentPost)
      return

    exportPureHTML(content, currentPost.title)
  }

  const downloadAsCardImage = async () => {
    const currentPost = postStore.currentPost
    if (!currentPost)
      return

    await exportPNG(currentPost.title, {
      previewDevice: uiStore.previewDevice,
    })
  }

  const downloadAsSegmentedImages = async (maxSegmentHeight = DEFAULT_PNG_SEGMENT_HEIGHT) => {
    const currentPost = postStore.currentPost
    if (!currentPost)
      return

    const toastId = toast.loading(t(`store.png.segmentsStart`))
    try {
      const count = await exportPNGSegments(currentPost.title, {
        previewDevice: uiStore.previewDevice,
        maxSegmentHeight,
        onProgress: (done, total) => {
          toast.loading(t(`store.png.segmentsProgress`, { done, total }), { id: toastId })
        },
      })

      if (count === 0)
        toast.error(t(`store.png.segmentsEmpty`), { id: toastId })
      else
        toast.success(t(`store.png.segmentsDone`, { count }), { id: toastId })
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(t(`store.png.segmentsFailed`, { message }), { id: toastId })
    }
  }

  const downloadAsPosterImage = async (showCover = true) => {
    const currentPost = postStore.currentPost
    if (!currentPost)
      return

    const toastId = toast.loading(t(`store.png.posterStart`))
    try {
      const { count, mode, downscaled } = await exportPNGPoster(currentPost.title, {
        previewDevice: uiStore.previewDevice,
        showCover,
        onProgress: (done, total) => {
          toast.loading(t(`store.png.segmentsProgress`, { done, total }), { id: toastId })
        },
      })

      if (count === 0)
        toast.error(t(`store.png.segmentsEmpty`), { id: toastId })
      else if (mode === `segments`)
        toast.success(t(`store.png.posterFallbackDone`, { count }), { id: toastId })
      else if (downscaled)
        toast.success(t(`store.png.posterDoneScaled`), { id: toastId })
      else
        toast.success(t(`store.png.posterDone`), { id: toastId })
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(t(`store.png.posterFailed`, { message }), { id: toastId })
    }
  }

  const exportEditorContent2PDF = async (options?: Partial<PdfExportOptions>) => {
    const currentPost = postStore.currentPost
    if (!currentPost)
      return

    await exportPDF(currentPost.title, options)
  }

  const exportEditorContent2MD = (content: string) => {
    const currentPost = postStore.currentPost
    if (!currentPost)
      return

    downloadMD(content, currentPost.title)
  }

  /** Copy the article as Zhihu-ready semantic HTML. */
  const copyAsZhihu = async () => {
    const toastId = toast.loading(t(`store.platform.zhihuStart`))
    try {
      const { hasPendingAsyncContent } = await copyZhihuHtml()
      if (hasPendingAsyncContent)
        toast.warning(t(`toast.asyncContentPending`), { id: toastId })
      toast.success(t(`store.platform.zhihuCopied`), { id: toastId })
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(t(`store.platform.zhihuFailed`, { message }), { id: toastId })
    }
  }

  /** Download the article as a standalone Zhihu-ready `.html` file. */
  const downloadAsZhihuHtml = async () => {
    const currentPost = postStore.currentPost
    if (!currentPost)
      return

    const toastId = toast.loading(t(`store.platform.zhihuStart`))
    try {
      await downloadZhihuHtmlFile(currentPost.title)
      toast.success(t(`store.platform.zhihuDownloadDone`), { id: toastId })
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(t(`store.platform.zhihuFailed`, { message }), { id: toastId })
    }
  }

  /** Export a Xiaohongshu long image and copy the trimmed caption. */
  const exportAsXiaohongshu = async (markdown: string) => {
    const currentPost = postStore.currentPost
    if (!currentPost)
      return

    const toastId = toast.loading(t(`store.platform.xhsStart`))
    try {
      const { images, mode, downscaled, copied } = await exportXiaohongshu({
        previewDevice: uiStore.previewDevice,
        title: currentPost.title,
        markdown,
        onProgress: (done, total) => {
          toast.loading(t(`store.png.segmentsProgress`, { done, total }), { id: toastId })
        },
      })

      if (images === 0)
        toast.error(t(`store.platform.xhsEmpty`), { id: toastId })
      else if (mode === `segments`)
        toast.success(t(`store.platform.xhsFallbackDone`, { count: images }), { id: toastId })
      else if (!copied)
        toast.warning(t(`store.platform.xhsNoCaption`), { id: toastId })
      else if (downscaled)
        toast.success(t(`store.platform.xhsDoneScaled`), { id: toastId })
      else
        toast.success(t(`store.platform.xhsDone`), { id: toastId })
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(t(`store.platform.xhsFailed`, { message }), { id: toastId })
    }
  }

  return {
    editorContent2HTML,
    exportEditorContent2HTML,
    exportEditorContent2PureHTML,
    downloadAsCardImage,
    downloadAsSegmentedImages,
    downloadAsPosterImage,
    copyAsZhihu,
    downloadAsZhihuHtml,
    exportAsXiaohongshu,
    exportEditorContent2PDF,
    exportEditorContent2MD,
  }
})
