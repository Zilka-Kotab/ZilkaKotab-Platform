import type { jsPDF } from 'jspdf';

const HEADER_HEIGHT = 80;
const GOLD: [number, number, number] = [231, 183, 48];

/** Vector artwork keeps the reference's globe treatment sharp at print size. */
function drawGlobe(pdf: jsPDF) {
  const cx = 350;
  const cy = 80;
  const radius = 78;
  const tilt = -0.38;
  const visible = (x: number, y: number) => x > 255 && x < 435 && y > 2 && y < HEADER_HEIGHT;
  for (let latitude = -75; latitude <= 75; latitude += 10) {
    for (let longitude = -85; longitude <= 85; longitude += 10) {
      const lat = latitude * Math.PI / 180;
      const lon = longitude * Math.PI / 180;
      const x = radius * Math.cos(lat) * Math.sin(lon);
      const y = radius * Math.sin(lat);
      const depth = Math.cos(lat) * Math.cos(lon);
      const px = cx + x * Math.cos(tilt) - y * Math.sin(tilt);
      const py = cy + x * Math.sin(tilt) + y * Math.cos(tilt);
      if (!visible(px, py)) continue;
      pdf.setFillColor(12 + depth * 11, 47 + depth * 26, 64 + depth * 30);
      pdf.circle(px, py, 0.55 + depth * 1.15, 'F');
    }
  }
  const arc = (rx: number, ry: number, rotation: number, color: [number, number, number]) => {
    pdf.setDrawColor(...color);
    pdf.setLineWidth(0.35);
    let previous: [number, number] | undefined;
    for (let step = 0; step <= 120; step++) {
      const angle = step * Math.PI * 2 / 120;
      const x = rx * Math.cos(angle);
      const y = ry * Math.sin(angle);
      const point: [number, number] = [
        cx + x * Math.cos(rotation) - y * Math.sin(rotation),
        cy + x * Math.sin(rotation) + y * Math.cos(rotation),
      ];
      if (previous && visible(...previous) && visible(...point)) {
        pdf.line(...previous, ...point);
      }
      previous = point;
    }
  };
  arc(79, 32, -0.58, [27, 68, 83]);
  arc(32, 81, 0.55, [29, 70, 82]);
  arc(78, 66, -0.35, [112, 98, 44]);
  arc(18, 88, 0.65, [110, 99, 47]);
  for (const [x, y, r] of [[352, 17, 1.8], [386, 34, 2], [405, 61, 1.5], [326, 46, 1.5], [320, 73, 1.7], [421, 74, 1.3]]) {
    pdf.setFillColor(...GOLD);
    pdf.circle(x, y, r, 'F');
  }
}

export function drawPortfolioPdfHeader(pdf: jsPDF, companyName: string, retrievedAt: string) {
  // Subtle teal glow behind the globe; darker ends preserve text contrast.
  pdf.setFillColor(1, 24, 37);
  pdf.rect(0, 0, 612, HEADER_HEIGHT, 'F');
  for (let x = 0; x < 612; x++) {
    const glow = Math.exp(-Math.pow((x - 330) / 155, 2));
    pdf.setFillColor(1, 24 + 15 * glow, 37 + 18 * glow);
    pdf.rect(x, 0, 1.1, HEADER_HEIGHT, 'F');
  }
  drawGlobe(pdf);
  pdf.setFillColor(...GOLD);
  pdf.rect(0, HEADER_HEIGHT, 612, 2, 'F');
  pdf.rect(24, 16, 3.5, 48, 'F');

  const fitText = (text: string, width: number) => {
    let result = text;
    if (pdf.getTextWidth(result) <= width) return result;
    while (result && pdf.getTextWidth(`${result}...`) > width) result = result.slice(0, -1);
    return `${result}...`;
  };
  pdf.setFont('times', 'bold');
  let companySize = 36;
  pdf.setFontSize(companySize);
  while (pdf.getTextWidth(companyName) > 378 && companySize > 18) {
    companySize -= 0.5;
    pdf.setFontSize(companySize);
  }
  pdf.setTextColor(255, 255, 255);
  pdf.text(fitText(companyName, 378), 42, 41);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(14.5); pdf.setCharSpace(0.75);
  pdf.setTextColor(224, 229, 234);
  pdf.text('PATENT PORTFOLIO SNAPSHOT', 42, 59);
  pdf.setCharSpace(0);
  pdf.setFontSize(6.8); pdf.setTextColor(186, 201, 210);
  const date = new Date(retrievedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  pdf.text(`SOURCE: USPTO Open Data Portal  |  RETRIEVED: ${date}`, 42, 73);

  pdf.setDrawColor(125, 145, 156); pdf.setLineWidth(0.7);
  pdf.line(439, 12, 439, 74);
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10.2); pdf.setCharSpace(0.5);
  pdf.setTextColor(...GOLD);
  pdf.text(['COMPLIMENTARY', 'PATENT INTELLIGENCE'], 457, 21, { lineHeightFactor: 1.15 });
  pdf.setCharSpace(0);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(211, 221, 227);
  pdf.text('Provided by', 457, 48);
  pdf.setFont('times', 'normal'); pdf.setFontSize(16);
  pdf.setTextColor(255, 255, 255);
  pdf.text('ZILKA-KOTAB, PC', 457, 65);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6); pdf.setCharSpace(0.2);
  pdf.setTextColor(211, 221, 227);
  pdf.text('AI-ENABLED PATENT INTELLIGENCE', 457, 75);
  pdf.setCharSpace(0);
}
