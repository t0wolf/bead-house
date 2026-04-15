import type {
  BeadPaletteColor,
  BeadPattern,
  ColorDistanceMode,
  ConvertImageToPatternInput,
  DitherMode,
  PatternCell,
  PatternGenerationOptions,
  TransparentHandlingMode
} from '@bead/shared-types'

type Pixel = {
  red: number
  green: number
  blue: number
  alpha: number
}

type PreparedPixel = Pixel & {
  isTransparent: boolean
}

const DEFAULT_OPTIONS: Required<PatternGenerationOptions> = {
  targetWidth: 32,
  targetHeight: 32,
  maxColors: 0,
  transparencyThreshold: 16,
  transparentHandling: 'white',
  distanceMode: 'lab',
  ditherMode: 'none'
}

export async function readFileAsImageData(file: File): Promise<ImageData> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('无法创建图像处理画布')
  }

  context.drawImage(bitmap, 0, 0)
  return context.getImageData(0, 0, bitmap.width, bitmap.height)
}

export function convertImageToPattern(
  input: ConvertImageToPatternInput
): BeadPattern {
  const options = normalizeOptions(input)
  const resized = resizeImageDataNearest(
    input.imageData,
    options.targetWidth,
    options.targetHeight
  )

  const preparedPixels = createPreparedPixels(
    resized,
    options.transparencyThreshold,
    options.transparentHandling
  )
  const workingPixels =
    options.ditherMode === 'floyd-steinberg'
      ? applyFloydSteinbergDithering(
          preparedPixels,
          resized.width,
          resized.height,
          input.palette,
          options.distanceMode
        )
      : preparedPixels

  const initialAssignments = mapPixelsToPalette(
    workingPixels,
    input.palette,
    options.distanceMode
  )
  const limitedPalette = limitPalette(
    initialAssignments,
    input.palette,
    options.maxColors
  )
  const finalAssignments =
    limitedPalette.length === input.palette.length
      ? initialAssignments
      : mapPixelsToPalette(workingPixels, limitedPalette, options.distanceMode)

  return buildPattern(
    finalAssignments,
    resized.width,
    resized.height,
    options,
    input.sourceName
  )
}

export function patternToColorSummary(
  pattern: BeadPattern,
  palette: BeadPaletteColor[]
) {
  const paletteMap = new Map(palette.map((color) => [color.code, color]))

  return pattern.paletteUsed
    .map((usage) => ({
      color: paletteMap.get(usage.colorCode),
      count: usage.count
    }))
    .filter((entry): entry is { color: BeadPaletteColor; count: number } =>
      Boolean(entry.color)
    )
}

function normalizeOptions(
  input: ConvertImageToPatternInput
): Required<PatternGenerationOptions> {
  return {
    targetWidth: clampInt(input.targetWidth, 1, 256),
    targetHeight: clampInt(input.targetHeight, 1, 256),
    maxColors: clampInt(input.maxColors ?? DEFAULT_OPTIONS.maxColors, 0, 64),
    transparencyThreshold: clampInt(
      input.transparencyThreshold ?? DEFAULT_OPTIONS.transparencyThreshold,
      0,
      255
    ),
    transparentHandling:
      input.transparentHandling ?? DEFAULT_OPTIONS.transparentHandling,
    distanceMode: input.distanceMode ?? DEFAULT_OPTIONS.distanceMode,
    ditherMode: input.ditherMode ?? DEFAULT_OPTIONS.ditherMode
  }
}

function resizeImageDataNearest(
  source: ImageData,
  targetWidth: number,
  targetHeight: number
): ImageData {
  const output = new ImageData(targetWidth, targetHeight)

  for (let y = 0; y < targetHeight; y += 1) {
    const sourceY = Math.min(
      source.height - 1,
      Math.floor((y / targetHeight) * source.height)
    )

    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = Math.min(
        source.width - 1,
        Math.floor((x / targetWidth) * source.width)
      )
      const sourceOffset = (sourceY * source.width + sourceX) * 4
      const targetOffset = (y * targetWidth + x) * 4

      output.data[targetOffset] = source.data[sourceOffset]
      output.data[targetOffset + 1] = source.data[sourceOffset + 1]
      output.data[targetOffset + 2] = source.data[sourceOffset + 2]
      output.data[targetOffset + 3] = source.data[sourceOffset + 3]
    }
  }

  return output
}

