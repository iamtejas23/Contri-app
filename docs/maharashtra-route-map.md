# Maharashtra route map data

The route canvas outline is a simplified static vector derived from the geoBoundaries `IND-ADM1` open boundary dataset. geoBoundaries identifies DataMeet India / Election Commission of India as the source and lists the boundary year represented as 2011. The map is bundled with the application; there is no runtime map API or external provider request.

- Dataset: [geoBoundaries India ADM1](https://www.geoboundaries.org/api/current/gbOpen/IND/ADM1/)
- License: [Creative Commons Attribution 2.5 India (CC BY 2.5 IN)](https://creativecommons.org/licenses/by/2.5/in/)
- State feature: Maharashtra (`IN-MH`)
- Derived geometry: `src/data/maharashtraBoundary.js`

Route marker `canvasPosition` values are normalized percentages against the state outline's SVG viewBox. They are visual editor coordinates, not latitude/longitude or a claim that a named place has been geocoded. Legacy route points are placed inside the boundary for display without a bulk migration; their stored coordinates are only updated when an authorized admin moves a marker.
