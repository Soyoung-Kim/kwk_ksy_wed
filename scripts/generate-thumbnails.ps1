param(
  [int]$MaxEdge = 640,
  [int]$Quality = 82,
  [string]$OutputFolder = 'thumbs'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$sourceDirectory = Join-Path $projectRoot 'assets/photos'
$outputDirectory = Join-Path $sourceDirectory $OutputFolder
$names = @('28', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '22', '23', '24', '25', '26')

New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }

function Set-ImageOrientation {
  param([System.Drawing.Image]$Image)

  if ($Image.PropertyIdList -notcontains 0x0112) { return }

  $orientation = $Image.GetPropertyItem(0x0112).Value[0]
  $rotateFlip = switch ($orientation) {
    2 { [System.Drawing.RotateFlipType]::RotateNoneFlipX }
    3 { [System.Drawing.RotateFlipType]::Rotate180FlipNone }
    4 { [System.Drawing.RotateFlipType]::Rotate180FlipX }
    5 { [System.Drawing.RotateFlipType]::Rotate90FlipX }
    6 { [System.Drawing.RotateFlipType]::Rotate90FlipNone }
    7 { [System.Drawing.RotateFlipType]::Rotate270FlipX }
    8 { [System.Drawing.RotateFlipType]::Rotate270FlipNone }
    default { $null }
  }

  if ($null -ne $rotateFlip) { $Image.RotateFlip($rotateFlip) }
}

foreach ($name in $names) {
  $sourcePath = Join-Path $sourceDirectory "$name.jpg"
  $outputPath = Join-Path $outputDirectory "$name.jpg"
  if (-not (Test-Path -LiteralPath $sourcePath)) {
    Write-Warning "Missing source image: $sourcePath"
    continue
  }

  $source = [System.Drawing.Image]::FromFile($sourcePath)
  try {
    Set-ImageOrientation -Image $source
    $scale = [Math]::Min(1.0, [double]$MaxEdge / [double][Math]::Max($source.Width, $source.Height))
    $width = [Math]::Max(1, [int][Math]::Round($source.Width * $scale))
    $height = [Math]::Max(1, [int][Math]::Round($source.Height * $scale))
    $thumbnail = [System.Drawing.Bitmap]::new($width, $height)
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($thumbnail)
      try {
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.DrawImage($source, 0, 0, $width, $height)

        $encoderParameters = [System.Drawing.Imaging.EncoderParameters]::new(1)
        $encoderParameters.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new([System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)
        $thumbnail.Save($outputPath, $jpegCodec, $encoderParameters)
      }
      finally {
        $graphics.Dispose()
      }
    }
    finally {
      $thumbnail.Dispose()
    }
  }
  finally {
    $source.Dispose()
  }

  Write-Output "Created $OutputFolder/$name.jpg ($width x $height)"
}
