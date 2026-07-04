# Download and configure an embeddable Windows Python under .ci/python (no admin required).
# Reused across jobs via GitLab cache. Override sources with CI/CD variables if needed:
#   PYTHON_VERSION, PYTHON_EMBED_URL, GET_PIP_URL

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/ci-python-common.ps1"

function Get-CiBootstrappedPythonExe {
    if ($env:CI_PROJECT_DIR) {
        return Join-Path $env:CI_PROJECT_DIR '.ci\python\python.exe'
    }
    $Root = Split-Path -Parent $PSScriptRoot
    return Join-Path $Root '.ci\python\python.exe'
}

function Enable-CiEmbeddablePythonSite {
    param([string]$PythonDir)

    $pthFile = Get-ChildItem -LiteralPath $PythonDir -Filter 'python*._pth' -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if (-not $pthFile) {
        throw "Embeddable Python ._pth file not found under $PythonDir"
    }

    $lines = Get-Content -LiteralPath $pthFile.FullName
    $updated = @()
    $hasSitePackages = $false
    foreach ($line in $lines) {
        if ($line -match '^\s*#\s*import site\s*$') {
            $updated += 'import site'
            continue
        }
        if ($line -eq 'import site') {
            $updated += $line
            continue
        }
        if ($line -match '(?i)^Lib\\site-packages\s*$') {
            $hasSitePackages = $true
        }
        $updated += $line
    }
    if (-not ($updated -contains 'import site')) {
        $updated += 'import site'
    }
    if (-not $hasSitePackages) {
        $updated += 'Lib\site-packages'
    }
    Set-Content -LiteralPath $pthFile.FullName -Value $updated -Encoding ASCII
}

function Install-CiEmbeddablePython {
    $pythonExe = Get-CiBootstrappedPythonExe
    if (Test-Path -LiteralPath $pythonExe) {
        Write-Host "Bootstrapped Python already present: $pythonExe"
        Write-CiPythonVersion -PythonPath $pythonExe
        return $pythonExe
    }

    $version = if ($env:PYTHON_VERSION) { $env:PYTHON_VERSION } else { '3.12.6' }
    $pythonDir = Split-Path -Parent $pythonExe
    New-Item -ItemType Directory -Force -Path $pythonDir | Out-Null

    $embedUrl = $env:PYTHON_EMBED_URL
    if (-not $embedUrl) {
        $embedUrl = "https://www.python.org/ftp/python/$version/python-$version-embed-amd64.zip"
    }

    $getPipUrl = $env:GET_PIP_URL
    if (-not $getPipUrl) {
        $getPipUrl = 'https://bootstrap.pypa.io/get-pip.py'
    }

    $tempRoot = Join-Path $env:TEMP ("minos-python-$version-" + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $zipPath = Join-Path $tempRoot 'python-embed.zip'
        $getPipPath = Join-Path $tempRoot 'get-pip.py'

        Write-Host "Downloading embeddable Python $version..."
        Write-Host "URL: $embedUrl"
        Invoke-WebRequest -Uri $embedUrl -OutFile $zipPath -UseBasicParsing

        Write-Host "Extracting to $pythonDir"
        Expand-Archive -LiteralPath $zipPath -DestinationPath $pythonDir -Force
        Enable-CiEmbeddablePythonSite -PythonDir $pythonDir

        Write-Host "Bootstrapping pip..."
        Write-Host "URL: $getPipUrl"
        Invoke-WebRequest -Uri $getPipUrl -OutFile $getPipPath -UseBasicParsing
        & $pythonExe $getPipPath --no-warn-script-location
        if ($LASTEXITCODE -ne 0) {
            throw "get-pip.py failed with exit code $LASTEXITCODE"
        }

        Write-Host "Bootstrapped Python ready: $pythonExe"
        Write-CiPythonVersion -PythonPath $pythonExe
        & $pythonExe -m pip --version
        if ($LASTEXITCODE -ne 0) {
            throw 'pip is not available after bootstrap'
        }

        return $pythonExe
    }
    finally {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

$pythonExe = Install-CiEmbeddablePython
$pathFile = if ($env:CI_PROJECT_DIR) {
    Join-Path $env:CI_PROJECT_DIR '.ci-python-path'
} else {
    Join-Path (Split-Path -Parent $PSScriptRoot) '.ci-python-path'
}
Set-Content -LiteralPath $pathFile -Value $pythonExe -NoNewline -Encoding ASCII
