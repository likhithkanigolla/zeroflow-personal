import { Plus } from "lucide-react";
import { motion } from "framer-motion";

export function FloatingAdd({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      whileHover={{ scale: 1.05 }}
      onClick={onClick}
      aria-label="Add expense"
      className="fixed z-40 right-5 bottom-32 h-14 w-14 rounded-full bg-gradient-primary text-primary-foreground shadow-glow grid place-items-center"
    >
      <Plus className="h-6 w-6" strokeWidth={2.6} />
    </motion.button>
  );
}
