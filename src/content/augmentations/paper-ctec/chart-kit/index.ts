// Barrel re-exports for the paper-ctec chart kit. Charts pull primitives
// from "./chart-kit" instead of d3-* directly so we can reshape the
// chart-kit surface area without touching every chart file.

export { scaleLinear, niceStep, PERCENT_AXIS_STEPS } from "./scale";
export {
  buildLinePath,
  type Point,
  type BuildLinePathOptions,
  type BuildLinePathResult
} from "./path";
export {
  appendYAxis,
  appendXAxis,
  type YAxisOptions,
  type XAxisOptions
} from "./axis";
export {
  appendStackedAvgPills,
  type AvgIndicator,
  type AvgPillsLayout
} from "./pills";
export {
  appendVerticalGradient,
  type VerticalGradientOptions
} from "./gradient";
export {
  renderSparkline,
  type SparklinePoint,
  type RenderSparklineOptions
} from "./sparkline";
