import { ClientData, Invoice } from '../types'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function periodLabel(period: string): string {
  const [y, m] = period.split('-')
  const d = new Date(parseInt(y), parseInt(m) - 1, 1)
  return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
}

export function printInvoice(client: ClientData, invoice: Invoice, nutricionistaName: string) {
  const win = window.open('', '_blank')
  if (!win) return

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Factura — ${esc(periodLabel(invoice.period))}</title>
<style>
  body { font-family: -apple-system, 'Segoe UI', sans-serif; color: #2a2620; max-width: 640px; margin: 48px auto; padding: 0 24px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .sub { color: #8a8278; font-size: 13px; margin-bottom: 32px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  td { padding: 10px 0; border-bottom: 1px solid #e5e0d5; font-size: 14px; }
  td:last-child { text-align: right; }
  .total td { border-bottom: none; border-top: 2px solid #2a2620; font-weight: bold; font-size: 16px; padding-top: 14px; }
  .status { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
  .pagado { background: #e3f0e6; color: #3f7d4f; }
  .pendiente { background: #fbe9d9; color: #c17f3e; }
  footer { margin-top: 40px; font-size: 11px; color: #8a8278; text-align: center; }
  @media print { body { margin: 0; padding: 16px; } }
</style>
</head>
<body>
  <h1>Factura — ${esc(periodLabel(invoice.period))}</h1>
  <p class="sub">${esc(nutricionistaName)} → ${esc(client.name)} ${esc(client.surname)} · Emitida el ${new Date(invoice.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
  <table>
    <tr><td>Concepto</td><td>Sesión de nutrición — ${esc(periodLabel(invoice.period))}</td></tr>
    <tr><td>Estado</td><td><span class="status ${invoice.status}">${invoice.status === 'pagado' ? 'Pagado' : 'Pendiente'}</span></td></tr>
    <tr class="total"><td>Total</td><td>${invoice.amount}€</td></tr>
  </table>
  <footer>NutriFit — nutrefit.netlify.app · Documento generado automáticamente, no válido como factura fiscal.</footer>
</body>
</html>`

  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 300)
}
