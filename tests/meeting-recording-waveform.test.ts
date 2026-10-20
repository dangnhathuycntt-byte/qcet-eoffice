import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  RECORDING_WAVEFORM_BARS,
  buildWaveform,
  resampleWaveform,
  waveformBlockSamples,
} from "@qcet/shared/domain/meetings/recording-waveform";

describe("Ghi âm cuộc họp: sóng âm", () => {
  it("gộp khối đo thành tối đa 240 cột 0–100, chuẩn hóa theo mức gần lớn nhất chứ không theo một tiếng động", () => {
    const levels = [...Array.from({ length: 480 }, () => 0.2), ...Array.from({ length: 480 }, () => 0)];
    levels[10] = 1; // một tiếng động lớn
    const bars = buildWaveform(levels);
    assert.equal(bars.length, RECORDING_WAVEFORM_BARS);
    assert.ok(bars.every((value) => Number.isInteger(value) && value >= 0 && value <= 100));
    assert.ok(bars.slice(5, 115).every((value) => value === 100), "lời nói đều lên mức cao, không bị tiếng động kéo thấp");
    assert.ok(bars.slice(125).every((value) => value === 0), "im lặng bằng 0");
  });

  it("giãn tương phản: bản họp dài có mức nói khá đều vẫn ra sóng cao thấp rõ, mức đều tuyệt đối thì cột cao nhất", () => {
    const speech = Array.from({ length: 960 }, (_, i) => 0.5 + 0.5 * Math.abs(Math.sin(i / 20)));
    const bars = buildWaveform(speech);
    assert.ok(Math.min(...bars) < 40 && Math.max(...bars) === 100, `từ ${Math.min(...bars)} tới ${Math.max(...bars)}`);
    assert.ok(buildWaveform(Array.from({ length: 50 }, () => 0.3)).every((value) => value === 100));
  });

  it("ít khối hơn số cột thì mỗi khối một cột; rỗng hoặc toàn im lặng không chia cho 0", () => {
    assert.equal(buildWaveform([0.1, 0.3, 0.2]).length, 3);
    assert.deepEqual(buildWaveform([]), []);
    assert.deepEqual(buildWaveform([0, 0, 0]), [0, 0, 0]);
  });

  it("gộp về số cột vừa bề rộng lấy giá trị lớn nhất mỗi nhóm; ít cột hơn thì giữ nguyên", () => {
    assert.deepEqual(resampleWaveform([1, 9, 2, 3, 8, 4], 3), [9, 3, 8]);
    assert.deepEqual(resampleWaveform([1, 2], 5), [1, 2]);
    assert.deepEqual(resampleWaveform([1, 2], 0), []);
  });

  it("khối đo theo thời lượng: bản ngắn và bản dài đều ra khoảng 960 khối, không nhỏ hơn 40 mẫu", () => {
    assert.equal(Math.round((2 * 3600 * 4000) / waveformBlockSamples(2 * 3600)), 960);
    assert.equal(Math.round((30 * 4000) / waveformBlockSamples(30)), 960);
    assert.equal(waveformBlockSamples(1), 40);
    assert.equal(waveformBlockSamples(null), waveformBlockSamples(60));
  });
});
