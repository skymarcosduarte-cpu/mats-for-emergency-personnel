// Export Utilities for COMUNIDAD EX SOS
// Export trip data as CSV or PDF

import type { TransitTrip } from '@/types';

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Export trips as CSV
 */
export function exportTripsAsCSV(trips: TransitTrip[]): void {
  if (trips.length === 0) {
    alert('No hay viajes para exportar');
    return;
  }

  const headers = [
    'Fecha',
    'Tipo',
    'Origen',
    'Destino',
    'Estado',
    'Placas/Vuelo',
    'Acompañantes',
    'ETA',
    'Llegada',
  ];

  const rows = trips.map(trip => [
    formatDate(trip.created_at),
    trip.transit_type === 'ROAD' ? 'Carretera' : 'Vuelo',
    trip.origin,
    trip.destination,
    trip.status,
    trip.transit_type === 'ROAD' ? (trip.plates || '-') : (trip.flight_number || '-'),
    trip.companions || '-',
    formatDate(trip.eta),
    trip.arrived_at ? formatDate(trip.arrived_at) : '-',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `viajes_exsos_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export trips as PDF (using browser print)
 */
export function exportTripsAsPDF(trips: TransitTrip[]): void {
  if (trips.length === 0) {
    alert('No hay viajes para exportar');
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Historial de Viajes - COMUNIDAD EX SOS</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 20px;
          color: #333;
        }
        h1 {
          color: #16a34a;
          margin-bottom: 10px;
        }
        .subtitle {
          color: #666;
          margin-bottom: 30px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 10px;
          text-align: left;
        }
        th {
          background-color: #f5f5f5;
          font-weight: 600;
        }
        tr:nth-child(even) {
          background-color: #fafafa;
        }
        .status-active { color: #16a34a; }
        .status-arrived { color: #2563eb; }
        .status-cancelled { color: #dc2626; }
        .status-overdue { color: #f97316; }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          font-size: 12px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <h1>🚗 Historial de Viajes</h1>
      <p class="subtitle">COMUNIDAD EX SOS - Generado el ${formatDate(new Date().toISOString())}</p>
      
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Tipo</th>
            <th>Origen</th>
            <th>Destino</th>
            <th>Estado</th>
            <th>Detalles</th>
          </tr>
        </thead>
        <tbody>
          ${trips.map(trip => `
            <tr>
              <td>${formatDate(trip.created_at)}</td>
              <td>${trip.transit_type === 'ROAD' ? '🚗 Carretera' : '✈️ Vuelo'}</td>
              <td>${trip.origin}</td>
              <td>${trip.destination}</td>
              <td class="status-${trip.status.toLowerCase()}">${trip.status}</td>
              <td>
                ${trip.transit_type === 'ROAD' 
                  ? `Placas: ${trip.plates || '-'}${trip.companions ? `<br>Acompañantes: ${trip.companions}` : ''}`
                  : `Vuelo: ${trip.flight_number || '-'}${trip.airline ? `<br>Aerolínea: ${trip.airline}` : ''}`
                }
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="footer">
        <p>Total de viajes: ${trips.length}</p>
        <p>Documento generado automáticamente por COMUNIDAD EX SOS</p>
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    
    // Delay print to ensure content is loaded
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }
}
