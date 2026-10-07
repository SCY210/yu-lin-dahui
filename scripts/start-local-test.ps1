param([switch]$NoBrowser, [switch]$SmokeTest)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$runtimeFolder = Join-Path $repoRoot '.sites-runtime\local-test\node'

function Find-Npm($nodePath) {
    $nodeFolder = Split-Path -Parent $nodePath
    $candidates = @(
        (Join-Path $nodeFolder 'node_modules\npm\bin\npm-cli.js'),
        (Join-Path (Split-Path -Parent $nodeFolder) 'node_modules\npm\bin\npm-cli.js')
    )
    foreach ($command in @(Get-Command npm.cmd,npm.ps1 -ErrorAction SilentlyContinue)) {
        $candidates += Join-Path (Split-Path -Parent $command.Source) 'node_modules\npm\bin\npm-cli.js'
    }
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
    }
    return $null
}

function Find-Runtime {
    $candidates = @()
    foreach ($command in @(Get-Command node.exe -All -ErrorAction SilentlyContinue)) { $candidates += $command.Source }
    $candidates += Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
    if (Test-Path -LiteralPath $runtimeFolder) {
        foreach ($folder in @(Get-ChildItem -LiteralPath $runtimeFolder -Directory)) {
            $candidates += Join-Path $folder.FullName 'node.exe'
        }
    }
    foreach ($candidate in ($candidates | Select-Object -Unique)) {
        if (!(Test-Path -LiteralPath $candidate -PathType Leaf)) { continue }
        try {
            $output = & $candidate --version 2>$null
            if ($LASTEXITCODE -ne 0 -or $output -notmatch '^v(\d+)\.(\d+)\.(\d+)$') { continue }
            $major = [int]$Matches[1]; $minor = [int]$Matches[2]
            if ($major -lt 22 -or ($major -eq 22 -and $minor -lt 13)) { continue }
            $npmPath = Find-Npm $candidate
            if ($npmPath) { return @{ Node = $candidate; Npm = $npmPath } }
        } catch { continue }
    }
    return $null
}

try {
    Set-Location -LiteralPath $repoRoot
    Write-Host 'Preparing the local test environment...' -ForegroundColor Cyan
    $runtime = Find-Runtime
    if (!$runtime) {
        Write-Host 'Downloading portable Node 24 from nodejs.org for this checkout...'
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $architecture = 'x64'
        if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { $architecture = 'arm64' }
        $baseUrl = 'https://nodejs.org/dist/latest-v24.x/'
        $checksums = (Invoke-WebRequest -UseBasicParsing -Uri ($baseUrl + 'SHASUMS256.txt')).Content
        $pattern = '(?m)^(?<hash>[a-f0-9]{64})\s+(?<file>node-v24\.\d+\.\d+-win-' + $architecture + '\.zip)\s*$'
        $match = [regex]::Match($checksums, $pattern)
        if (!$match.Success) { throw 'The official Node 24 archive for this computer was not found.' }
        New-Item -ItemType Directory -Path $runtimeFolder -Force | Out-Null
        $archive = Join-Path $runtimeFolder $match.Groups['file'].Value
        Invoke-WebRequest -UseBasicParsing -Uri ($baseUrl + $match.Groups['file'].Value) -OutFile $archive
        if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $match.Groups['hash'].Value) {
            throw 'The Node download failed SHA-256 verification and will not be executed.'
        }
        Expand-Archive -LiteralPath $archive -DestinationPath $runtimeFolder -Force
        $nodePath = Join-Path (Join-Path $runtimeFolder ($match.Groups['file'].Value -replace '\.zip$', '')) 'node.exe'
        $runtime = @{ Node = $nodePath; Npm = (Find-Npm $nodePath) }
    }
    $env:Path = (Split-Path -Parent $runtime.Node) + ';' + $env:Path
    $env:YULIN_LOCAL_NPM = $runtime.Npm
    $launcherArgs = @((Join-Path $PSScriptRoot 'local-test.mjs'))
    if ($NoBrowser) { $launcherArgs += '--no-browser' }
    if ($SmokeTest) { $launcherArgs += '--smoke-test' }
    & $runtime.Node @launcherArgs
    exit $LASTEXITCODE
} catch {
    Write-Host ('Error: ' + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
