import { useEffect, useRef, useState } from "react";

// Đổi link episode ở đây nếu cần
const EPISODE_URL = "https://open.spotify.com/episode/6cGEFVCF28UdBCpqXLXUXA";
const SPOTIFY_URI = "spotify:episode:6cGEFVCF28UdBCpqXLXUXA";

export default function SpotifyFloatingPlayer() {
  const containerRef = useRef(null);
  const controllerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [coverUrl, setCoverUrl] = useState(null);

  // Lấy ảnh cover của episode qua oEmbed API công khai của Spotify (không cần API key)
  useEffect(() => {
    fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(EPISODE_URL)}`)
      .then((res) => res.json())
      .then((data) => setCoverUrl(data.thumbnail_url))
      .catch(() => {
        // Nếu lỗi thì cứ để nền màu xanh Spotify mặc định, không chặn phần phát nhạc
      });
  }, []);

  // Nạp Spotify iFrame API và tạo controller ẩn để phát audio
  useEffect(() => {
    const setupController = (IFrameAPI) => {
      const element = containerRef.current;
      if (!element) return;

      IFrameAPI.createController(
        element,
        { uri: SPOTIFY_URI, width: "1", height: "1" },
        (controller) => {
          controllerRef.current = controller;

          controller.addListener("playback_update", (e) => {
            setIsPlaying(!e.data.isPaused);
          });

          // Cố gắng tự phát - có thể bị trình duyệt chặn nếu chưa có tương tác nào
          controller.play();
        }
      );
    };

    if (window.Spotify?.Iframe) {
      setupController(window.Spotify.Iframe);
      return;
    }

    window.onSpotifyIframeApiReady = setupController;

    // Tránh nạp script trùng nếu component re-mount
    if (!document.getElementById("spotify-iframe-api-script")) {
      const script = document.createElement("script");
      script.id = "spotify-iframe-api-script";
      script.src = "https://open.spotify.com/embed/iframe-api/v1";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // Fallback: nếu autoplay bị trình duyệt chặn, lần click đầu tiên bất kỳ đâu trên trang sẽ kích hoạt phát
  useEffect(() => {
    const tryPlayOnFirstInteraction = () => {
      if (controllerRef.current && !isPlaying) {
        controllerRef.current.play();
      }
      window.removeEventListener("click", tryPlayOnFirstInteraction);
    };
    window.addEventListener("click", tryPlayOnFirstInteraction);
    return () => window.removeEventListener("click", tryPlayOnFirstInteraction);
  }, [isPlaying]);

  const togglePlay = (e) => {
    e.stopPropagation();
    controllerRef.current?.togglePlay();
  };

  return (
    <>
      {/* Iframe Spotify ẩn hoàn toàn - chỉ dùng để phát audio, không hiện UI mặc định */}
      <div
        ref={containerRef}
        style={{
          position: "fixed",
          width: 1,
          height: 1,
          overflow: "hidden",
          opacity: 0,
          pointerEvents: "none",
        }}
      />

      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? "Tạm dừng podcast" : "Phát podcast"}
        title={isPlaying ? "Tạm dừng" : "Phát podcast"}
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 1000,
          width: 64,
          height: 64,
          borderRadius: "50%",
          border: "none",
          padding: 0,
          cursor: "pointer",
          background: "#000",
          boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
        }}
      >
        {/* Đĩa nhạc - xoay khi đang phát */}
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            backgroundImage: coverUrl ? `url(${coverUrl})` : undefined,
            backgroundColor: coverUrl ? "transparent" : "#1DB954",
            backgroundSize: "cover",
            backgroundPosition: "center",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: isPlaying ? "spotify-disc-spin 4s linear infinite" : "none",
          }}
        >
          {/* Lỗ đĩa than ở giữa cho giống vinyl thật */}
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "#111",
              border: "2px solid rgba(255,255,255,0.6)",
            }}
          />
        </div>

        {/* Badge logo Spotify ở góc dưới phải của nút */}
        <div
          style={{
            position: "absolute",
            bottom: -4,
            right: -4,
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "#1DB954",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
          }}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="#000">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34a.749.749 0 01-1.031.24c-2.822-1.723-6.377-2.113-10.564-1.155a.75.75 0 01-.334-1.462c4.593-1.05 8.51-.6 11.686 1.346.353.216.464.677.243 1.031zm1.472-3.276a.938.938 0 01-1.29.301c-3.234-1.988-8.166-2.564-11.994-1.402a.94.94 0 01-.545-1.797c4.365-1.325 9.802-.683 13.523 1.607.435.267.573.837.306 1.291zm.127-3.412c-3.878-2.303-10.28-2.514-13.984-1.39a1.125 1.125 0 01-.653-2.153c4.247-1.29 11.31-1.04 15.766 1.607a1.125 1.125 0 01-1.129 1.936z" />
          </svg>
        </div>
      </button>

      <style>{`
        @keyframes spotify-disc-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}