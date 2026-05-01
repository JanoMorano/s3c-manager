# /admin/import/bulk-folder

Zdroj: `frontend/app/admin/import/bulk-folder/page.tsx`

## Účel
Admin nástroj pro dry-run a commit auditních import run z připojené složky souborů.

## Pole a ovládací prvky
- `folderPath`: cesta ke složce, kterou má backend zpracovat.
- `selectedSpiral`: select `Infer from path/file`, `Spiral_4`, `Spiral_5`, `Spiral_6`, `Spiral_7`.
- `allowOverride`: checkbox povolující explicitní override, když inferred spiral nesedí.
- `Dry-run plan` tlačítko načte plán.
- `Commit non-blocking` tlačítko založí import run z neblokujících položek po confirm dialogu.
- Tabulka plánu ukazuje file name, target/source kind, spiral, row counts a blockers.

## Vazby na jiné stránky
- Výsledné import run záznamy jsou viditelné v `/import` a `/admin/import`.
- Naplněná data se projeví v C3 a capability map stránkách.

## API a DB vazby
- `POST /api/v1/import/bulk-folder/dry-run`.
- `POST /api/v1/import/bulk-folder/commit`.
- DB: C3 import run/issue tabulky, `ref_spiral_baseline`, import audit metadata.

## Validace a oprávnění
- Commit je blokovaný, pokud plán nemá neblokující soubory.
- Zápis vyžaduje admin/import oprávnění.
