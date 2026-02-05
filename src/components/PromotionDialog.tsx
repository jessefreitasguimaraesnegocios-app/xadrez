import { PieceType, PieceColor, pieceSymbols } from "@/lib/chess/types";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PromotionDialogProps {
  isOpen: boolean;
  color: PieceColor;
  onSelect: (pieceType: PieceType) => void;
  onCancel: () => void;
}

const promotionPieces: PieceType[] = ['queen', 'rook', 'bishop', 'knight'];

const PromotionDialog = ({ isOpen, color, onSelect, onCancel }: PromotionDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle className="text-center font-display text-xl">
          Escolha a promoção
        </DialogTitle>
        <div className="flex justify-center gap-4 py-4">
          {promotionPieces.map((pieceType) => (
            <Button
              key={pieceType}
              variant="outline"
              className="w-16 h-16 text-4xl hover:bg-primary hover:text-primary-foreground transition-colors"
              onClick={() => onSelect(pieceType)}
            >
              {pieceSymbols[pieceType][color]}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PromotionDialog;