function createPreparedPixels(
  imageData: ImageData,
  transparencyThreshold: number,
  transparentHandling: TransparentHandlingMode
) {
  const pixels: PreparedPixel[] = []

  for (let index = 0; index < imageData.data.length; index += 4) {
    const alpha = imageData.data[index + 3]
    const isTransparent = alpha <= transparencyThreshold

    if (isTransparent && transparentHandling === 'white') {
      pixels.push({
        red: 255,
        green: 255,
        blue: 255,
        alpha: 255,
        isTransparent: false
      })
      continue
    }

    pixels.push({
      red: imageData.data[index],
      green: imageData.data[index + 1],
      blue: imageData.data[index + 2],
      alpha,
      isTransparent
    })
  }

  return pixels
}

function applyFloydSteinbergDithering(
  pixels: PreparedPixel[],
  width: number,
  height: number,
  palette: BeadPaletteColor[],
  distanceMode: ColorDistanceMode
) {
  const buffer = pixels.map((pixel) => ({
    red: pixel.red,
    green: pixel.green,
    blue: pixel.blue,
    alpha: pixel.alpha,
    isTransparent: pixel.isTransparent
  }))

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x
      const pixel = buffer[index]

      if (pixel.isTransparent) {
        continue
      }

      const matched = findClosestPaletteColor(
        [pixel.red, pixel.green, pixel.blue],
        palette,
        distanceMode
      )
      const errorRed = pixel.red - matched.rgb[0]
      const errorGreen = pixel.green - matched.rgb[1]
      const errorBlue = pixel.blue - matched.rgb[2]

      pixel.red = matched.rgb[0]
      pixel.green = matched.rgb[1]
      pixel.blue = matched.rgb[2]

      diffuseError(buffer, width, x + 1, y, errorRed, errorGreen, errorBlue, 7 / 16)
      diffuseError(
        buffer,
        width,
        x - 1,
        y + 1,
        errorRed,
        errorGreen,
        errorBlue,
        3 / 16
      )
      diffuseError(buffer, width, x, y + 1, errorRed, errorGreen, errorBlue, 5 / 16)
      diffuseError(
        buffer,
        width,
        x + 1,
        y + 1,
        errorRed,
        errorGreen,
        errorBlue,
        1 / 16
      )
    }
  }

  return buffer
}

function diffuseError(
  pixels: PreparedPixel[],
  width: number,
  x: number,
  y: number,
  errorRed: number,
  errorGreen: number,
  errorBlue: number,
  factor: number
) {
  if (x < 0 || y < 0) {
    return
  }

  const index = y * width + x
  const pixel = pixels[index]
  if (!pixel || pixel.isTransparent) {
    return
  }

  pixel.red = clampChannel(pixel.red + errorRed * factor)
  pixel.green = clampChannel(pixel.green + errorGreen * factor)
  pixel.blue = clampChannel(pixel.blue + errorBlue * factor)
}

function mapPixelsToPalette(
  pixels: PreparedPixel[],
  palette: BeadPaletteColor[],
  distanceMode: ColorDistanceMode
) {
  return pixels.map((pixel) => {
    if (pixel.isTransparent) {
      return null
    }

    return findClosestPaletteColor(
      [pixel.red, pixel.green, pixel.blue],
      palette,
      distanceMode
    )
  })
}

