export const DIAGRAM_WIDTH = 380;
export const DIAGRAM_HEIGHT = 300;

export function nodePosition(index: number, total: number): { x: number; y: number } {
  const safeTotal = Math.max(total, 1);
  const angle = ((Math.PI * 2) / safeTotal) * index - Math.PI / 2;
  const radiusX = 120;
  const radiusY = 74;
  return {
    x: DIAGRAM_WIDTH / 2 + Math.cos(angle) * radiusX,
    y: DIAGRAM_HEIGHT / 2 + Math.sin(angle) * radiusY,
  };
}
