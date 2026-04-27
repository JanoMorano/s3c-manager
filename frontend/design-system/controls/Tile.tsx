import type { ReactNode } from 'react';
import styles from './Tile.module.css';

interface TileProps {
  title: ReactNode;
  description?: ReactNode;
  href?: string;
}

export function Tile({ title, description, href }: TileProps) {
  const content = (
    <>
      <span className={styles.title}>{title}</span>
      {description ? <span className={styles.description}>{description}</span> : null}
    </>
  );

  if (href) {
    return <a className={styles.tile} href={href}>{content}</a>;
  }

  return <article className={styles.tile}>{content}</article>;
}
