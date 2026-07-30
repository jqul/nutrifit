import { ButtonHTMLAttributes, forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', children, loading, disabled, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center font-medium transition-all rounded-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2'
    const variants = {
      primary: 'bg-ink text-card hover:opacity-90 active:scale-[0.98]',
      outline: 'border border-border bg-transparent text-ink hover:bg-bg-alt active:scale-[0.98]',
      ghost:   'bg-transparent text-muted hover:bg-bg-alt hover:text-ink active:scale-[0.98]',
      danger:  'bg-warn/10 border border-warn/30 text-warn hover:bg-warn hover:text-white active:scale-[0.98]',
    }
    const sizes = {
      sm: 'text-[11px] px-3 py-1.5 tracking-wide uppercase font-semibold gap-1.5',
      md: 'text-sm px-4 py-2.5 gap-2',
      lg: 'text-base px-6 py-3 gap-2',
    }
    return (
      <button ref={ref} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        disabled={disabled || loading} aria-disabled={disabled || loading} aria-busy={loading} {...props}>
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
