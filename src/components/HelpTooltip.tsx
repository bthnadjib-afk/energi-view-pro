import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useUserPrefs } from '@/contexts/UserPrefsContext';

interface HelpTooltipProps {
  text: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

export function HelpTooltip({ text, side = 'top', className }: HelpTooltipProps) {
  const { tutorialEnabled } = useUserPrefs();
  if (!tutorialEnabled) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-flex items-center justify-center cursor-help rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors w-5 h-5 shrink-0 ${className ?? ''}`}
          tabIndex={-1}
        >
          <Info className="h-3 w-3" />
        </span>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs text-xs leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
