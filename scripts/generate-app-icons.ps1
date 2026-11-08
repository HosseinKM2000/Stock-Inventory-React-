param(
  [Parameter(Mandatory = $true)]
  [string]$SourceDirectory
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$publicRoot = Join-Path $projectRoot "public"
$androidRoot = Join-Path $publicRoot "icons/android/adaptive"
$iosRoot = Join-Path $publicRoot "icons/ios"

$backgroundPath = Join-Path $SourceDirectory "ic_launcher_background.png"
$foregroundPath = Join-Path $SourceDirectory "ic_launcher_foreground.png"
$iosPath = Join-Path $SourceDirectory "IOS.png"

foreach ($path in @($backgroundPath, $foregroundPath, $iosPath)) {
  if (-not (Test-Path -LiteralPath $path)) {
    throw "Missing icon source: $path"
  }
}

New-Item -ItemType Directory -Force -Path $androidRoot, $iosRoot | Out-Null

function New-Canvas([int]$width, [int]$height) {
  return [System.Drawing.Bitmap]::new(
    $width,
    $height,
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
  )
}

function New-HighQualityGraphics([System.Drawing.Image]$image) {
  $graphics = [System.Drawing.Graphics]::FromImage($image)
  $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  return $graphics
}

function Save-ResizedPng(
  [System.Drawing.Image]$source,
  [int]$size,
  [string]$destination
) {
  $canvas = New-Canvas $size $size
  try {
    $graphics = New-HighQualityGraphics $canvas
    try {
      $graphics.DrawImage($source, 0, 0, $size, $size)
    } finally {
      $graphics.Dispose()
    }
    $canvas.Save($destination, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $canvas.Dispose()
  }
}

function Get-AlphaBounds([System.Drawing.Bitmap]$bitmap) {
  $minX = $bitmap.Width
  $minY = $bitmap.Height
  $maxX = -1
  $maxY = -1

  for ($y = 0; $y -lt $bitmap.Height; $y++) {
    for ($x = 0; $x -lt $bitmap.Width; $x++) {
      if ($bitmap.GetPixel($x, $y).A -gt 0) {
        if ($x -lt $minX) { $minX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }

  if ($maxX -lt 0) { throw "Android foreground has no visible pixels" }
  return [System.Drawing.Rectangle]::new($minX, $minY, $maxX - $minX + 1, $maxY - $minY + 1)
}

function Save-MaskablePng(
  [System.Drawing.Image]$background,
  [System.Drawing.Image]$foreground,
  [int]$size,
  [string]$destination
) {
  # Keep the complete logo inside Android's 66/108 dp guaranteed safe zone.
  $safeLayerRatio = 0.61
  $sourceBounds = Get-AlphaBounds ([System.Drawing.Bitmap]$foreground)
  $layerSize = [int][Math]::Round($size * $safeLayerRatio)
  $layerOffset = [int][Math]::Round(($size - $layerSize) / 2)
  $destinationBounds = [System.Drawing.Rectangle]::new($layerOffset, $layerOffset, $layerSize, $layerSize)
  $canvas = New-Canvas $size $size
  try {
    $graphics = New-HighQualityGraphics $canvas
    try {
      $graphics.DrawImage($background, 0, 0, $size, $size)
      $graphics.DrawImage($foreground, $destinationBounds, $sourceBounds, [System.Drawing.GraphicsUnit]::Pixel)
    } finally {
      $graphics.Dispose()
    }
    $canvas.Save($destination, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $canvas.Dispose()
  }
}

function Save-SafeForegroundPng(
  [System.Drawing.Image]$foreground,
  [int]$size,
  [string]$destination
) {
  $safeLayerRatio = 0.61
  $sourceBounds = Get-AlphaBounds ([System.Drawing.Bitmap]$foreground)
  $layerSize = [int][Math]::Round($size * $safeLayerRatio)
  $layerOffset = [int][Math]::Round(($size - $layerSize) / 2)
  $destinationBounds = [System.Drawing.Rectangle]::new($layerOffset, $layerOffset, $layerSize, $layerSize)
  $canvas = New-Canvas $size $size
  try {
    $graphics = New-HighQualityGraphics $canvas
    try {
      $graphics.Clear([System.Drawing.Color]::Transparent)
      $graphics.DrawImage($foreground, $destinationBounds, $sourceBounds, [System.Drawing.GraphicsUnit]::Pixel)
    } finally {
      $graphics.Dispose()
    }
    $canvas.Save($destination, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $canvas.Dispose()
  }
}

$background = [System.Drawing.Image]::FromFile($backgroundPath)
$foreground = [System.Drawing.Image]::FromFile($foregroundPath)
$iosMaster = [System.Drawing.Image]::FromFile($iosPath)

try {
  Copy-Item -LiteralPath $backgroundPath -Destination (Join-Path $androidRoot "ic_launcher_background.png") -Force
  Copy-Item -LiteralPath $foregroundPath -Destination (Join-Path $androidRoot "ic_launcher_foreground-original.png") -Force
  Copy-Item -LiteralPath $iosPath -Destination (Join-Path $iosRoot "app-icon-1024.png") -Force

  Save-SafeForegroundPng $foreground 432 (Join-Path $androidRoot "ic_launcher_foreground.png")

  foreach ($size in @(96, 128, 144, 192, 256, 384, 512)) {
    Save-ResizedPng $iosMaster $size (Join-Path $publicRoot "pwa-icon-$size.png")
    Save-MaskablePng $background $foreground $size (Join-Path $publicRoot "pwa-icon-maskable-$size.png")
  }

  foreach ($size in @(120, 152, 167, 180)) {
    Save-ResizedPng $iosMaster $size (Join-Path $publicRoot "apple-touch-icon-$size.png")
  }
  Save-ResizedPng $iosMaster 180 (Join-Path $publicRoot "apple-touch-icon.png")

  foreach ($size in @(16, 32, 48)) {
    Save-ResizedPng $iosMaster $size (Join-Path $publicRoot "favicon-$size.png")
  }
} finally {
  $background.Dispose()
  $foreground.Dispose()
  $iosMaster.Dispose()
}

Write-Output "Generated Tanzim app icons from $SourceDirectory"