function limitPalette(
  assignments: Array<BeadPaletteColor | null>,
  palette: BeadPaletteColor[],
  maxColors: number
) {
  if (maxColors <= 0 || maxColors >= palette.length) {
    return palette
  }

  const usage = new Map<string, number>()
  for (const assignment of assignments) {
    if (!assignment) {
      continue
    }
    usage.set(assignment.code, (usage.get(assignment.code) ?? 0) + 1)
  }

  const allowedCodes = new Set(
    Array.from(usage.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, maxColors)
      .map(([code]) => code)
  )

  const limited = palette.filter((color) => allowedCodes.has(color.code))
  return limited.length > 0 ? limited : palette.slice(0, maxColors)
}

function buildPattern(
  assignments: Array<BeadPaletteColor | null>,
  width: number,
  height: number,
  options: Required<PatternGenerationOptions>,
  sourceName?: string
): BeadPattern {
  const cells: PatternCell[] = []
  const usage = new Map<string, number>()
  let emptyCells = 0

  for (let index = 0; index < assignments.length; index += 1) {
    const assignment = assignments[index]
    const x = index % width
    const y = Math.floor(index / width)

    if (!assignment) {
      cells.push({ x, y, colorCode: null })
      emptyCells += 1
      continue
    }

    cells.push({ x, y, colorCode: assignment.code })
    usage.set(assignment.code, (usage.get(assignment.code) ?? 0) + 1)
  }

  return {
    id: createPatternId(sourceName),
    title: sourceName ? stripExtension(sourceName) : 'Untitled Pattern',
    width,
    height,
    sourceName,
    cells,
    paletteUsed: Array.from(usage.entries())
      .map(([colorCode, count]) => ({ colorCode, count }))
      .sort((left, right) => right.count - left.count),
    emptyCells,
    options
  }
}

function findClosestPaletteColor(
  rgb: [number, number, number],
  palette: BeadPaletteColor[],
  distanceMode: ColorDistanceMode
): BeadPaletteColor {
  let bestColor = palette[0]
  let minDistance = Number.POSITIVE_INFINITY

  for (const color of palette) {
    const distance = colorDistance(rgb, color.rgb, distanceMode)
    if (distance < minDistance) {
      minDistance = distance
      bestColor = color
    }
  }

  return bestColor
}

function colorDistance(
  left: [number, number, number],
  right: [number, number, number],
  mode: ColorDistanceMode
) {
  if (mode === 'lab') {
    const labLeft = rgbToLab(left)
    const labRight = rgbToLab(right)
    const deltaL = labLeft[0] - labRight[0]
    const deltaA = labLeft[1] - labRight[1]
    const deltaB = labLeft[2] - labRight[2]
    return deltaL * deltaL + deltaA * deltaA + deltaB * deltaB
  }

  const red = left[0] - right[0]
  const green = left[1] - right[1]
  const blue = left[2] - right[2]

  if (mode === 'weighted-rgb') {
    return red * red * 0.3 + green * green * 0.59 + blue * blue * 0.11
  }

  return red * red + green * green + blue * blue
}

function rgbToLab(rgb: [number, number, number]): [number, number, number] {
  const [red, green, blue] = rgb.map((channel) => channel / 255)
  const linear = [red, green, blue].map((channel) =>
    channel > 0.04045
      ? Math.pow((channel + 0.055) / 1.055, 2.4)
      : channel / 12.92
  ) as [number, number, number]

  const x =
    ((linear[0] * 0.4124 + linear[1] * 0.3576 + linear[2] * 0.1805) / 0.95047)
  const y =
    ((linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722) / 1.0)
  const z =
    ((linear[0] * 0.0193 + linear[1] * 0.1192 + linear[2] * 0.9505) / 1.08883)

  const [fx, fy, fz] = [x, y, z].map((value) =>
    value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116
  ) as [number, number, number]

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

function clampInt(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)))
}

function clampChannel(value: number) {
  return Math.min(255, Math.max(0, Math.round(value)))
}

function stripExtension(sourceName: string) {
  return sourceName.replace(/\.[^.]+$/, '')
}

function createPatternId(sourceName?: string) {
  const base = sourceName ? stripExtension(sourceName) : 'pattern'
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return `${slug}-${Date.now()}`
}
