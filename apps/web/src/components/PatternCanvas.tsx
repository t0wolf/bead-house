import { useEffect, useRef } from 'react'
import type { BeadPaletteColor, BeadPattern } from '@bead/shared-types'

type PatternCanvasProps = {
  pattern: BeadPattern
  palette: BeadPaletteColor[]
  selectedColorCode: string | null
  showLabels: boolean
}

const VIEWPORT_SIZE = 1040
const MIN_CELL_SIZE = 12
const MAX_CELL_SIZE = 28
const RULER_SIZE = 30

export function PatternCanvas({
  pattern,
  palette,
  selectedColorCode,
  showLabels
}: PatternCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    const colorMap = new Map(palette.map((color) => [color.code, color]))
    const cellSize = Math.min(
      MAX_CELL_SIZE,
      Math.max(
        MIN_CELL_SIZE,
        Math.floor(Math.min(VIEWPORT_SIZE / pattern.width, VIEWPORT_SIZE / pattern.height))
      )
    )
    const gridWidth = pattern.width * cellSize
    const gridHeight = pattern.height * cellSize
    const width = gridWidth + RULER_SIZE
    const height = gridHeight + RULER_SIZE

    canvas.width = width
    canvas.height = height

    context.clearRect(0, 0, width, height)
    context.imageSmoothingEnabled = false

    drawCanvasBackground(context, width, height)
    drawRulers(context, pattern.width, pattern.height, cellSize)

    for (const cell of pattern.cells) {
      const left = RULER_SIZE + cell.x * cellSize
      const top = RULER_SIZE + cell.y * cellSize
      const isSelected = cell.colorCode === selectedColorCode
      const isDimmed =
        selectedColorCode !== null &&
        cell.colorCode !== null &&
        cell.colorCode !== selectedColorCode

      if (cell.colorCode) {
        const color = colorMap.get(cell.colorCode)
        const [red, green, blue] = color?.rgb ?? [0, 0, 0]
        context.fillStyle = isDimmed
          ? `rgba(${red}, ${green}, ${blue}, 0.16)`
          : `rgb(${red}, ${green}, ${blue})`
        context.fillRect(left, top, cellSize, cellSize)
      } else {
        context.fillStyle =
          selectedColorCode === null ? 'rgba(255,255,255,0.98)' : 'rgba(255,255,255,0.42)'
        context.fillRect(left, top, cellSize, cellSize)
      }

      context.strokeStyle = isSelected
        ? 'rgba(17, 32, 49, 0.92)'
        : 'rgba(17, 32, 49, 0.22)'
      context.lineWidth = isSelected ? 2.4 : 1
      context.strokeRect(left, top, cellSize, cellSize)

      if (showLabels && cell.colorCode && cellSize >= 16) {
        const color = colorMap.get(cell.colorCode)
        context.fillStyle = pickLabelColor(color?.rgb ?? [0, 0, 0], isDimmed)
        context.font = `700 ${Math.max(6, Math.floor(cellSize * 0.22))}px sans-serif`
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.fillText(cell.colorCode, left + cellSize / 2, top + cellSize / 2)
      }
    }
  }, [palette, pattern, selectedColorCode, showLabels])

  return (
    <div className="pattern-canvas-wrap">
      <canvas className="pattern-canvas" ref={canvasRef} />
    </div>
  )
}

function drawCanvasBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  context.fillStyle = '#fffaf3'
  context.fillRect(0, 0, width, height)

  context.fillStyle = '#f3e7d5'
  context.fillRect(0, 0, RULER_SIZE, height)
  context.fillRect(0, 0, width, RULER_SIZE)

  context.fillStyle = '#d7833b'
  context.fillRect(0, 0, RULER_SIZE, RULER_SIZE)
}

function drawRulers(
  context: CanvasRenderingContext2D,
  columns: number,
  rows: number,
  cellSize: number
) {
  context.strokeStyle = 'rgba(17, 32, 49, 0.28)'
  context.fillStyle = '#182433'
  context.font = `${Math.max(8, Math.floor(cellSize * 0.45))}px sans-serif`
  context.textAlign = 'center'
  context.textBaseline = 'middle'

  for (let column = 0; column < columns; column += 1) {
    const x = RULER_SIZE + column * cellSize
    context.beginPath()
    context.moveTo(x, 0)
    context.lineTo(x, RULER_SIZE)
    context.stroke()
    context.fillText(String(column), x + cellSize / 2, RULER_SIZE / 2)
  }

  context.beginPath()
  context.moveTo(RULER_SIZE + columns * cellSize, 0)
  context.lineTo(RULER_SIZE + columns * cellSize, RULER_SIZE)
  context.stroke()
  context.textAlign = 'center'
  for (let row = 0; row < rows; row += 1) {
    const y = RULER_SIZE + row * cellSize
    context.beginPath()
    context.moveTo(0, y)
    context.lineTo(RULER_SIZE, y)
    context.stroke()
    context.fillText(String(row), RULER_SIZE / 2, y + cellSize / 2)
  }

  context.beginPath()
  context.moveTo(0, RULER_SIZE + rows * cellSize)
  context.lineTo(RULER_SIZE, RULER_SIZE + rows * cellSize)
  context.stroke()
}

function pickLabelColor(
  rgb: [number, number, number],
  isDimmed: boolean
) {
  if (isDimmed) {
    return 'rgba(17, 32, 49, 0.46)'
  }

  const brightness = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000
  return brightness > 150 ? '#182433' : '#ffffff'
}
