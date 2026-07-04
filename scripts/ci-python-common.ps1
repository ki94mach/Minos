# Shared helpers for Windows GitLab CI Python discovery.

function Test-IsSuitableCiPythonPath {
    param([string]$Path)
    if (-not $Path) {
        return $false
    }
    # Bundled runtimes shipped with other apps are not suitable for pip/pytest CI.
    if ($Path -match '(?i)(pgadmin|postgresql|\\arcgis\\|windowsapps|microsoft\\windowsapps|\\embed\\)') {
        return $false
    }
    return $true
}

function Get-CiPythonSearchRoots {
    return @(
        $env:ProgramFiles,
        ${env:ProgramFiles(x86)},
        "$env:LOCALAPPDATA\Programs\Python",
        "$env:ProgramData\chocolatey\lib"
    ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
}

function Get-CiBootstrappedPythonExe {
    if ($env:CI_PROJECT_DIR) {
        return Join-Path $env:CI_PROJECT_DIR '.ci\python\python.exe'
    }
    return $null
}

function Get-CiPythonCandidatePaths {
    $paths = New-Object System.Collections.Generic.List[string]

    if ($env:PYTHON_PATH -and (Test-Path -LiteralPath $env:PYTHON_PATH)) {
        $paths.Add((Resolve-Path -LiteralPath $env:PYTHON_PATH).Path)
    }

    $bootstrapped = Get-CiBootstrappedPythonExe
    if ($bootstrapped -and (Test-Path -LiteralPath $bootstrapped)) {
        $paths.Add((Resolve-Path -LiteralPath $bootstrapped).Path)
    }

    foreach ($name in @('python.exe', 'python3.exe', 'python', 'python3')) {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if ($cmd) {
            $paths.Add($cmd.Source)
        }
    }

    $py = Get-Command py.exe -ErrorAction SilentlyContinue
    if ($py) {
        $exe = & $py.Source -3 -c "import sys; print(sys.executable)" 2>$null
        if ($LASTEXITCODE -eq 0 -and $exe) {
            $paths.Add($exe.Trim())
        }
    }

    $known = @(
        "$env:ProgramFiles\Python312\python.exe",
        "$env:ProgramFiles\Python311\python.exe",
        "$env:ProgramFiles\Python310\python.exe",
        "${env:ProgramFiles(x86)}\Python312\python.exe",
        "${env:ProgramFiles(x86)}\Python311\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe",
        "$env:ProgramData\chocolatey\lib\python312\tools\python.exe",
        "$env:ProgramData\chocolatey\lib\python311\tools\python.exe",
        'C:\Python312\python.exe',
        'C:\Python311\python.exe'
    )
    foreach ($path in $known) {
        if ($path -and (Test-Path -LiteralPath $path)) {
            $paths.Add((Resolve-Path -LiteralPath $path).Path)
        }
    }

    foreach ($root in (Get-CiPythonSearchRoots)) {
        $found = Get-ChildItem -LiteralPath $root -Filter python.exe -Recurse -Depth 5 -ErrorAction SilentlyContinue
        foreach ($item in $found) {
            $paths.Add($item.FullName)
        }
    }

    return $paths | Select-Object -Unique
}

function Resolve-CiPythonPath {
    foreach ($path in (Get-CiPythonCandidatePaths)) {
        if (-not (Test-Path -LiteralPath $path)) {
            continue
        }
        # Explicit PYTHON_PATH or PATH-resolved commands are always trusted.
        $trusted = $false
        if ($env:PYTHON_PATH -and $path -eq (Resolve-Path -LiteralPath $env:PYTHON_PATH).Path) {
            $trusted = $true
        }
        if ($path -match '(?i)\\python312\\|\\python311\\|\\python310\\|chocolatey\\lib\\python|\\.ci\\python\\') {
            $trusted = $true
        }
        foreach ($name in @('python.exe', 'python3.exe')) {
            $cmd = Get-Command $name -ErrorAction SilentlyContinue
            if ($cmd -and $cmd.Source -eq $path) {
                $trusted = $true
            }
        }

        if ($trusted -or (Test-IsSuitableCiPythonPath $path)) {
            return $path
        }
    }

    return $null
}

function Write-CiPythonVersion {
    param([string]$PythonPath)
    $version = & $PythonPath --version 2>&1
    Write-Host (($version | Out-String).Trim())
}

function Write-CiPythonMissingError {
    $candidates = Get-CiPythonCandidatePaths | Where-Object { Test-Path -LiteralPath $_ }
    $unsuitable = $candidates | Where-Object { -not (Test-IsSuitableCiPythonPath $_) }

    $message = @"
No suitable Python 3 is available for CI on gitlab-runner-windows.

Project-local bootstrap also failed. Check network access to PYTHON_EMBED_URL / GET_PIP_URL
or set GitLab CI/CD variables to internal mirrors you can read (no Nexus admin required):

  PYTHON_EMBED_URL  -> embeddable python zip
  GET_PIP_URL       -> get-pip.py
  PYTHON_VERSION    -> e.g. 3.12.6

If downloads are blocked, ask an admin to install Python on the runner or set PYTHON_PATH.
"@

    if ($unsuitable.Count -gt 0) {
        $listed = ($unsuitable | Select-Object -First 5) -join [Environment]::NewLine
        $message += @"

Bundled Python installs were found but are not used for CI:
$listed
"@
    }

    Write-Error $message
}
