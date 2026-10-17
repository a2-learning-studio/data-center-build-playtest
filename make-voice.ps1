# Makes the narration clips with ElevenLabs and rebuilds index.html.
# The key is typed here, masked, kept only in this window's memory, and cleared at the end.
Set-Location -LiteralPath $PSScriptRoot
$secure = Read-Host "Paste your ElevenLabs API key (starts with sk_), then press Enter" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $env:ELEVEN_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  node --dns-result-order=ipv4first voice.mjs en
  if ($LASTEXITCODE -eq 0) { node build.mjs; Write-Host "Done. Tell Claude the voice is ready." -ForegroundColor Green }
  else { Write-Host "Voice generation did not finish; see the lines above." -ForegroundColor Yellow }
}
finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  Remove-Item Env:ELEVEN_API_KEY -ErrorAction SilentlyContinue
}
