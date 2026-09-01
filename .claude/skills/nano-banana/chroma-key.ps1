<#
.SYNOPSIS
  Converts a magenta-background image (as generated when a transparent
  background was requested but the model drew a real magenta fill instead)
  into a tightly-cropped, truly transparent PNG.

.DESCRIPTION
  Image models are unreliable at producing real alpha transparency — asking
  for "transparent background" directly often yields a literal checkerboard
  PATTERN drawn as opaque pixels (not real alpha), which is a nightmare to
  chroma-key back out because its grays collide with black outlines/shadows
  in the artwork. Asking for a solid magenta (RGB 255,0,255) background
  instead is far more reliable to key out cleanly, since magenta rarely
  appears in real artwork.

  This script:
    1. Removes magenta background pixels via a relative-color-distance test
       (robust to JPEG compression drift, unlike an exact-color match).
    2. Erodes the alpha mask by 1px to eat any thin magenta-tinted fringe
       left at anti-aliased edges.
    3. Crops tightly to the remaining opaque content on all four sides.
    4. Optionally downscales to a target size (nearest-neighbor by default,
       matching pixel-art conventions — use -Smooth for non-pixel-art
       assets) and re-crops in case downscaling reintroduces edge bleed.

.PARAMETER InputPath
  Path to the source image (PNG or JPG — the provider often returns JPG
  even when a .png filename was requested; this script reads either).

.PARAMETER OutputPath
  Path to write the final transparent PNG to.

.PARAMETER TargetWidth
  Optional. If set (with -TargetHeight omitted), the image is downscaled to
  this width, preserving aspect ratio.

.PARAMETER TargetHeight
  Optional. If set (with -TargetWidth omitted), the image is downscaled to
  this height, preserving aspect ratio. If BOTH -TargetWidth and
  -TargetHeight are given, the image is resized to exactly that box
  (aspect ratio not preserved) — omit one of them for the common case.

.PARAMETER Smooth
  Use high-quality (bicubic) interpolation instead of nearest-neighbor.
  Omit this for pixel-art assets, where nearest-neighbor keeps hard edges
  crisp instead of introducing blur/anti-aliasing.

.PARAMETER MagentaScoreThreshold
  Advanced. Lower = stricter magenta match (may leave fringe), higher =
  more aggressive removal (may eat real artwork that leans magenta/pink).
  Default 60 works well for a pure RGB(255,0,255) background prompt.

.EXAMPLE
  ./chroma-key.ps1 -InputPath ./raw_magenta.jpg -OutputPath ../../public/sprites/icon.png -TargetWidth 24

.EXAMPLE
  ./chroma-key.ps1 -InputPath ./raw_magenta.jpg -OutputPath ./icon.png -TargetWidth 128 -Smooth
#>
param(
  [Parameter(Mandatory = $true)][string]$InputPath,
  [Parameter(Mandatory = $true)][string]$OutputPath,
  [int]$TargetWidth,
  [int]$TargetHeight,
  [switch]$Smooth,
  [int]$MagentaScoreThreshold = 60
)

Add-Type -AssemblyName System.Drawing

function Get-TightCropBounds([System.Drawing.Bitmap]$bmp) {
  $w = $bmp.Width; $h = $bmp.Height
  $minX = $w; $maxX = -1; $minY = $h; $maxY = -1
  for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
      if ($bmp.GetPixel($x, $y).A -gt 20) {
        if ($x -lt $minX) { $minX = $x }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }
  if ($maxX -lt 0) {
    throw "No opaque pixels found — chroma-key removed everything. Check MagentaScoreThreshold or the source image."
  }
  return @{ MinX = $minX; MinY = $minY; Width = ($maxX - $minX + 1); Height = ($maxY - $minY + 1) }
}

