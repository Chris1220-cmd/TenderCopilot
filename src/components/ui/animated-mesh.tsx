import { cn } from '@/lib/utils';

interface AnimatedMeshProps {
  className?: string;
}

export function AnimatedMesh({ className }: AnimatedMeshProps) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      {/* Blue orb */}
      <div
        className="absolute -top-1/4 -right-1/4 h-[600px] w-[600px] rounded-full opacity-20 animate-float-slow"
        style={{
          background: 'radial-gradient(circle, rgba(59,130,246,0.3), transparent 70%)',
          filter: 'blur(80px)',
        }}
      />
      {/* Cyan orb */}
      <div
        className="absolute -bottom-1/4 -left-1/4 h-[500px] w-[500px] rounded-full opacity-15 animate-float-medium"
        style={{
          background: 'radial-gradient(circle, rgba(6,182,212,0.25), transparent 70%)',
          filter: 'blur(80px)',
        }}
      />
      {/* Purple orb */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[400px] rounded-full opacity-10 animate-float-slow"
        style={{
          background: 'radial-gradient(circle, rgba(139,92,246,0.2), transparent 70%)',
          filter: 'blur(80px)',
          animationDelay: '-7s',
        }}
      />
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-grid opacity-50" />
    </div>
  );
}
