import { useEffect, useMemo, useState } from 'react'
import { mardPalette } from '@bead/bead-palettes'
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

export default function App() {
  const [sourceImageData, setSourceImageData] = useState<ImageData | null>(null)
  const [sourceName, setSourceName] = useState<string | undefined>()
  const [pattern, setPattern] = useState<BeadPattern | null>(null)
  const [selectedColorCode, setSelectedColorCode] = useState<string | null>(null)
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

  const colorSummary = useMemo(
    () => (pattern ? patternToColorSummary(pattern, mardPalette) : []),
    [pattern]
  )

  useEffect(() => {
    if (!sourceImageData) {
      return
    }

    try {
      const nextPattern = convertImageToPattern({
        imageData: sourceImageData,
        palette: mardPalette,
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

  return (
    <main className="page-shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">MARD Beads Studio</p>
          <h1>郑皓钧的拼豆小屋</h1>
          <p className="hero-copy">
            自定义宽高、限色、透明背景和抖动策略，生成带坐标轴、色号标注和单色高亮的 MARD 拼豆图纸。
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
              max={mardPalette.length}
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
            palette={mardPalette}
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
    </main>
  )
}
