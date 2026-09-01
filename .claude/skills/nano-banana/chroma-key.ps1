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

# .NET's relative-path resolution uses [Environment]::CurrentDirectory, which
# can silently diverge from PowerShell's own $PWD (e.g. after `cd` via a
# provider) — without this, a relative -OutputPath can fail to save ("The
# directory ... does not exist") even though the same path looks valid from
# the shell. Resolve both paths to absolute up front so the rest of the
# script never has to think about it.
[Environment]::CurrentDirectory = (Get-Location).Path
$InputPath = [System.IO.Path]::GetFullPath($InputPath)
$OutputPath = [System.IO.Path]::GetFullPath($OutputPath)

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

# --- Step 0: trim any accidental solid-color margin OUTSIDE the magenta
# canvas itself. Despite the prompt asking for magenta edge-to-edge, models
# sometimes still frame it with a few dozen px of white (or some other flat
# color) padding — that border isn't magenta, so the chroma-key pass below
# would leave it as an opaque frame around the final asset. Scan inward from
# each side while the pixel matches the top-left corner's color (a real
# magenta canvas won't match an off-magenta corner) and isn't magenta-ish
# itself; stop at the first pixel that's either magenta or genuinely
# different from the corner color. A no-op when the canvas is already pure
# magenta edge-to-edge (the common case) — the loops simply won't advance.
function Test-Magentaish([System.Drawing.Color]$p, [int]$threshold) {
  $score = [Math]::Min([int]$p.R - [int]$p.G, [int]$p.B - [int]$p.G)
  return $score -gt $threshold
}
function Test-CloseColor([System.Drawing.Color]$a, [System.Drawing.Color]$b, [int]$tolerance = 24) {
  return ([Math]::Abs([int]$a.R - [int]$b.R) -le $tolerance) -and
         ([Math]::Abs([int]$a.G - [int]$b.G) -le $tolerance) -and
         ([Math]::Abs([int]$a.B - [int]$b.B) -le $tolerance)
}

$rawImg = [System.Drawing.Image]::FromFile((Resolve-Path $InputPath))
$raw = New-Object System.Drawing.Bitmap $rawImg, $rawImg.Width, $rawImg.Height
$rawImg.Dispose()
$rw = $raw.Width; $rh = $raw.Height
$cornerColor = $raw.GetPixel(0, 0)

if (-not (Test-Magentaish $cornerColor $MagentaScoreThreshold)) {
  $midY = [int]($rh / 2); $midX = [int]($rw / 2)
  $marginLeft = 0
  while ($marginLeft -lt $rw -and (Test-CloseColor $raw.GetPixel($marginLeft, $midY) $cornerColor) -and -not (Test-Magentaish $raw.GetPixel($marginLeft, $midY) $MagentaScoreThreshold)) { $marginLeft++ }
  $marginRight = $rw - 1
  while ($marginRight -ge 0 -and (Test-CloseColor $raw.GetPixel($marginRight, $midY) $cornerColor) -and -not (Test-Magentaish $raw.GetPixel($marginRight, $midY) $MagentaScoreThreshold)) { $marginRight-- }
  $marginTop = 0
  while ($marginTop -lt $rh -and (Test-CloseColor $raw.GetPixel($midX, $marginTop) $cornerColor) -and -not (Test-Magentaish $raw.GetPixel($midX, $marginTop) $MagentaScoreThreshold)) { $marginTop++ }
  $marginBottom = $rh - 1
  while ($marginBottom -ge 0 -and (Test-CloseColor $raw.GetPixel($midX, $marginBottom) $cornerColor) -and -not (Test-Magentaish $raw.GetPixel($midX, $marginBottom) $MagentaScoreThreshold)) { $marginBottom-- }

  if ($marginLeft -gt 0 -or $marginTop -gt 0 -or $marginRight -lt ($rw - 1) -or $marginBottom -lt ($rh - 1)) {
    Write-Host "Trimmed a non-magenta outer margin: left=$marginLeft top=$marginTop right=$($rw-1-$marginRight) bottom=$($rh-1-$marginBottom)"
    $bmp = Copy-Cropped $raw @{ MinX = $marginLeft; MinY = $marginTop; Width = ($marginRight - $marginLeft + 1); Height = ($marginBottom - $marginTop + 1) }
  } else {
    $bmp = $raw
  }
} else {
  $bmp = $raw
}

# --- Step 1+2: chroma-key + 1px fringe erosion ---
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

# --- Step 4: optional downscale to an EXACT target size. The result keeps
# TargetWidth x TargetHeight exactly (any leftover transparent margin is
# harmless — every other sprite in a typical pixel-art project already has
# some transparent padding around its silhouette, e.g. this repo's own
# Player.ts PLAYER_SIDE_PADDING/PLAYER_HEAD_PADDING/PLAYER_FOOT_PADDING).
# This matters for pixel-art: a caller usually wants a specific, predictable
# native size (so it scales by a clean INTEGER factor into the game's render
# size — a non-integer scale, e.g. 32px target / 23px asset ≈ 1.39x, causes
# visibly uneven/"distorted" nearest-neighbor upscaling). Silently shrinking
# below the requested size (re-cropping tighter after resize) would defeat
# that. Re-cropping is only warranted with -Smooth (bicubic can introduce a
# faint edge-alpha halo nearest-neighbor of a binary-alpha source cannot).
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

  if ($Smooth) {
    $resizedBounds = Get-TightCropBounds $resized
    $result = Copy-Cropped $resized $resizedBounds
    Write-Host "Downscaled and re-cropped (smooth mode): $($result.Width)x$($result.Height)"
  } else {
    $result = $resized
    Write-Host "Downscaled to exact target: $($result.Width)x$($result.Height)"
  }
}

$outDir = Split-Path -Parent $OutputPath
if ($outDir -and -not (Test-Path $outDir)) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }

$result.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Saved: $OutputPath"
