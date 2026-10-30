import { CREATOR_URL, openCreatorLink } from '../../lib/creatorLink'

export const LoadingScreen = () => (
  <main aria-label="Loading Contri" aria-live="polite" className="contri-splash">
    <div aria-hidden="true" className="contri-splash__glow contri-splash__glow--one" />
    <div aria-hidden="true" className="contri-splash__glow contri-splash__glow--two" />

    <section className="contri-splash__content">
      <div aria-hidden="true" className="contri-splash__mark-wrap">
        <div className="contri-splash__mark">
          <img alt="" className="contri-splash__logo" height="1024" src="/contri-symbol.png" width="1024" />
        </div>
        <span className="contri-splash__orbit contri-splash__orbit--one" />
        <span className="contri-splash__orbit contri-splash__orbit--two" />
      </div>

      <div className="contri-splash__wordmark">
        <h1>contri</h1>
        <p>Travel together. Split together.</p>
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

    <a
      className="contri-splash__credit"
      href={CREATOR_URL}
      onClick={openCreatorLink}
      rel="noopener noreferrer"
      target="_blank"
    >
      Built by <span>Tejas Mane</span>
    </a>
  </main>
)
