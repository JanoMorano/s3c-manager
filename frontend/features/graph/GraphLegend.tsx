import type { GraphLegendItem } from './graphVisuals';
import styles from './GraphLegend.module.css';

interface GraphLegendProps {
  title: string;
  items: GraphLegendItem[];
}

export function GraphLegend({ title, items }: GraphLegendProps) {
  return (
    <div className={styles.legend} role="group" aria-label={title}>
      <div className={styles.title}>{title}</div>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.key} className={styles.item}>
            <svg className={styles.swatch} viewBox="0 0 28 8" aria-hidden="true">
              <line
                x1="1"
                y1="4"
                x2="27"
                y2="4"
                strokeWidth={item.width ?? 2}
                strokeDasharray={item.dash}
                strokeOpacity={item.opacity}
                strokeLinecap="round"
                style={{ stroke: item.color }}
              />
            </svg>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
