import Hls from 'hls.js';
import { useEffect, useRef } from 'react';

const HLS_SRC = 'https://stream.mux.com/8wrHPCX2dC3msyYU9ObwqNdm00u3ViXvOSHUMRYSEe5Q.m3u8';

/**
 * Fixed, full-bleed ambient video behind the whole app, streamed from Mux (HLS).
 * Safari plays HLS natively; other browsers use hls.js. A light scrim keeps the
 * header/footer edges readable while the video shows through the middle.
 * Frosted panels (bg-black/40 + backdrop-blur) provide local contrast for content.
 */
export function VideoBackground() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    // Safari / iOS can play HLS directly.
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = HLS_SRC;
      void video.play().catch(() => undefined);
      return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      hls.loadSource(HLS_SRC);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => void video.play().catch(() => undefined));
      return () => hls.destroy();
    }
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-black">
      <video
        ref={ref}
        className="h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/25 to-black/75" />
    </div>
  );
}
