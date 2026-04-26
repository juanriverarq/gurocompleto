/**
 * Cubic connector adapted from @clientIO/joint-demos marketing-automation.
 * Converts all link path segments to cubic Béziers so CSS transitions can
 * interpolate between them smoothly (needed for the animated flow runs the
 * demo showcases, and also gives the signature curvy look).
 */
import { g, connectors } from '@joint/core';
import type { dia } from '@joint/core';

const LINK_CURVES_COUNT = 9;

export default function cubicConnector(
  sourcePoint: g.Point,
  targetPoint: g.Point,
  routePoints: g.Point[],
  _args: any,
  linkView: dia.LinkView,
): g.Path {
  const opt = {
    cornerType: 'cubic' as const,
    cornerRadius: 12,
    raw: true,
  };

  const path = (connectors as any).straight(sourcePoint, targetPoint, routePoints, opt, linkView) as g.Path;

  const segmentsCount = path.segments.length;
  for (let i = 0; i < segmentsCount; i++) {
    const segment: any = path.segments[i];
    if (segment.type === 'M' || segment.type === 'C') continue;
    if (!segment.start || !segment.end) continue;
    path.replaceSegment(i, lineToCubic(segment.start, segment.end));
  }

  return ensureCubicCount(path, LINK_CURVES_COUNT);
}

function lineToCubic(from: g.Point, to: g.Point): g.Segment {
  const cp1 = new g.Point(from.x + (to.x - from.x) / 3, from.y + (to.y - from.y) / 3);
  const cp2 = new g.Point(from.x + ((to.x - from.x) * 2) / 3, from.y + ((to.y - from.y) * 2) / 3);
  return g.Path.createSegment('C', cp1, cp2, to.clone()) as g.Segment;
}

function ensureCubicCount(path: g.Path, targetCurves: number): g.Path {
  const result = path.clone();
  const segments: any[] = result.segments as any;
  if (!segments.length || segments[0].type !== 'M') return result;

  const cubicIndices: number[] = [];
  for (let i = 1; i < segments.length; i++) if (segments[i].type === 'C') cubicIndices.push(i);

  if (cubicIndices.length >= targetCurves) return result;

  const curvesToAdd = targetCurves - cubicIndices.length;
  for (let i = 0; i < curvesToAdd; i++) {
    const listIndex = i % cubicIndices.length;
    const segmentIndex = cubicIndices[listIndex];
    const segment: any = (result as any).getSegment(segmentIndex);
    if (!segment) continue;
    const [first, second] = segment.divideAt(0.5);
    result.replaceSegment(segmentIndex, first);
    (result as any).insertSegment(segmentIndex + 1, second);
    for (let j = listIndex + 1; j < cubicIndices.length; j++) cubicIndices[j]++;
    cubicIndices.splice(listIndex + 1, 0, segmentIndex + 1);
  }

  return result;
}
