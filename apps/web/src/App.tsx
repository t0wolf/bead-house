import { useEffect, useMemo, useState } from 'react'
import { mardPalette, ownedMardPalette } from '@bead/bead-palettes'
import {
  convertImageToPattern,
  patternToColorSummary,
  readFileAsImageData
} from '@bead/pattern-engine'
import type {
  BeadPattern,
  ColorDistanceMode,
  DitherMode,
  TransparentHandlingMode
} from '@bead/shared-types'
import { PatternCanvas } from './components/PatternCanvas'

const DISTANCE_OPTIONS: Array<{ value: ColorDistanceMode; label: string }> = [
  { value: 'lab', label: 'Lab 感知距离' },
  { value: 'weighted-rgb', label: '加权 RGB' },
  { value: 'rgb', label: '标准 RGB' }
]

const DITHER_OPTIONS: Array<{ value: DitherMode; label: string }> = [
  { value: 'none', label: '关闭抖动' },
  { value: 'floyd-steinberg', label: 'Floyd-Steinberg' }
]

const TRANSPARENCY_OPTIONS: Array<{
  value: TransparentHandlingMode
  label: string
}> = [
  { value: 'empty', label: '透明区域保留为空格' },
  { value: 'white', label: '透明区域转白色拼豆' }
]

type FeaturedImage = {
  id: string
  title: string
  description: string
  imageUrl: string
  createdAt: number
  source: 'preset' | 'local'
}

const FEATURED_IMAGES_STORAGE_KEY = 'bead-house-featured-images'
const FEATURED_IMAGES_MANIFEST_URL = '/featured-images/manifest.json'

