// src/pages/AdsBoostingPage.jsx
// "Ads Boosting" tab: the Meta ads dashboard (same UI as the Claude artifact),
// rendered in a same-origin iframe. Its data comes from GET /api/v1/ads-boosting,
// which the backend refreshes from the Meta Marketing API every hour.
import { useEffect, useMemo, useRef, useState } from "react"
import dashboardHtml from "../assets/ads-boosting.html?raw"
import { API_BASE_URL } from "../api/client"

export default function AdsBoostingPage() {
  const frameRef = useRef(null)
  const [height, setHeight] = useState(0)

  const srcDoc = useMemo(() => dashboardHtml.replace("__API_BASE__", API_BASE_URL), [])

  // Grow the iframe to its content so the page scrolls as one (no inner scrollbar).
  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    let observer
    const onLoad = () => {
      const doc = frame.contentDocument
      if (!doc) return
      const measure = () => setHeight(doc.documentElement.scrollHeight)
      measure()
      observer?.disconnect()
      observer = new ResizeObserver(measure)
      observer.observe(doc.body)
    }
    frame.addEventListener("load", onLoad)
    return () => {
      frame.removeEventListener("load", onLoad)
      observer?.disconnect()
    }
  }, [])

  return (
    <div className="mt-16 min-h-[calc(100vh-4rem)] bg-white">
      <iframe
        ref={frameRef}
        title="Ads Boosting"
        srcDoc={srcDoc}
        className="block w-full border-0"
        style={{ height: height || "calc(100vh - 4rem)" }}
      />
    </div>
  )
}
