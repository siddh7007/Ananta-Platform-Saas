import * as React from 'react';
import { cn } from '@/lib/utils';
import { X, AlertCircle } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Base styles with touch-friendly height (44px mobile, 40px desktop)
          'flex min-h-[44px] md:min-h-[40px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export interface InputWrapperProps extends Omit<InputProps, 'onClear'> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  clearable?: boolean;
  onClear?: () => void;
  error?: string;
  showCounter?: boolean;
  maxLength?: number;
  hint?: string;
}

const InputWrapper = React.forwardRef<HTMLInputElement, InputWrapperProps>(
  (
    {
      className,
      leftIcon,
      rightIcon,
      clearable,
      onClear,
      error,
      showCounter,
      maxLength,
      hint,
      value,
      onChange,
      disabled,
      ...props
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = React.useState('');
    const inputRef = React.useRef<HTMLInputElement>(null);

    // Merge refs
    React.useImperativeHandle(ref, () => inputRef.current!);

    // Get current value length
    const currentValue = value !== undefined ? String(value) : internalValue;
    const currentLength = currentValue.length;
    const hasValue = currentLength > 0;
    const isNearLimit = maxLength && currentLength >= maxLength * 0.9;

    // Handle internal state if value is controlled
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (value === undefined) {
        setInternalValue(e.target.value);
      }
      onChange?.(e);
    };

    // Handle clear button click
    const handleClear = () => {
      if (inputRef.current) {
        // Create a synthetic event to maintain consistency
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          'value'
        )?.set;

        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(inputRef.current, '');
          const event = new Event('input', { bubbles: true });
          inputRef.current.dispatchEvent(event);
        }
      }

      if (value === undefined) {
        setInternalValue('');
      }
      onClear?.();
    };

    // Calculate padding based on icons
    const hasLeftIcon = !!leftIcon;
    const hasRightIcon = !!rightIcon || error || (clearable && hasValue);
    const hasClearButton = clearable && hasValue && !disabled;
    const hasErrorIcon = !!error;

    // Build className with conditional padding
    const inputClassName = cn(
      hasLeftIcon && 'pl-10',
      hasRightIcon && 'pr-10',
      hasClearButton && hasErrorIcon && 'pr-16', // Extra padding for both clear + error icon
      error && 'border-red-500 focus-visible:ring-red-500',
      className
    );

    return (
      <div className="w-full">
        <div className="relative">
          {/* Left Icon */}
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              {leftIcon}
            </div>
          )}

          {/* Input */}
          <Input
            ref={inputRef}
            className={inputClassName}
            value={value}
            onChange={handleChange}
            maxLength={maxLength}
            disabled={disabled}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={
              error ? `${props.id}-error` : hint ? `${props.id}-hint` : undefined
            }
            {...props}
          />

          {/* Right Icons Container */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {/* Error Icon */}
            {error && (
              <AlertCircle className="h-4 w-4 text-red-500" aria-hidden="true" />
            )}

            {/* Clear Button */}
            {hasClearButton && (
              <button
                type="button"
                onClick={handleClear}
                className="text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring rounded-sm"
                aria-label="Clear input"
                tabIndex={-1}
              >
                <X className="h-4 w-4" />
              </button>
            )}

            {/* Custom Right Icon (only if no error/clear) */}
            {rightIcon && !error && !hasClearButton && (
              <div className="text-muted-foreground pointer-events-none">
                {rightIcon}
              </div>
            )}
          </div>
        </div>

        {/* Helper Text / Error / Counter Row */}
        {(error || hint || showCounter) && (
          <div className="mt-1.5 flex items-start justify-between gap-2 text-xs">
            {/* Error or Hint */}
            <div className="flex-1">
              {error ? (
                <p
                  id={`${props.id}-error`}
                  className="text-red-500"
                  role="alert"
                >
                  {error}
                </p>
              ) : hint ? (
                <p
                  id={`${props.id}-hint`}
                  className="text-muted-foreground"
                >
                  {hint}
                </p>
              ) : null}
            </div>

            {/* Character Counter */}
            {showCounter && maxLength && (
              <div
                className={cn(
                  'text-muted-foreground tabular-nums shrink-0',
                  isNearLimit && 'text-red-500 font-medium'
                )}
                aria-live="polite"
                aria-atomic="true"
              >
                {currentLength}/{maxLength}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);
InputWrapper.displayName = 'InputWrapper';

export { Input, InputWrapper };
