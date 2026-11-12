# Contri landing page

This is a dependency-free static marketing site deployed from the `docs/` directory. It is intentionally separate from the root Vite/Capacitor application. The invitation preview is a cropped, real Android app screenshot from the local UI test results; the other feature illustrations are category icons, not app UI mockups.

## Local preview

From the repository root, run:

```bash
python3 -m http.server 8000 --directory docs
```

Then open `http://localhost:8000`. The website has no npm build step.

## Android release details

The page reads the latest stable release from the public GitHub Releases API and separately loads recent release history. It selects the APK and SHA-256 sidecar from that release's assets, displays release notes and published size/date, and uses GitHub's APK asset digest when available. No version or APK URL needs a manual website update.

## Enable GitHub Pages

The workflow at `.github/workflows/pages.yml` publishes `docs/` through GitHub Actions on pushes to `main` that change the site/workflow, and supports manual runs.

1. Open the repository on GitHub and go to **Settings → Pages**.
2. Under **Build and deployment**, choose **GitHub Actions** as the source.
3. Ensure Actions are enabled for the repository and the `GITHUB_TOKEN` has the workflow permissions declared in the YAML (`pages: write`, `id-token: write`; `contents: read`).
4. Push a change to `docs/` on `main` or run **Deploy Contri landing page** from the **Actions** tab.
5. After the deployment succeeds, use the Pages URL shown in the workflow deployment environment. For this repository, the expected project site path is `https://iamtejas23.github.io/Contri-app/`.

All site assets use relative paths, so the project subpath is supported. If the repository becomes private or Pages availability changes for its plan, verify GitHub's current Pages eligibility and repository settings.

The existing public project URL responded successfully when checked during this update: `https://iamtejas23.github.io/Contri-app/`. Local changes to `docs/` are not live until the existing GitHub Pages workflow runs after they are pushed to `main` (or manually dispatched). This task does not deploy the site.
