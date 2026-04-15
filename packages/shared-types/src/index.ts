export type BeadBrand = 'perler' | 'hama' | 'artkal' | 'mard'

export type RgbColor = [number, number, number]

export type BeadPaletteColor = {
  code: string
  name: string
  brand: BeadBrand
  rgb: RgbColor
}

export type PatternCell = {
  x: number
  y: number
  colorCode: string | null
}

export type PatternColorUsage = {
  colorCode: string
  count: number
}

export type ColorDistanceMode = 'rgb' | 'weighted-rgb' | 'lab'

export type DitherMode = 'none' | 'floyd-steinberg'

export type TransparentHandlingMode = 'empty' | 'white'

export type PatternGenerationOptions = {
  targetWidth: number
  targetHeight: number
  maxColors?: number
  transparencyThreshold?: number
  transparentHandling?: TransparentHandlingMode
  distanceMode?: ColorDistanceMode
  ditherMode?: DitherMode
}

export type BeadPattern = {
  id: string
  title: string
  width: number
  height: number
  sourceName?: string
  cells: PatternCell[]
  paletteUsed: PatternColorUsage[]
  emptyCells: number
  options: Required<PatternGenerationOptions>
}

export type ConvertImageToPatternInput = {
  imageData: ImageData
  palette: BeadPaletteColor[]
  sourceName?: string
} & PatternGenerationOptions
