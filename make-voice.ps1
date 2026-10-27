# Makes the narration clips with ElevenLabs and rebuilds index.html.
# The key is typed here, masked (so it never reaches the shell's history file), kept only in this window's memory
# while voice.mjs runs, and cleared before the rebuild, which does not need it.
Set-Location -LiteralPath $PSScriptRoot
$secure = Read-Host "Paste your ElevenLabs API key (starts with sk_), then press Enter" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$made = 1
try {
  $env:ELEVEN_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  node --dns-result-order=ipv4first voice.mjs en
  $made = $LASTEXITCODE
}
finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  Remove-Item Env:ELEVEN_API_KEY -ErrorAction SilentlyContinue
}
if ($made -eq 0) { node build.mjs; Write-Host "Done. Tell Claude the voice is ready." -ForegroundColor Green }
else { Write-Host "Voice generation did not finish; see the lines above." -ForegroundColor Yellow }
