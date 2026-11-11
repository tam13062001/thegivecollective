// src/pages/DonorInsightsPage.jsx
// "Donor Insights" tab: Donor RFM Studio rendered in a same-origin iframe.
// DEMO ONLY: there is no backend/DB for donors yet. The user uploads a CSV, it is
// analysed in the browser, and the last analysed file is kept in this browser's
// IndexedDB ("tgc-donor-insights") so it survives a reload. Nothing is sent to a server.
// When the BE is ready, replace saveTemp/restoreTemp/clearTemp in donor-insights.html
// with API calls.
import { useEffect, useRef, useState } from "react"
import dashboardHtml from "../assets/donor-insights.html?raw"

export default function DonorInsightsPage() {
  const frameRef = useRef(null)
  const [height, setHeight] = useState(0)

  // Grow the iframe to its content (and shrink it again when panels close),
  // so the page scrolls as one with no inner scrollbar.
  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    let observer
    const onLoad = () => {
      const doc = frame.contentDocument
      if (!doc?.body) return
      const measure = () => setHeight(Math.ceil(doc.body.getBoundingClientRect().height) + 2)
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
    <div className="mt-16 min-h-[calc(100vh-4rem)] bg-[#eef8f7]">
      <iframe
        ref={frameRef}
        title="Donor Insights"
        srcDoc={dashboardHtml}
        className="block w-full border-0"
        style={{ height: height || "calc(100vh - 4rem)" }}
      />
    </div>
  )
}
