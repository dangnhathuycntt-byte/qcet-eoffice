"use client";

import * as React from "react";
import { Pause, Play } from "lucide-react";
import { formatClock } from "@qcet/shared/domain/meetings/recording-transcript";
import { Button } from "@/components/ui/button";
import { RecordingWaveform, type RecordingWaveformProps } from "@/components/meetings/recording-waveform";

/** Bước tua bằng phím mũi tên. */
const KEY_STEP_SEC = 5;
/** Mỗi lúc chỉ một bản ghi phát: bấm phát bản khác thì bản đang phát dừng. */
let activeAudio: HTMLAudioElement | null = null;

export interface RecordingPlayerProps extends Pick<RecordingWaveformProps, "peaks" | "tone" | "scanning"> {
  /** Đường nghe lại (`/api/meetings/{id}/recordings/{recordingId}/audio`, cùng tên miền nên kèm phiên đăng nhập). */
  src: string;
  /** Thời lượng máy chủ biết, dùng khi tệp không báo thời lượng (webm ghi trực tiếp). */
  durationSec: number | null;
  label: string;
}

/**
 * Nghe lại bản ghi trên sóng âm: nút phát/tạm dừng, phần đã nghe đậm kèm vạch đỏ (như Ghi âm của iOS), bấm/kéo trên sóng hay
 * dùng phím mũi tên để tua. Chỉ tải âm thanh khi bấm phát (`preload="none"`), tua dùng yêu cầu `Range` nên không tải cả tệp.
 */
export function RecordingPlayer({ src, durationSec, peaks, tone, scanning, label }: RecordingPlayerProps) {
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const pendingSeekRef = React.useRef<number | null>(null);
  const [playing, setPlaying] = React.useState(false);
  const [time, setTime] = React.useState(0);
  const [started, setStarted] = React.useState(false);
  const [mediaDuration, setMediaDuration] = React.useState<number | null>(null);
  const [failed, setFailed] = React.useState(false);
  const duration = mediaDuration ?? durationSec ?? 0;

  // Vạch đỏ chạy mượt theo khung hình khi đang phát (timeupdate chỉ báo khoảng 4 lần mỗi giây)
  React.useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      const audio = audioRef.current;
      if (audio) setTime(audio.currentTime);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  React.useEffect(
    () => () => {
      if (activeAudio === audioRef.current) activeAudio = null;
    },
    []
  );

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    if (activeAudio && activeAudio !== audio) activeAudio.pause();
    activeAudio = audio;
    setFailed(false);
    setStarted(true);
    void audio.play().catch((error: unknown) => {
      // Bị ngắt bởi lần tạm dừng/tua ngay sau đó thì không phải lỗi
      if ((error as { name?: string })?.name !== "AbortError") setFailed(true);
    });
  };

  const seek = (fraction: number) => {
    const audio = audioRef.current;
    if (!audio || duration <= 0) return;
    const target = fraction * duration;
    setStarted(true);
    setTime(target);
    if (audio.readyState >= 1) audio.currentTime = target;
    else {
      // Chưa tải gì (preload="none"): tải phần đầu để biết cấu trúc tệp rồi mới tua
      pendingSeekRef.current = target;
      audio.load();
    }
  };

  const progress = started && duration > 0 ? time / duration : null;

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon-sm"
        className="shrink-0 rounded-full"
        aria-label={playing ? "Tạm dừng" : "Nghe bản ghi"}
        title={failed ? "Không phát được âm thanh. Bấm để thử lại." : playing ? "Tạm dừng" : "Nghe bản ghi"}
        onClick={toggle}
      >
        {playing ? <Pause className="fill-current" /> : <Play className="fill-current" />}
      </Button>
      <RecordingWaveform
        peaks={peaks}
        tone={tone}
        scanning={scanning}
        progress={progress}
        onSeek={seek}
        step={duration > 0 ? KEY_STEP_SEC / duration : 0.02}
        label={label}
        valueText={`${formatClock(time)} trên ${formatClock(duration)}`}
        className="min-w-0 flex-1"
      />
      <span className={failed ? "w-14 shrink-0 text-right text-xs text-destructive" : "w-14 shrink-0 text-right text-xs text-muted-foreground tabular-nums"}>
        {failed ? "Lỗi phát" : formatClock(started ? time : duration)}
      </span>
      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setTime(duration);
        }}
        onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => {
          const audio = event.currentTarget;
          if (Number.isFinite(audio.duration) && audio.duration > 0) setMediaDuration(audio.duration);
          if (pendingSeekRef.current !== null) {
            audio.currentTime = pendingSeekRef.current;
            pendingSeekRef.current = null;
          }
        }}
        onError={() => {
          setPlaying(false);
          setFailed(true);
        }}
      />
    </div>
  );
}
