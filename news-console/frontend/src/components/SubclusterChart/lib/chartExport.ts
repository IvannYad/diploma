declare global {
  interface Window {
    __lastChartExport?: { format: 'png' | 'pdf'; filename: string };
  }
}

function getChartSvg(root: HTMLElement): SVGSVGElement | null {
  return root.querySelector('.recharts-surface') as SVGSVGElement | null;
}

function svgToCanvas(svg: SVGSVGElement): Promise<HTMLCanvasElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const bbox = svg.getBoundingClientRect();
  const width = Math.max(Math.round(bbox.width), 640);
  const height = Math.max(Math.round(bbox.height), 320);

  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));

  const xml = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas is not available.'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to render chart SVG.'));
    };
    img.src = url;
  });
}

function triggerDownload(href: string, filename: string) {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function exportChartFromPlotArea(plotArea: HTMLElement, format: 'png' | 'pdf') {
  const svg = getChartSvg(plotArea);
  if (!svg) {
    throw new Error('Chart SVG is not available for export.');
  }

  const canvas = await svgToCanvas(svg);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const baseName = `news-console-chart-${stamp}`;

  if (format === 'png') {
    const filename = `${baseName}.png`;
    triggerDownload(canvas.toDataURL('image/png'), filename);
    window.__lastChartExport = { format: 'png', filename };
    return;
  }

  const { jsPDF } = await import('jspdf');
  const filename = `${baseName}.pdf`;
  const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';
  const pdf = new jsPDF({
    orientation,
    unit: 'px',
    format: [canvas.width, canvas.height],
  });
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
  pdf.save(filename);
  window.__lastChartExport = { format: 'pdf', filename };
}
