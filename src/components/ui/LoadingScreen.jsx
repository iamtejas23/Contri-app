export const LoadingScreen = () => (
  <main aria-label="Loading Contri" aria-live="polite" className="contri-splash">
    <div aria-hidden="true" className="contri-splash__glow contri-splash__glow--one" />
    <div aria-hidden="true" className="contri-splash__glow contri-splash__glow--two" />

    <section className="contri-splash__content">
      <div aria-hidden="true" className="contri-splash__mark-wrap">
        <div className="contri-splash__mark">
          <svg className="contri-splash__logo" viewBox="0 0 48 48" fill="none">
            <path
              d="M34.2 15.2A15.4 15.4 0 1 0 34.2 32.8"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="5.2"
            />
            <circle cx="34.5" cy="15" r="3.2" fill="currentColor" />
            <circle cx="34.5" cy="33" r="3.2" fill="currentColor" />
          </svg>
        </div>
        <span className="contri-splash__orbit contri-splash__orbit--one" />
        <span className="contri-splash__orbit contri-splash__orbit--two" />
      </div>

      <div className="contri-splash__wordmark">
        <h1>Contri</h1>
        <p>Trip khatam. Hisab bhi khatam.</p>
      </div>

      <div aria-label="Loading" className="contri-splash__loader" role="status">
        <span className="contri-splash__loader-track">
          <span className="contri-splash__loader-fill" />
        </span>
        <span className="contri-splash__loader-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </div>
    </section>

    <span aria-hidden="true" className="contri-splash__caption">MADE FOR SHARED MOMENTS</span>
  </main>
)