export default function App() {
  const [sourceImageData, setSourceImageData] = useState<ImageData | null>(null)
  const [sourceName, setSourceName] = useState<string | undefined>()
  const [pattern, setPattern] = useState<BeadPattern | null>(null)
  const [selectedColorCode, setSelectedColorCode] = useState<string | null>(null)
  const [selectedFeaturedId, setSelectedFeaturedId] = useState<string | null>(null)
  const [gridWidth, setGridWidth] = useState(32)
  const [gridHeight, setGridHeight] = useState(32)
  const [maxColors, setMaxColors] = useState(12)
  const [transparencyThreshold, setTransparencyThreshold] = useState(16)
  const [transparentHandling, setTransparentHandling] =
    useState<TransparentHandlingMode>('empty')
  const [distanceMode, setDistanceMode] = useState<ColorDistanceMode>('lab')
  const [ditherMode, setDitherMode] = useState<DitherMode>('none')
  const [showLabels, setShowLabels] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [featuredImages, setFeaturedImages] = useState<FeaturedImage[]>([])
  const [presetFeaturedImages, setPresetFeaturedImages] = useState<FeaturedImage[]>([])
  const [favoriteTitle, setFavoriteTitle] = useState('')
  const [favoriteDescription, setFavoriteDescription] = useState('')
  const [favoriteError, setFavoriteError] = useState<string | null>(null)
  const [savingFavorite, setSavingFavorite] = useState(false)

  const colorSummary = useMemo(
    () => (pattern ? patternToColorSummary(pattern, ownedMardPalette) : []),
    [pattern]
  )
  const allFeaturedImages = useMemo(
    () =>
      [...presetFeaturedImages, ...featuredImages].sort(
        (left, right) => right.createdAt - left.createdAt
      ),
    [featuredImages, presetFeaturedImages]
  )

  useEffect(() => {
    let active = true

    async function loadPresetImages() {
      try {
        const response = await fetch(FEATURED_IMAGES_MANIFEST_URL)
        if (!response.ok) {
          return
        }

        const parsed = (await response.json()) as Array<{
          id: string
          title: string
          description?: string
          imageUrl: string
          createdAt?: number
        }>

        if (!active || !Array.isArray(parsed)) {
          return
        }

        setPresetFeaturedImages(
          parsed.map((item, index) => ({
            id: item.id,
            title: item.title,
            description: item.description ?? '',
            imageUrl: item.imageUrl,
            createdAt: item.createdAt ?? index,
            source: 'preset'
          }))
        )
      } catch {
        setPresetFeaturedImages([])
      }
    }

    void loadPresetImages()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FEATURED_IMAGES_STORAGE_KEY)
      if (!raw) {
        return
      }

      const parsed = JSON.parse(raw) as FeaturedImage[]
      if (Array.isArray(parsed)) {
        setFeaturedImages(
          parsed.map((item) => ({
            ...item,
            source: 'local' as const
          }))
        )
      }
    } catch {
      setFeaturedImages([])
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(
      FEATURED_IMAGES_STORAGE_KEY,
      JSON.stringify(featuredImages)
    )
  }, [featuredImages])

  useEffect(() => {
    if (!sourceImageData) {
      return
    }

    try {
      const nextPattern = convertImageToPattern({
        imageData: sourceImageData,
        palette: ownedMardPalette,
        sourceName,
        targetWidth: gridWidth,
        targetHeight: gridHeight,
        maxColors,
        transparencyThreshold,
        transparentHandling,
        distanceMode,
        ditherMode
      })
      setPattern(nextPattern)
      setError(null)
      setSelectedColorCode((current) =>
        current && nextPattern.paletteUsed.some((item) => item.colorCode === current)
          ? current
          : null
      )
    } catch (nextError) {
      setPattern(null)
      setError(nextError instanceof Error ? nextError.message : '图片处理失败')
    }
  }, [
    ditherMode,
    distanceMode,
    gridHeight,
    gridWidth,
    maxColors,
    sourceImageData,
    sourceName,
    transparencyThreshold,
    transparentHandling
  ])

  async function handleFileChange(file: File | null) {
    if (!file) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const imageData = await readFileAsImageData(file)
      setSourceImageData(imageData)
      setSourceName(file.name)
      setSelectedColorCode(null)
      setSelectedFeaturedId(null)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '图片读取失败')
      setSourceImageData(null)
      setPattern(null)
    } finally {
      setLoading(false)
    }
  }

  function toggleColorHighlight(colorCode: string) {
    setSelectedColorCode((current) => (current === colorCode ? null : colorCode))
  }

  async function handleFavoriteUpload(file: File | null) {
    if (!file) {
      return
    }

    setSavingFavorite(true)
    setFavoriteError(null)

    try {
      const imageUrl = await readFileAsDataUrl(file)
      const title = favoriteTitle.trim() || file.name.replace(/\.[^.]+$/, '')
      const description = favoriteDescription.trim()

      setFeaturedImages((current) => [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          title,
          description,
          imageUrl,
          createdAt: Date.now(),
          source: 'local'
        },
        ...current
      ])

      setFavoriteTitle('')
      setFavoriteDescription('')
    } catch (nextError) {
      setFavoriteError(nextError instanceof Error ? nextError.message : '收藏图片失败')
    } finally {
      setSavingFavorite(false)
    }
  }

  function removeFeaturedImage(id: string) {
    setFeaturedImages((current) => current.filter((item) => item.id !== id))
    setSelectedFeaturedId((current) => (current === id ? null : current))
  }

  async function handleFeaturedImageSelect(item: FeaturedImage) {
    setLoading(true)
    setError(null)

    try {
      const imageData = await readImageDataFromUrl(item.imageUrl)
      setSourceImageData(imageData)
      setSourceName(item.title)
      setSelectedColorCode(null)
      setSelectedFeaturedId(item.id)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '精选图片读取失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="page-shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">MARD Beads Studio</p>
          <h1>郑皓钧的拼豆小屋</h1>
          <p className="hero-signature">-------design by 潘瑞</p>
          <p className="hero-copy">
            自定义宽高、限色、透明背景和抖动策略，按你现有的 MARD 豆子库存生成带坐标轴和色号标注的拼豆图纸。
          </p>
        </div>

        <div className="controls-grid">
          <label className="input-group">
            <span>图纸宽度</span>
            <input
              type="number"
              min={1}
              max={256}
              value={gridWidth}
              onChange={(event) => setGridWidth(Number(event.target.value) || 1)}
            />
          </label>

          <label className="input-group">
            <span>图纸高度</span>
            <input
              type="number"
              min={1}
              max={256}
              value={gridHeight}
              onChange={(event) => setGridHeight(Number(event.target.value) || 1)}
            />
          </label>

          <label className="input-group">
            <span>最大颜色数</span>
            <input
              type="number"
              min={0}
              max={ownedMardPalette.length}
              value={maxColors}
              onChange={(event) => setMaxColors(Number(event.target.value) || 0)}
            />
          </label>

          <label className="input-group">
            <span>透明阈值</span>
            <input
              type="number"
              min={0}
              max={255}
              value={transparencyThreshold}
              onChange={(event) =>
                setTransparencyThreshold(Number(event.target.value) || 0)
              }
            />
          </label>

          <label className="input-group">
            <span>透明处理</span>
            <select
              value={transparentHandling}
              onChange={(event) =>
                setTransparentHandling(
                  event.target.value as TransparentHandlingMode
                )
              }
            >
              {TRANSPARENCY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="input-group">
            <span>颜色距离算法</span>
            <select
              value={distanceMode}
              onChange={(event) =>
                setDistanceMode(event.target.value as ColorDistanceMode)
              }
            >
              {DISTANCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="input-group">
            <span>抖动算法</span>
            <select
              value={ditherMode}
              onChange={(event) => setDitherMode(event.target.value as DitherMode)}
            >
              {DITHER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="toggle-card">
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(event) => setShowLabels(event.target.checked)}
            />
            <span>显示每颗豆的色号标注</span>
          </label>

          <label className="upload-button">
            <input
              type="file"
              accept="image/*"
              onChange={(event) =>
                handleFileChange(event.target.files?.[0] ?? null)
              }
            />
            <span>{loading ? '处理中…' : '上传图片'}</span>
          </label>
        </div>

        <p className="inventory-note">
          当前库存已限定为 A1-A26、B1-B30、C1-C29、D1-D26、E1-E24、F1-F25、G1-G21、H1-H23、M1-M15，共{' '}
          {ownedMardPalette.length} 种颜色。
        </p>

        {error ? <p className="error-text">{error}</p> : null}
      </section>

      <section className="panel viewer-panel">
        <header className="panel-header">
          <h2>交互式图纸看板</h2>
          {pattern ? (
            <span>
              {pattern.width} x {pattern.height} · 空格 {pattern.emptyCells}
            </span>
          ) : null}
        </header>
        {pattern ? (
            <PatternCanvas
              pattern={pattern}
              palette={ownedMardPalette}
              selectedColorCode={selectedColorCode}
              showLabels={showLabels}
            />
        ) : (
          <div className="empty-state">上传图片后会在这里生成大尺寸图纸看板</div>
        )}
      </section>

      <section className="panel">
        <header className="panel-header">
          <h2>用色统计与高亮</h2>
          <span>
            {colorSummary.length} 种颜色 · {selectedColorCode ?? '未选中'}
          </span>
        </header>
        {colorSummary.length > 0 ? (
          <div className="color-list">
            {colorSummary.map((entry) => {
              const isActive = entry.color.code === selectedColorCode

              return (
                <button
                  key={entry.color.code}
                  type="button"
                  className={`color-chip ${isActive ? 'is-active' : ''}`}
                  onClick={() => toggleColorHighlight(entry.color.code)}
                >
                  <span
                    className="swatch"
                    style={{
                      backgroundColor: `rgb(${entry.color.rgb.join(',')})`
                    }}
                  />
                  <span className="color-chip-copy">
                    <strong>{entry.color.code}</strong>
                    <span>
                      {entry.color.name} · {entry.count} 颗
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="empty-state">生成图纸后会自动统计颜色使用数量</div>
        )}
      </section>

      <section className="panel featured-panel">
        <header className="panel-header">
          <h2>精选图纸</h2>
          <span>{allFeaturedImages.length} 张图片</span>
        </header>

        <div className="featured-controls">
          <label className="input-group">
            <span>图片标题</span>
            <input
              type="text"
              value={favoriteTitle}
              placeholder="比如：连麻 Swimming"
              onChange={(event) => setFavoriteTitle(event.target.value)}
            />
          </label>

          <label className="input-group featured-description">
            <span>备注</span>
            <input
              type="text"
              value={favoriteDescription}
              placeholder="可以写专辑、角色、来源或灵感"
              onChange={(event) => setFavoriteDescription(event.target.value)}
            />
          </label>

          <label className="upload-button">
            <input
              type="file"
              accept="image/*"
              onChange={(event) =>
                handleFavoriteUpload(event.target.files?.[0] ?? null)
              }
            />
            <span>{savingFavorite ? '保存中…' : '添加到精选图纸'}</span>
          </label>
        </div>

        <p className="inventory-note">
          这里会同时显示你网页上传的本地收藏，以及 `public/featured-images/manifest.json`
          里配置的预置图片。放进 VSCode 的静态图片也能直接展示。
        </p>

        {favoriteError ? <p className="error-text">{favoriteError}</p> : null}

        {allFeaturedImages.length > 0 ? (
          <div className="featured-grid">
            {allFeaturedImages.map((item) => (
              <article
                key={item.id}
                className={`featured-card ${
                  selectedFeaturedId === item.id ? 'is-active' : ''
                }`}
              >
                <img
                  className="featured-image"
                  src={item.imageUrl}
                  alt={item.title}
                  onClick={() => void handleFeaturedImageSelect(item)}
                />
                <div className="featured-meta">
                  <strong>{item.title}</strong>
                  <span className="featured-source">
                    {item.source === 'preset' ? '预置图片' : '本地收藏'}
                  </span>
                  {item.description ? <p>{item.description}</p> : null}
                </div>
                <button
                  type="button"
                  className="featured-open"
                  onClick={() => void handleFeaturedImageSelect(item)}
                >
                  载入到交互式看板
                </button>
                {item.source === 'local' ? (
                  <button
                    type="button"
                    className="featured-delete"
                    onClick={(event) => {
                      event.stopPropagation()
                      removeFeaturedImage(item.id)
                    }}
                  >
                    删除
                  </button>
                ) : (
                  <div className="featured-hint">在 `public/featured-images` 中维护</div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state featured-empty">
            这里还没有收藏的图片。你可以把自己喜欢的专辑封面、奶龙图或者参考图先存进来。
          </div>
        )}
      </section>
    </main>
  )
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }
      reject(new Error('图片读取失败'))
    }
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.readAsDataURL(file)
  })
}

function readImageDataFromUrl(imageUrl: string) {
  return new Promise<ImageData>((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight

      const context = canvas.getContext('2d')
      if (!context) {
        reject(new Error('无法创建图片画布'))
        return
      }

      context.drawImage(image, 0, 0)
      resolve(context.getImageData(0, 0, canvas.width, canvas.height))
    }
    image.onerror = () => reject(new Error('精选图片读取失败'))
    image.src = imageUrl
  })
}
