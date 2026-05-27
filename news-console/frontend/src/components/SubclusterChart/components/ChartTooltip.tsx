import type { ChartPoint } from '../lib/types';

interface TooltipPayload {
  payload: ChartPoint;
  name: string;
  value: number;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  factLabel: string;
  factUnit: string;
}

export default function ChartTooltip({
  active,
  payload,
  factLabel,
  factUnit,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-date">{p._displayDate}</div>
      <div className="chart-tooltip-title">{p._title}</div>
      <div className="chart-tooltip-fact">
        <span className="chart-tooltip-label">{factLabel}:</span>{' '}
        <strong>
          {typeof payload[0].value === 'number'
            ? payload[0].value.toLocaleString('uk-UA', { maximumFractionDigits: 4 })
            : payload[0].value}
        </strong>
        {factUnit ? ` ${factUnit}` : ''}
      </div>
      <div className="chart-tooltip-hint">Натисніть для перегляду статті</div>
    </div>
  );
}