function Copy-Cropped([System.Drawing.Bitmap]$src, [hashtable]$bounds) {
  $cropped = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($cropped)
  $g.DrawImage(
    $src,
    (New-Object System.Drawing.Rectangle 0, 0, $bounds.Width, $bounds.Height),
    (New-Object System.Drawing.Rectangle $bounds.MinX, $bounds.MinY, $bounds.Width, $bounds.Height),
    [System.Drawing.GraphicsUnit]::Pixel
  )
  $g.Dispose()
  return $cropped
}

# --- Step 1+2: chroma-key + 1px fringe erosion ---
$srcImg = [System.Drawing.Image]::FromFile((Resolve-Path $InputPath))
$bmp = New-Object System.Drawing.Bitmap $srcImg, $srcImg.Width, $srcImg.Height
$srcImg.Dispose()
$w = $bmp.Width; $h = $bmp.Height

$keep = New-Object 'bool[,]' $w, $h
for ($y = 0; $y -lt $h; $y++) {
  for ($x = 0; $x -lt $w; $x++) {
    $p = $bmp.GetPixel($x, $y)
    # Relative-color-distance test (not an exact-color match): robust to
    # JPEG compression drift and to blended edge pixels between magenta and
    # the artwork's own colors. Uses the MIN of the two channel deltas, not
    # their sum — magenta needs BOTH red and blue elevated relative to
    # green; a sum alone would also flag pure red (high R, but B-G is ~0)
    # as magenta and incorrectly erase it.
    $score = [Math]::Min([int]$p.R - [int]$p.G, [int]$p.B - [int]$p.G)
    $keep[$x, $y] = ($score -le $MagentaScoreThreshold)
  }
}

$keepEroded = New-Object 'bool[,]' $w, $h
for ($y = 0; $y -lt $h; $y++) {
  for ($x = 0; $x -lt $w; $x++) {
    if (-not $keep[$x, $y]) { $keepEroded[$x, $y] = $false; continue }
    $ok = $true
    for ($dy = -1; $dy -le 1; $dy++) {
      for ($dx = -1; $dx -le 1; $dx++) {
        $nx = $x + $dx; $ny = $y + $dy
        if ($nx -ge 0 -and $nx -lt $w -and $ny -ge 0 -and $ny -lt $h) {
          if (-not $keep[$nx, $ny]) { $ok = $false }
        }
      }
    }
    $keepEroded[$x, $y] = $ok
  }
}

$keyed = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
for ($y = 0; $y -lt $h; $y++) {
  for ($x = 0; $x -lt $w; $x++) {
    if ($keepEroded[$x, $y]) {
      $keyed.SetPixel($x, $y, $bmp.GetPixel($x, $y))
    } else {
      $keyed.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
    }
  }
}

# --- Step 3: tight crop ---
$bounds = Get-TightCropBounds $keyed
$result = Copy-Cropped $keyed $bounds
Write-Host "Chroma-keyed and cropped: $($result.Width)x$($result.Height)"

# --- Step 4: optional downscale, then re-crop (downscaling can reintroduce
# a faint edge-alpha halo, so tighten once more against the final pixels) ---
if ($TargetWidth -or $TargetHeight) {
  if ($TargetWidth -and -not $TargetHeight) {
    $TargetHeight = [Math]::Round($result.Height * $TargetWidth / $result.Width)
  } elseif ($TargetHeight -and -not $TargetWidth) {
    $TargetWidth = [Math]::Round($result.Width * $TargetHeight / $result.Height)
  }
  $resized = New-Object System.Drawing.Bitmap $TargetWidth, $TargetHeight, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($resized)
  $g.InterpolationMode = if ($Smooth) { [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic } else { [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor }
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $g.DrawImage($result, (New-Object System.Drawing.Rectangle 0, 0, $TargetWidth, $TargetHeight))
  $g.Dispose()

  $resizedBounds = Get-TightCropBounds $resized
  $result = Copy-Cropped $resized $resizedBounds
  Write-Host "Downscaled and re-cropped: $($result.Width)x$($result.Height)"
}

$outDir = Split-Path -Parent $OutputPath
if ($outDir -and -not (Test-Path $outDir)) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }

$result.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Saved: $OutputPath"
