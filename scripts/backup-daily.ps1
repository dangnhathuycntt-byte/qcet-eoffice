<#
.SYNOPSIS
    Kịch bản tự động sao lưu CSDL PostgreSQL và Tệp đính kèm hệ thống QCET E-Office.
.DESCRIPTION
    Được cấu hình chạy định kỳ lúc 01:00 AM mỗi ngày qua Windows Task Scheduler.
#>

param(
    [string]$BaseDir = "D:\QCET-Eoffice-Data",
    [string]$ContainerName = "qcet-eoffice-db",
    [string]$DbUser = "qcet_admin",
    [string]$DbName = "qcet_eoffice",
    [int]$RetentionDays = 30
)

$ErrorActionPreference = "Stop"
$DateStamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$BackupDir = Join-Path $BaseDir "backups"
$UploadsDir = Join-Path $BaseDir "uploads"
$LogFile = Join-Path $BackupDir "backup-history.log"

# Tạo thư mục lưu trữ nếu chưa có
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

function Write-Log($message) {
    $time = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logLine = "[$time] $message"
    Write-Host $logLine
    Add-Content -Path $LogFile -Value $logLine
}

Write-Log "================ BẮT ĐẦU TIẾN TRÌNH SAO LƯU DỰ PHÒNG ================"

try {
    # 1. Sao lưu CSDL PostgreSQL bằng pg_dump (Định dạng nén nhị phân Custom -F c)
    $DbBackupFile = Join-Path $BackupDir "qcet_db_$DateStamp.dump"
    Write-Log "Đang kết xuất CSDL PostgreSQL vào: $DbBackupFile..."

    # Thực thi pg_dump trực tiếp trong container
    $dumpCmd = "docker exec $ContainerName pg_dump -U $DbUser -d $DbName -F c -b -v"
    $process = Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -Command `"$dumpCmd > `"`"$DbBackupFile`"`"`"" -Wait -PassThru -NoNewWindow

    if ($process.ExitCode -ne 0 -or -not (Test-Path $DbBackupFile)) {
        throw "Lỗi khi thực hiện pg_dump xuất CSDL. Mã lỗi: $($process.ExitCode)"
    }
    $dbSizeMB = [math]::Round((Get-Item $DbBackupFile).Length / 1MB, 2)
    Write-Log "Sao lưu CSDL thành công! Dung lượng: $dbSizeMB MB."

    # 2. Sao lưu Thư mục Tệp đính kèm (Uploads Archive)
    if (Test-Path $UploadsDir) {
        $UploadsBackupZip = Join-Path $BackupDir "qcet_uploads_$DateStamp.zip"
        Write-Log "Đang nén thư mục tệp đính kèm vào: $UploadsBackupZip..."
        Compress-Archive -Path "$UploadsDir\*" -DestinationPath $UploadsBackupZip -CompressionLevel Optimal -Force
        $zipSizeMB = [math]::Round((Get-Item $UploadsBackupZip).Length / 1MB, 2)
        Write-Log "Nén tệp đính kèm thành công! Dung lượng: $zipSizeMB MB."
    }

    # 3. Dọn dẹp Bản sao lưu Cũ (Retention Policy 30 ngày)
    Write-Log "Đang kiểm tra và dọn dẹp các bản sao lưu cũ hơn $RetentionDays ngày..."
    $CutoffDate = (Get-Date).AddDays(-$RetentionDays)

    $OldFiles = Get-ChildItem -Path $BackupDir -File | Where-Object {
        ($_.Extension -in @(".dump", ".zip", ".sql")) -and ($_.CreationTime -lt $CutoffDate)
    }

    foreach ($file in $OldFiles) {
        Write-Log "Xóa bản lưu hết hạn: $($file.Name) (Tạo lúc: $($file.CreationTime))"
        Remove-Item -Path $file.FullName -Force
    }

    Write-Log "HOÀN TẤT SAO LƯU DỰ PHÒNG THÀNH CÔNG VÀ AN TOÀN!"
}
catch {
    Write-Log "[LỖI NGHIÊM TRỌNG] Quá trình sao lưu thất bại: $($_.Exception.Message)"
    exit 1
}
