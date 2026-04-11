import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';

interface CollisionAlertProps {
  open: boolean;
  onClose: () => void;
  technicien: string;
  creneauExistant: string;
}

export function CollisionAlert({ open, onClose, technicien, creneauExistant }: CollisionAlertProps) {
  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent className="glass-strong border-destructive/50">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Conflit de planning
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            <strong className="text-foreground">{technicien}</strong> est déjà affecté à une intervention sur ce créneau :
            <br />
            <span className="text-destructive font-medium mt-1 inline-block">{creneauExistant}</span>
            <br /><br />
            Impossible : Ce technicien est déjà en intervention sur un autre chantier à cette heure-là.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onClose} className="bg-destructive hover:bg-destructive/90">
            Compris
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export interface InterventionSlot {
  technicien: string;
  date: string;
  heureDebut: string;
  heureFin: string;
  ref?: string;
}

export function checkCollision(
  newSlot: InterventionSlot,
  existingSlots: InterventionSlot[],
  excludeRef?: string
): InterventionSlot | null {
  const newStart = timeToMinutes(newSlot.heureDebut);
  const newEnd = timeToMinutes(newSlot.heureFin);

  for (const slot of existingSlots) {
    if (excludeRef && slot.ref === excludeRef) continue;
    if (slot.technicien !== newSlot.technicien) continue;
    if (slot.date !== newSlot.date) continue;

    const existStart = timeToMinutes(slot.heureDebut);
    const existEnd = timeToMinutes(slot.heureFin);

    if (newStart < existEnd && newEnd > existStart) {
      return slot;
    }
  }
  return null;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}
