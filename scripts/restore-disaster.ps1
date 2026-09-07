<#
.SYNOPSIS
    Kịch bản phục hồi thảm họa 1-chạm cho hệ thống QCET E-Office.
.DESCRIPTION
    Khôi phục cơ sở dữ liệu PostgreSQL từ tệp dump nhị phân và giải nén phục hồi thư mục uploads.
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$DbDumpPath,

    [string]$UploadsZipPath = "",
    [string]$ContainerName = "qcet-eoffice-db",
    [string]$DbUser = "qcet_admin",
    [string]$DbName = "qcet_eoffice",
    [string]$TargetUploadsDir = "D:\QCET-Eoffice-Data\uploads"
)

$ErrorActionPreference = "Stop"

Write-Host "================ BẮT ĐẦU TIẾN TRÌNH KHÔI PHỤC CSDL ================" -ForegroundColor Cyan

if (-not (Test-Path $DbDumpPath)) {
    Write-Error "Không tìm thấy tệp sao lưu CSDL: $DbDumpPath"
    exit 1
}

try {
    # 1. Chép tệp dump vào trong container để tối ưu tốc độ restore
    Write-Host "1. Sao chép tệp sao lưu vào container..." -ForegroundColor Yellow
    docker cp $DbDumpPath "$($ContainerName):/tmp/restore_target.dump"

    # 2. Thực thi pg_restore với tùy chọn làm sạch và tạo lại bảng
    Write-Host "2. Đang thực thi pg_restore tái thiết lập CSDL..." -ForegroundColor Yellow
    $restoreCmd = "pg_restore -U $DbUser -d $DbName -v --clean --if-exists /tmp/restore_target.dump"
    docker exec $ContainerName sh -c "$restoreCmd"

    # Dọn dẹp tệp tạm trong container
    docker exec $ContainerName rm -f /tmp/restore_target.dump
    Write-Host "Khôi phục CSDL PostgreSQL hoàn tất!" -ForegroundColor Green

    # 3. Giải nén phục hồi tệp đính kèm nếu có cung cấp
    if ($UploadsZipPath -and (Test-Path $UploadsZipPath)) {
        Write-Host "3. Đang giải nén phục hồi thư mục uploads: $UploadsZipPath..." -ForegroundColor Yellow
        if (-not (Test-Path $TargetUploadsDir)) {
            New-Item -ItemType Directory -Path $TargetUploadsDir -Force | Out-Null
        }
        Expand-Archive -Path $UploadsZipPath -DestinationPath $TargetUploadsDir -Force
        Write-Host "Khôi phục tệp đính kèm hoàn tất!" -ForegroundColor Green
    }

    Write-Host "HỆ THỐNG ĐÃ ĐƯỢC KHÔI PHỤC THÀNH CÔNG VỀ TRẠNG THÁI HOẠT ĐỘNG!" -ForegroundColor Green
}
catch {
    Write-Error "[LỖI NGHIÊM TRỌNG] Quá trình khôi phục thất bại: $($_.Exception.Message)"
    # Dọn dẹp tệp tạm trong container nếu còn
    docker exec $ContainerName rm -f /tmp/restore_target.dump 2>$null
    exit 1
}
