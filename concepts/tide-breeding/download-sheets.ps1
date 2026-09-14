$ErrorActionPreference='Stop'
$conceptRoot=[IO.Path]::GetFullPath($PSScriptRoot)
$sheetRoot=[IO.Path]::GetFullPath((Join-Path $conceptRoot 'sheets'))
$statuses=Get-Content -Raw -LiteralPath (Join-Path $conceptRoot 'jobs/status.json') | ConvertFrom-Json
foreach($job in $statuses){
 if($job.status -ne 'completed' -or -not $job.result_url){continue}
 $uri=[Uri]$job.result_url
 if($uri.Scheme -ne 'https' -or $uri.Host -ne 'd8j0ntlcm91z4.cloudfront.net' -or -not $uri.AbsolutePath.EndsWith('.png')){throw 'Unexpected generated-image URL'}
 $number=[int]$job.index
 if($number -lt 1 -or $number -gt 24){throw 'Unexpected image index'}
 $destination=[IO.Path]::GetFullPath((Join-Path $sheetRoot ('sheet-{0:d2}.png' -f $number)))
 if(-not $destination.StartsWith($sheetRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Image target outside catalogue'}
 if(Test-Path -LiteralPath $destination){continue}
 & curl.exe --fail --location --silent --show-error --retry 2 --output $destination $job.result_url
 if($LASTEXITCODE -ne 0){throw "Image download failed for $number"}
 $hash=(Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash
 Write-Output ("sheet-{0:d2} downloaded SHA256 {1}" -f $number,$hash)
}
