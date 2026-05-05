// Re-exports d3-array primitives so chart code can import from a single
// barrel instead of pulling d3-array directly. Currently only the chart
// callers below use these; expand the surface area as more migrate.

export { extent, bisector, bin } from "d3-array";
