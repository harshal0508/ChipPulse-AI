import { useState, useRef } from 'react';
import { useChipStore } from '../../store/chipStore';
import { useSimulationStore } from '../../store/simulationStore';
import { useGamificationStore } from '../../store/gamificationStore';
import { tempToColor } from '../../utils/tempToColor';

export default function ExportReportButton() {
  const mapRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);
  const { placedComponents } = useChipStore();
  const { hasResult, metrics, violations } = useSimulationStore();
  const { username, unlockAchievement } = useGamificationStore();

  const handleExport = async () => {
    if (!hasResult || !metrics) return;
    setIsExporting(true);

    try {
      // 1. Take snapshot of the main app
      const canvas = await window.html2canvas(document.body, { 
        backgroundColor: '#111827',
        scale: 1, // Keep scale manageable for PDF size
        useCORS: true,
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.8);

      // 2. Initialize PDF (A4 landscape)
      const jsPDFClass = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
      const pdf = new jsPDFClass({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      // 3. Add styling and title
      pdf.setFillColor(17, 24, 39); // Dark background
      pdf.rect(0, 0, 297, 210, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(22);
      pdf.text('ChipPulse AI - Tape-Out Validation Report', 14, 20);

      pdf.setFontSize(12);
      pdf.setTextColor(156, 163, 175);
      pdf.text(`Date: ${new Date().toLocaleDateString()}`, 14, 30);

      // 4. Add Metrics
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(14);
      pdf.text(`Physics Score: ${metrics.physics_score} / 1000`, 14, 45);
      pdf.text(`Max Temp: ${metrics.max_temp_C.toFixed(1)} °C`, 14, 53);
      pdf.text(`Total Power: ${(metrics.total_power_W * 1000).toFixed(0)} mW`, 14, 61);

      // 5. Add Snapshot Image of 3D Canvas
      const imgWidth = 140; // Smaller width to fit next to 2D map
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const finalHeight = Math.min(imgHeight, 210 - 75 - 14); 
      const finalWidth = (canvas.width * finalHeight) / canvas.height;
      pdf.addImage(imgData, 'JPEG', 14, 75, finalWidth, finalHeight);

      // 5b. Add 2D Thermal Map Image
      if (mapRef.current) {
        const mapCanvas = await window.html2canvas(mapRef.current, {
          backgroundColor: '#111827',
          scale: 2,
        });
        const mapImgData = mapCanvas.toDataURL('image/jpeg', 0.9);
        const mapImgWidth = 100;
        const mapImgHeight = (mapCanvas.height * mapImgWidth) / mapCanvas.width;
        pdf.text('2D Thermal Heatmap', 160, 70);
        pdf.addImage(mapImgData, 'JPEG', 160, 75, mapImgWidth, mapImgHeight);
      }

      // 6. Save the PDF
      pdf.save('chippulse_tapeout_report.pdf');
      
      // Award the achievement
      unlockAchievement('tape_out');
    } catch (error) {
      console.error('Failed to export PDF:', error);
      alert('Failed to generate PDF. Check console for details.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
    <button
      onClick={handleExport}
      disabled={isExporting || !hasResult}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 16px', borderRadius: 8,
        background: !hasResult ? 'var(--bg-elevated)' : 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
        color: !hasResult ? 'var(--text-tertiary)' : 'white',
        border: 'none', cursor: !hasResult ? 'not-allowed' : (isExporting ? 'wait' : 'pointer'),
        fontFamily: 'Orbitron, sans-serif', fontSize: 12, fontWeight: 'bold',
        opacity: isExporting ? 0.7 : 1, transition: 'all 0.2s',
        boxShadow: hasResult ? '0 4px 12px rgba(99,102,241,0.3)' : 'none'
      }}
    >
      {isExporting ? (
        <><span className="spinner" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }}></span> EXPORTING...</>
      ) : (
        <>📥 TAPE-OUT REPORT</>
      )}
    </button>
    
    {/* Hidden 2D Thermal Map for PDF Capture */}
    {hasResult && metrics?.thermal_map && (
      <div 
        ref={mapRef} 
        style={{
          position: 'absolute', top: '-9999px', left: '-9999px',
          width: 400, height: 400, display: 'grid', gridTemplateColumns: 'repeat(16, 1fr)',
          gap: 2, background: '#0B0F19', padding: 16, borderRadius: 12
        }}
      >
        {metrics.thermal_map.map((row, ry) =>
          row.map((temp, cx) => {
            const minT = 25;
            const maxT = Math.max(...metrics.thermal_map.flat());
            const t = (temp - minT) / Math.max(1, maxT - minT);
            return (
              <div key={`${ry}-${cx}`}
                style={{
                  backgroundColor: tempToColor(temp, minT, maxT),
                  opacity: 0.3 + t * 0.7,
                  borderRadius: 2
                }}
              />
            );
          })
        )}
      </div>
    )}
    </>
  );
}
