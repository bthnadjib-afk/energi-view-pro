/**
 * PdfFitViewer — Affiche un PDF (blob URL) dans un iframe en forçant
 * le viewer natif du navigateur à ouvrir la page entière (zoom = page-fit).
 *
 * Pourquoi ce composant ?
 * Sans paramètre, Chrome/Edge/Firefox ouvrent souvent le PDF en "page-width"
 * (zoom > 100%) → on ne voit pas toute la feuille A4. Le fragment
 * `#view=Fit&zoom=page-fit&toolbar=0` est interprété par tous les viewers
 * PDF embarqués modernes et garantit "1 page A4 entière à l'écran".
 */
interface PdfFitViewerProps {
  /** URL blob: ou http(s) du PDF. */
  url: string | null;
  /** Titre accessibilité de l'iframe. */
  title?: string;
  /** Classes du conteneur. */
  className?: string;
  /** Afficher la barre d'outils du viewer (zoom, télécharger, imprimer). Défaut: true. */
  showToolbar?: boolean;
}

export function PdfFitViewer({ url, title = 'Aperçu PDF', className, showToolbar = true }: PdfFitViewerProps) {
  if (!url) {
    return (
      <div className={className}>
        <p className="text-muted-foreground text-center py-8">Chargement...</p>
      </div>
    );
  }

  // Fragment standard PDF.js / viewer Chrome :
  //   - view=Fit       → page entière dans la fenêtre
  //   - zoom=page-fit  → idem, supporté par Acrobat/Chrome/Edge
  //   - toolbar=0      → cache la barre (optionnel)
  //   - navpanes=0     → cache les panneaux latéraux
  const fragment = `#view=Fit&zoom=page-fit&navpanes=0&toolbar=${showToolbar ? 1 : 0}`;
  const src = `${url}${fragment}`;

  return (
    <iframe
      src={src}
      title={title}
      className={className}
      // background blanc pour éviter le flash sombre des viewers natifs en dark mode
      style={{ background: '#ffffff' }}
    />
  );
}

export default PdfFitViewer;
