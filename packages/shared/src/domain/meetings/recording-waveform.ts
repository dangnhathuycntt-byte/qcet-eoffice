/**
 * Sóng âm của bản ghi cuộc họp: máy chủ đo độ lớn (RMS) từng khối âm thanh bằng ffmpeg rồi gộp thành RECORDING_WAVEFORM_BARS
 * cột 0–100 để lưu; giao diện gộp tiếp về số cột vừa bề rộng. Chỉ là hình để nhận ra bản ghi và đoạn có tiếng nói, không chứa
 * nội dung nghe được.
 */

/** Số cột máy chủ lưu cho mỗi bản ghi (đủ cho khung rộng 1200px ở bước 5px). */
export const RECORDING_WAVEFORM_BARS = 240;
/** Tần số lấy mẫu khi đo: 4 kHz giữ được năng lượng lời nói, đọc 2 giờ chỉ khoảng 29 triệu mẫu. */
export const RECORDING_WAVEFORM_SAMPLE_RATE = 4_000;
/** Mỗi cột gộp từ ngần này khối đo để cột không phụ thuộc một khoảnh khắc. */
const BLOCKS_PER_BAR = 4;

/** Số mẫu mỗi khối đo theo thời lượng báo trước, để bản ngắn hay dài đều ra khoảng BARS × BLOCKS_PER_BAR khối. */
export function waveformBlockSamples(durationSec: number | null): number {
  const seconds = durationSec && durationSec > 0 ? durationSec : 60;
  return Math.max(40, Math.floor((seconds * RECORDING_WAVEFORM_SAMPLE_RATE) / (RECORDING_WAVEFORM_BARS * BLOCKS_PER_BAR)));
}

function bucketBounds(index: number, count: number, length: number): [number, number] {
  const from = Math.floor((index * length) / count);
  return [from, Math.max(from + 1, Math.floor(((index + 1) * length) / count))];
}

/**
 * Độ lớn từng khối → tối đa `bars` cột 0–100: gộp khối theo khoảng đều nhau (căn trung bình bình phương), rồi giãn tương phản
 * giữa mức thấp (70% bách phân vị 5) và mức cao (bách phân vị 98). Bản họp dài gộp nửa phút vào một cột nên mức nói khá đều;
 * không giãn thì sóng gần như một khối phẳng. Một tiếng động lớn không kéo các cột khác xuống, im lặng thật vẫn bằng 0.
 */
export function buildWaveform(levels: readonly number[], bars = RECORDING_WAVEFORM_BARS): number[] {
  if (levels.length === 0) return [];
  const count = Math.min(bars, levels.length);
  const buckets = Array.from({ length: count }, (_, index) => {
    const [from, to] = bucketBounds(index, count, levels.length);
    let sum = 0;
    for (let i = from; i < to; i += 1) sum += levels[i]! ** 2;
    return Math.sqrt(sum / (to - from));
  });
  const sorted = [...buckets].sort((a, b) => a - b);
  const high = sorted[Math.floor((sorted.length - 1) * 0.98)] ?? 0;
  if (high <= 0) return buckets.map(() => 0);
  const low = Math.min(sorted[Math.floor((sorted.length - 1) * 0.05)] ?? 0, high) * 0.7;
  return buckets.map((value) => Math.round(Math.min(1, Math.max(0, (value - low) / (high - low))) * 100));
}

/** Gộp `peaks` về `count` cột để vừa bề rộng, lấy giá trị lớn nhất mỗi nhóm để không mất đoạn nói to; ít cột hơn thì giữ nguyên. */
export function resampleWaveform(peaks: readonly number[], count: number): number[] {
  if (count <= 0) return [];
  if (peaks.length <= count) return [...peaks];
  return Array.from({ length: count }, (_, index) => {
    const [from, to] = bucketBounds(index, count, peaks.length);
    let max = 0;
    for (let i = from; i < to; i += 1) max = Math.max(max, peaks[i]!);
    return max;
  });
}
