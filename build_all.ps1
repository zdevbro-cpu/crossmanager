$ErrorActionPreference = "Stop"

# 1. Prepare dist_all directory
Write-Host "Cleaning dist_all..."
if (Test-Path "dist_all") { Remove-Item "dist_all" -Recurse -Force }
New-Item -ItemType Directory -Path "dist_all"

# 2. Build Modules and Copy
$modules = @(
    @{ Name="Portal"; Target="" },
    @{ Name="PMS"; Target="pms" },
    @{ Name="EMS"; Target="ems" },
    @{ Name="SWMS"; Target="swms" },
    @{ Name="SMS"; Target="sms" }
)

foreach ($mod in $modules) {
    Write-Host "Building $($mod.Name)..."
    Push-Location $($mod.Name)
    
    try {
        # Check if node_modules exists, install if not (optional, assuming installed)
        if (-not (Test-Path "node_modules")) { npm install }
        
        npm run build
        
        if ($LASTEXITCODE -ne 0) { throw "Build failed for $($mod.Name)" }
        
        # Determine source dist
        $src = "dist"
        if (-not (Test-Path $src)) { throw "Dist folder not found for $($mod.Name)" }
        
        # Determine destination
        $dest = "..\dist_all"
        if ($mod.Target -ne "") {
            $dest = Join-Path "..\dist_all" $mod.Target
            New-Item -ItemType Directory -Path $dest -Force | Out-Null
        }
        
        # Copy contents
        Copy-Item -Path "$src\*" -Destination $dest -Recurse -Force
        Write-Host "Copied $($mod.Name) to $dest"
        
    } catch {
        Write-Error "Failed to build/copy $($mod.Name): $_"
        Pop-Location
        exit 1
    }
    
    Pop-Location
}

Write-Host "All modules built and copied to dist_all."
